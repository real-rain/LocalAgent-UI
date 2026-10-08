import { create } from "zustand";
import {
  createSession,
  deleteSession as deleteSessionRecord,
  getAllSessions,
  getMessagesBySession,
  saveMessage,
  type Session,
} from "../db/indexedDB";
import type { Message } from "../types/chat";
import type { StreamChunk } from "../core/parser/StreamParser";

interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  loadSessions: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  createNewSession: (model?: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  appendStreamChunk: (id: string, chunk: StreamChunk) => void;
  setStreamingComplete: (id?: string) => Promise<void>;
  setStreamingFailed: () => Promise<void>;
  clearMessages: () => void;
}

interface PendingStreamChunks {
  content: string[];
  thoughtProcess: string[];
}

const pendingStreamChunks = new Map<string, PendingStreamChunks>();
let streamFlushHandle: number | null = null;
let streamFlushUsesTimeout = false;

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
  loadSessions: async () => {
    const sessions = await getAllSessions();
    set({
      sessions: sessions.sort((left, right) => right.updatedAt - left.updatedAt),
    });
  },
  switchSession: async (sessionId) => {
    flushPendingStreamChunks();
    const messages = await getMessagesBySession(sessionId);
    set({ currentSessionId: sessionId, messages });
  },
  createNewSession: async (model = "") => {
    const session = await createSession("新会话", model);
    set((state) => ({
      sessions: [session, ...state.sessions],
    }));
    await get().switchSession(session.id);
    return session;
  },
  deleteSession: async (sessionId) => {
    await deleteSessionRecord(sessionId);
    const sessions = get().sessions.filter((session) => session.id !== sessionId);
    const wasCurrent = get().currentSessionId === sessionId;

    set({
      sessions,
      ...(wasCurrent ? { currentSessionId: null, messages: [] } : {}),
    });

    if (wasCurrent && sessions[0]) {
      await get().switchSession(sessions[0].id);
    }
  },
  addMessage: async (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
    await saveMessage(message);
  },
  appendStreamChunk: (id, chunk) => {
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
      messages: state.messages.map((item) =>
        item.id === completedMessage.id ? completedMessage : item,
      ),
    }));
    await saveMessage(completedMessage);
  },
  setStreamingFailed: async () => {
    flushPendingStreamChunks();
    const message = get().messages.findLast(
      (item) => item.role === "assistant" && item.status === "streaming",
    );
    if (!message) return;

    const failedMessage: Message = { ...message, status: "error" };
    set((state) => ({
      messages: state.messages.map((item) =>
        item.id === failedMessage.id ? failedMessage : item,
      ),
    }));
    await saveMessage(failedMessage);
  },
  clearMessages: () => {
    pendingStreamChunks.clear();
    if (streamFlushHandle !== null) {
      if (streamFlushUsesTimeout) {
        window.clearTimeout(streamFlushHandle);
      } else {
        window.cancelAnimationFrame(streamFlushHandle);
      }
      streamFlushHandle = null;
    }
    set({ messages: [] });
  },
}));
