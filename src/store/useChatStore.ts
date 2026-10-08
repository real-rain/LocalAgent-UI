import { create } from "zustand";
import {
  clearMessagesBySession,
  createSession,
  deleteSession as deleteSessionRecord,
  db,
  getAllSessions,
  getMessagesBySession,
  saveMessage,
  updateSessionSettings as updateSessionSettingsRecord,
  type Session,
  type SessionSettings,
} from "../db/indexedDB";
import type { Message } from "../types/chat";
import type { StreamChunk } from "../core/parser/StreamParser";

interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  loadSessions: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  createNewSession: (
    model?: string,
    settings?: Partial<SessionSettings>,
  ) => Promise<Session>;
  updateSessionSettings: (
    sessionId: string,
    settings: Partial<SessionSettings>,
  ) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  startGeneration: (controller: AbortController, id: string) => void;
  stopGeneration: () => Promise<void>;
  appendStreamChunk: (id: string, chunk: StreamChunk) => void;
  setStreamingComplete: (id?: string) => Promise<void>;
  setStreamingFailed: (id?: string) => Promise<void>;
  updateTitleFromFirstMessage: (
    sessionId: string,
    inputPrompt: string,
  ) => Promise<void>;
  clearMessages: () => Promise<void>;
}

interface PendingStreamChunks {
  content: string[];
  thoughtProcess: string[];
}

const pendingStreamChunks = new Map<string, PendingStreamChunks>();
let streamFlushHandle: number | null = null;
let streamFlushUsesTimeout = false;
let activeAbortController: AbortController | null = null;
let activeStreamId: string | null = null;

function clearPendingStreamChunks(): void {
  pendingStreamChunks.clear();
  if (streamFlushHandle === null) return;

  if (streamFlushUsesTimeout) {
    window.clearTimeout(streamFlushHandle);
  } else {
    window.cancelAnimationFrame(streamFlushHandle);
  }
  streamFlushHandle = null;
}

function flushPendingStreamChunks(): void {
  if (streamFlushHandle !== null) {
    if (streamFlushUsesTimeout) {
      window.clearTimeout(streamFlushHandle);
    } else {
      window.cancelAnimationFrame(streamFlushHandle);
    }
    streamFlushHandle = null;
  }

  if (pendingStreamChunks.size === 0) return;

  const chunks = new Map(pendingStreamChunks);
  pendingStreamChunks.clear();

  useChatStore.setState((state) => {
    let hasUpdates = false;
    const messages = state.messages.map((message) => {
      const pending = chunks.get(message.id);
      if (!pending) return message;

      const contentDelta = pending.content.join("");
      const thoughtDelta = pending.thoughtProcess.join("");
      if (!contentDelta && !thoughtDelta) return message;

      hasUpdates = true;
      return {
        ...message,
        ...(contentDelta ? { content: message.content + contentDelta } : {}),
        ...(thoughtDelta
          ? {
              thoughtProcess:
                (message.thoughtProcess ?? "") + thoughtDelta,
            }
          : {}),
      };
    });

    return hasUpdates ? { messages } : state;
  });
}

function scheduleStreamFlush(): void {
  if (streamFlushHandle !== null) return;

  if (typeof window.requestAnimationFrame === "function") {
    streamFlushUsesTimeout = false;
    streamFlushHandle = window.requestAnimationFrame(() => {
      streamFlushHandle = null;
      flushPendingStreamChunks();
    });
    return;
  }

  streamFlushUsesTimeout = true;
  streamFlushHandle = window.setTimeout(() => {
    streamFlushHandle = null;
    flushPendingStreamChunks();
  }, 16);
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  loadSessions: async () => {
    const sessions = await getAllSessions();
    set({
      sessions: sessions.sort((left, right) => right.updatedAt - left.updatedAt),
    });
  },
  switchSession: async (sessionId) => {
    await get().stopGeneration();
    clearPendingStreamChunks();
    const messages = await getMessagesBySession(sessionId);
    set({ currentSessionId: sessionId, messages, isStreaming: false });
  },
  createNewSession: async (model = "", settings = {}) => {
    if (get().isStreaming) {
      await get().stopGeneration();
    }
    clearPendingStreamChunks();

    const session = await createSession("新会话", model, settings);
    set((state) => ({
      sessions: [session, ...state.sessions],
      currentSessionId: session.id,
      messages: [],
      isStreaming: false,
    }));
    return session;
  },
  updateSessionSettings: async (sessionId, settings) => {
    await updateSessionSettingsRecord(sessionId, settings);
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId
          ? { ...session, ...settings, updatedAt: Date.now() }
          : session,
      ),
    }));
  },
  deleteSession: async (sessionId) => {
    await deleteSessionRecord(sessionId);
    const sessions = get().sessions.filter((session) => session.id !== sessionId);
    const wasCurrent = get().currentSessionId === sessionId;

    set({
      sessions,
      ...(wasCurrent
        ? { currentSessionId: null, messages: [], isStreaming: false }
        : {}),
    });

    if (wasCurrent && sessions[0]) {
      await get().switchSession(sessions[0].id);
    }
  },
  addMessage: async (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
    await saveMessage(message);
  },
  updateTitleFromFirstMessage: async (sessionId, inputPrompt) => {
    const state = get();
    if (state.currentSessionId !== sessionId || state.messages.length !== 0) {
      return;
    }

    const dynamicTitle =
      inputPrompt
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 24)
        .trimEnd() || "New Chat";
    await db.sessions.update(sessionId, { title: dynamicTitle });
    set((currentState) => ({
      sessions: currentState.sessions.map((session) =>
        session.id === sessionId
          ? { ...session, title: dynamicTitle }
          : session,
      ),
    }));
  },
  startGeneration: (controller, id) => {
    activeAbortController = controller;
    activeStreamId = id;
    set({ isStreaming: true });
  },
  stopGeneration: async () => {
    const streamId = activeStreamId;
    activeAbortController?.abort();
    activeAbortController = null;
    activeStreamId = null;
    clearPendingStreamChunks();

    const failedMessage = streamId
      ? get().messages.find(
          (message) => message.id === streamId && message.status === "streaming",
        )
      : undefined;
    if (failedMessage) {
      const stoppedMessage: Message = { ...failedMessage, status: "error" };
      set((state) => ({
        isStreaming: false,
        messages: state.messages.map((message) =>
          message.id === stoppedMessage.id ? stoppedMessage : message,
        ),
      }));
      await saveMessage(stoppedMessage);
      return;
    }

    set({ isStreaming: false });
  },
  appendStreamChunk: (id, chunk) => {
    if (
      activeStreamId !== id ||
      !get().messages.some(
        (message) => message.id === id && message.status === "streaming",
      )
    ) {
      return;
    }

    const pending = pendingStreamChunks.get(id) ?? {
      content: [],
      thoughtProcess: [],
    };
    if (chunk.type === "thought_delta") {
      pending.thoughtProcess.push(chunk.content);
    } else {
      pending.content.push(chunk.content);
    }
    pendingStreamChunks.set(id, pending);
    scheduleStreamFlush();
  },
  setStreamingComplete: async (id) => {
    if (id && activeStreamId !== id) return;
    flushPendingStreamChunks();
    const message = get().messages.find(
      (item) =>
        item.id === id ||
        (id === undefined &&
          item.role === "assistant" &&
          item.status === "streaming"),
    );
    if (!message) return;

    const completedMessage: Message = { ...message, status: "complete" };
    set((state) => ({
      isStreaming: false,
      messages: state.messages.map((item) =>
        item.id === completedMessage.id ? completedMessage : item,
      ),
    }));
    activeAbortController = null;
    activeStreamId = null;
    await saveMessage(completedMessage);
  },
  setStreamingFailed: async (id) => {
    if (id && activeStreamId !== id) return;
    flushPendingStreamChunks();
    const message = get().messages.findLast(
      (item) =>
        item.role === "assistant" &&
        item.status === "streaming" &&
        (!id || item.id === id) &&
        (!activeStreamId || item.id === activeStreamId),
    );
    if (!message) {
      if (!id || id === activeStreamId) {
        activeAbortController = null;
        activeStreamId = null;
        set({ isStreaming: false });
      }
      return;
    }

    const failedMessage: Message = { ...message, status: "error" };
    set((state) => ({
      isStreaming: false,
      messages: state.messages.map((item) =>
        item.id === failedMessage.id ? failedMessage : item,
      ),
    }));
    activeAbortController = null;
    activeStreamId = null;
    await saveMessage(failedMessage);
  },
  clearMessages: async () => {
    clearPendingStreamChunks();
    const { currentSessionId } = get();
    if (currentSessionId) {
      await clearMessagesBySession(currentSessionId);
    }
    set((state) => ({
      messages: [],
      isStreaming: false,
      sessions: state.sessions.map((session) =>
        session.id === currentSessionId
          ? { ...session, title: "New Chat" }
          : session,
      ),
    }));
  },
}));
