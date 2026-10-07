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

interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  loadSessions: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  createNewSession: (model?: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  appendStreamChunk: (id: string, chunk: string, isThought?: boolean) => void;
  setStreamingComplete: (id?: string) => Promise<void>;
  setStreamingFailed: () => void;
  clearMessages: () => void;
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
  appendStreamChunk: (id, chunk, isThought = false) =>
    set((state) => {
      const index = state.messages.findIndex((message) => message.id === id);
      if (index < 0) return state;

      const messages = [...state.messages];
      messages[index] = {
        ...messages[index],
        ...(isThought
          ? { thoughtProcess: (messages[index].thoughtProcess ?? "") + chunk }
          : { content: messages[index].content + chunk }),
      };
      return { messages };
    }),
  setStreamingComplete: async (id) => {
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
  setStreamingFailed: () =>
    set((state) => ({
      messages: state.messages.map((message, index) =>
        index ===
        state.messages.findLastIndex(
          (item) => item.role === "assistant" && item.status === "streaming",
        )
          ? { ...message, status: "failed" }
          : message,
      ),
    })),
  clearMessages: () => set({ messages: [] }),
}));
