import { create } from "zustand";
import {
  createSession,
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
  addMessage: (message: Message) => Promise<void>;
  appendStreamChunk: (id: string, chunk: string) => void;
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
  createNewSession: async (model = "qwen2.5") => {
    const session = await createSession("新会话", model);
    set((state) => ({
      sessions: [session, ...state.sessions],
    }));
    await get().switchSession(session.id);
    return session;
  },
  addMessage: async (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
    await saveMessage(message);
  },
  appendStreamChunk: (id, chunk) =>
    set((state) => {
      const index = state.messages.findIndex((message) => message.id === id);
      if (index < 0) return state;

      const messages = [...state.messages];
      messages[index] = {
        ...messages[index],
        content: messages[index].content + chunk,
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
