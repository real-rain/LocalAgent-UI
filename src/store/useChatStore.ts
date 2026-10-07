import { create } from "zustand";
import type { Message } from "../types/chat";

interface ChatState {
  messages: Message[];
  addMessage: (message: Message) => void;
  appendStreamChunk: (chunk: string) => void;
  setStreamingComplete: () => void;
  setStreamingFailed: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  appendStreamChunk: (chunk) =>
    set((state) => {
      const index = state.messages.findLastIndex(
        (message) => message.role === "assistant" && message.status === "streaming",
      );
      if (index < 0) return state;

      const messages = [...state.messages];
      messages[index] = {
        ...messages[index],
        content: messages[index].content + chunk,
      };
      return { messages };
    }),
  setStreamingComplete: () =>
    set((state) => ({
      messages: state.messages.map((message, index) =>
        index === state.messages.findLastIndex(
          (item) => item.role === "assistant" && item.status === "streaming",
        )
          ? { ...message, status: "complete" }
          : message,
      ),
    })),
  setStreamingFailed: () =>
    set((state) => ({
      messages: state.messages.map((message, index) =>
        index === state.messages.findLastIndex(
          (item) => item.role === "assistant" && item.status === "streaming",
        )
          ? { ...message, status: "failed" }
          : message,
      ),
    })),
  clearMessages: () => set({ messages: [] }),
}));
