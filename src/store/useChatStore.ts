/*
 * @Description: 使用 Zustand 管理聊天会话、消息与批量流式响应状态。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 21:14:05
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:35:00
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\store\useChatStore.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

import { create } from "zustand";
import {
  clearMessagesBySession,
  createSession,
  deleteSession as deleteSessionRecord,
  db,
  getAllSessions,
  getMessagesBySession,
  recoverInterruptedMessages,
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
  storageError: string | null;
  loadSessions: () => Promise<void>;
  recoverInterruptedStreams: () => Promise<void>;
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
  startGeneration: (
    controller: AbortController,
    id: string,
    engine?: "ollama" | "webgpu",
    model?: string,
  ) => void;
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
let streamPersistHandle: number | null = null;
let streamPersistQueue: Promise<void> = Promise.resolve();
let activeAbortController: AbortController | null = null;
let activeStreamId: string | null = null;
let activeStreamStartedAt: number | null = null;
let activeStreamEngine: "ollama" | "webgpu" = "ollama";
let activeStreamModel = "";

/**
 * 估算多语言文本的词元数量，用于显示响应吞吐量。
 * @param content 已生成的消息文本。
 * @returns 估算的词元数量。
 */
function estimateTokenCount(content: string): number {
  const pieces = content.match(
    /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]|[A-Za-z]+|[0-9]+|[^\s]/gu,
  );
  if (!pieces) return 0;

  return pieces.reduce((total, piece) => {
    if (/^[A-Za-z]+$/.test(piece)) return total + Math.ceil(piece.length / 4);
    if (/^[0-9]+$/.test(piece)) return total + Math.ceil(piece.length / 3);
    return total + 1;
  }, 0);
}

/**
 * 按会话更新时间从近到远排序。
 * @param sessions 要排序的会话记录。
 * @returns 按活动时间戳降序排列的原数组。
 */
function sortSessions(sessions: Session[]): Session[] {
  return sessions.sort((left, right) => right.updatedAt - left.updatedAt);
}

/**
 * 更新内存中会话的活动时间并重新排序。
 * @param sessionId 活动时间发生变化的会话 ID。
 * @param updatedAt 新的活动时间戳。
 * @returns 无返回值。
 */
function updateSessionActivity(sessionId: string, updatedAt: number): void {
  useChatStore.setState((state) => ({
    sessions: sortSessions(
      state.sessions.map((session) =>
        session.id === sessionId ? { ...session, updatedAt } : session,
      ),
    ),
  }));
}

/** 取消待执行的流式响应防抖持久化操作。 */
function clearStreamPersistTimer(): void {
  if (streamPersistHandle === null) return;
  window.clearTimeout(streamPersistHandle);
  streamPersistHandle = null;
}

/**
 * 将当前消息快照加入持久化写入队列。
 * @param messageId 要保存的消息 ID。
 * @returns 队列中的写入操作完成后兑现的 Promise。
 */
function persistMessageSnapshot(messageId: string): Promise<void> {
  const message = useChatStore
    .getState()
    .messages.find((item) => item.id === messageId);
  if (!message) return Promise.resolve();

  // 串行执行快照写入，避免较早的流状态覆盖较新的状态。
  streamPersistQueue = streamPersistQueue
    .then(async () => {
      const updatedAt = await saveMessage(message);
      updateSessionActivity(message.sessionId, updatedAt);
      useChatStore.setState({ storageError: null });
    })
    .catch((cause: unknown) => {
      useChatStore.setState({
        storageError:
          cause instanceof Error
            ? cause.message
            : "Unable to persist the streaming response.",
      });
    });
  return streamPersistQueue;
}

/**
 * 在响应流式生成期间安排延迟的 IndexedDB 保存操作。
 * @param messageId 当前助手消息的 ID。
 * @returns 无返回值。
 */
function scheduleStreamPersist(messageId: string): void {
  if (streamPersistHandle !== null) return;
  streamPersistHandle = window.setTimeout(() => {
    streamPersistHandle = null;
    if (activeStreamId === messageId) {
      void persistMessageSnapshot(messageId);
    }
  }, 500);
}

/** 清除已缓冲的流式增量并取消计划中的刷新操作。 */
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

/** 在一次 Zustand 状态更新中应用所有已缓冲的文本与推理增量。 */
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

  // 先复制快照并清空缓冲区，使新增量可以在应用当前批次时继续累积。
  const chunks = new Map(pendingStreamChunks);
  pendingStreamChunks.clear();

  let updatedMessages: Message[] = [];
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
        ...(message.performance && contentDelta
          ? {
            performance: {
              ...message.performance,
              totalTokens: estimateTokenCount(
                message.content + contentDelta,
              ),
            },
          }
          : {}),
      };
    });

    if (hasUpdates) updatedMessages = messages;
    return hasUpdates ? { messages } : state;
  });

  const activeMessage = updatedMessages.find(
    (message) => message.id === activeStreamId,
  );
  if (activeMessage?.status === "streaming") {
    scheduleStreamPersist(activeMessage.id);
  }
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

/**
 * 用于管理聊天会话与消息生成的 Zustand Hook 及命令式 Store API。
 * @returns 包含聊天状态、操作函数及 Zustand 标准 Store 方法的 Hook。
 */
export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  storageError: null,
  /** 加载已持久化的会话，并按最近活动时间排序。 */
  loadSessions: async () => {
    const sessions = await getAllSessions();
    set({ sessions: sortSessions(sessions) });
  },
  /** 恢复未完成的响应，然后刷新会话列表。 */
  recoverInterruptedStreams: async () => {
    await recoverInterruptedMessages();
    await get().loadSessions();
  },
  /**
   * 停止当前生成任务并加载选定会话的对话。
   * @param sessionId 要切换到的会话 ID。
   * @returns 会话加载完成后兑现的 Promise。
   */
  switchSession: async (sessionId) => {
    await get().stopGeneration();
    clearPendingStreamChunks();
    const messages = await getMessagesBySession(sessionId);
    set({ currentSessionId: sessionId, messages, isStreaming: false });
  },
  /**
   * 创建会话并将其设为当前的空对话。
   * @param model 可选的初始模型名称。
   * @param settings 可选的引擎与提示词预设设置。
   * @returns 新创建的会话。
   */
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
  /**
   * 持久化配置变更，并同步更新内存中的会话列表。
   * @param sessionId 要更新的会话 ID。
   * @param settings 要修改的配置字段。
   * @returns 持久化完成后兑现的 Promise。
   */
  updateSessionSettings: async (sessionId, settings) => {
    const updatedAt = await updateSessionSettingsRecord(sessionId, settings);
    set((state) => ({
      sessions: sortSessions(
        state.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, ...settings, updatedAt }
            : session,
        ),
      ),
    }));
  },
  /**
   * 删除会话及其对话；必要时切换到剩余会话。
   * @param sessionId 要删除的会话 ID。
   * @returns 删除及必要的会话切换完成后兑现的 Promise。
   */
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
  /**
   * 将消息添加到当前对话并持久化。
   * @param message 要添加的消息记录。
   * @returns 消息保存完成后兑现的 Promise。
   */
  addMessage: async (message) => {
    const messageToAdd: Message =
      message.id === activeStreamId &&
        message.role === "assistant" &&
        message.status === "streaming" &&
        activeStreamStartedAt !== null
        ? {
          ...message,
          performance: {
            startTime: activeStreamStartedAt,
            totalTokens: 0,
            engine: activeStreamEngine,
            model: activeStreamModel,
          },
        }
        : message;
    set((state) => ({ messages: [...state.messages, messageToAdd] }));
    const updatedAt = await saveMessage(messageToAdd);
    updateSessionActivity(messageToAdd.sessionId, updatedAt);
  },
  /**
   * 在会话尚无消息时，根据首条提示词设置会话标题。
   * @param sessionId 要重命名的会话 ID。
   * @param inputPrompt 用作标题来源的首条用户提示词。
   * @returns 标题持久化完成后兑现的 Promise。
   */
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
    const updatedAt = Date.now();
    await db.sessions.update(sessionId, {
      title: dynamicTitle,
      updatedAt,
    });
    set((currentState) => ({
      sessions: sortSessions(
        currentState.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, title: dynamicTitle, updatedAt }
            : session,
        ),
      ),
    }));
  },
  /**
   * 记录当前响应的请求控制器及引擎信息。
   * @param controller 用于取消生成任务的控制器。
   * @param id 正在流式生成的助手消息 ID。
   * @param engine 用于生成响应的 Provider 引擎。
   * @param model 用于生成响应的模型名称。
   * @returns 无返回值。
   */
  startGeneration: (controller, id, engine = "ollama", model = "") => {
    activeAbortController = controller;
    activeStreamId = id;
    activeStreamStartedAt = Date.now();
    activeStreamEngine = engine;
    activeStreamModel = model;
    set({ isStreaming: true });
  },
  /**
   * 中止当前生成任务、刷新缓冲增量，并将对应消息标记为已停止。
   * @returns 已停止的响应持久化完成后兑现的 Promise。
   */
  stopGeneration: async () => {
    const streamId = activeStreamId;
    flushPendingStreamChunks();
    activeAbortController?.abort();
    activeAbortController = null;
    activeStreamId = null;
    clearStreamPersistTimer();
    clearPendingStreamChunks();

    const failedMessage = streamId
      ? get().messages.find(
        (message) => message.id === streamId && message.status === "streaming",
      )
      : undefined;
    if (failedMessage) {
      const stoppedMessage: Message = {
        ...failedMessage,
        status: "error",
        performance: failedMessage.performance
          ? { ...failedMessage.performance, endTime: Date.now() }
          : undefined,
      };
      set((state) => ({
        isStreaming: false,
        messages: state.messages.map((message) =>
          message.id === stoppedMessage.id ? stoppedMessage : message,
        ),
      }));
      await streamPersistQueue;
      const updatedAt = await saveMessage(stoppedMessage);
      updateSessionActivity(stoppedMessage.sessionId, updatedAt);
      activeStreamStartedAt = null;
      return;
    }

    set({ isStreaming: false });
    activeStreamStartedAt = null;
  },
  /**
   * 缓冲当前消息的流式增量，并安排批量状态更新。
   * @param id 与该增量关联的助手消息 ID。
   * @param chunk 已解析的推理内容或可见文本增量。
   * @returns 无返回值；过期或非活动消息的增量会被忽略。
   */
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
  /**
   * 刷新待处理增量，并将当前响应标记为已完成。
   * @param id 可选的消息 ID，用于拒绝过期的完成事件。
   * @returns 已完成的消息持久化后兑现的 Promise。
   */
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
    if (!message) {
      activeAbortController = null;
      activeStreamId = null;
      activeStreamStartedAt = null;
      set({ isStreaming: false });
      return;
    }

    const completedMessage: Message = { ...message, status: "complete" };
    completedMessage.performance = message.performance
      ? { ...message.performance, endTime: Date.now() }
      : undefined;
    set((state) => ({
      isStreaming: false,
      messages: state.messages.map((item) =>
        item.id === completedMessage.id ? completedMessage : item,
      ),
    }));
    activeAbortController = null;
    activeStreamId = null;
    activeStreamStartedAt = null;
    clearStreamPersistTimer();
    await streamPersistQueue;
    const updatedAt = await saveMessage(completedMessage);
    updateSessionActivity(completedMessage.sessionId, updatedAt);
  },
  /**
   * 刷新待处理增量，并将当前响应标记为失败。
   * @param id 可选的消息 ID，用于拒绝过期的失败事件。
   * @returns 失败的消息持久化后兑现的 Promise。
   */
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
        activeStreamStartedAt = null;
        set({ isStreaming: false });
      }
      return;
    }

    const failedMessage: Message = {
      ...message,
      status: "error",
      performance: message.performance
        ? { ...message.performance, endTime: Date.now() }
        : undefined,
    };
    set((state) => ({
      isStreaming: false,
      messages: state.messages.map((item) =>
        item.id === failedMessage.id ? failedMessage : item,
      ),
    }));
    activeAbortController = null;
    activeStreamId = null;
    activeStreamStartedAt = null;
    clearStreamPersistTimer();
    await streamPersistQueue;
    const updatedAt = await saveMessage(failedMessage);
    updateSessionActivity(failedMessage.sessionId, updatedAt);
  },
  /**
   * 停止生成并清除当前会话中的所有消息。
   * @returns 会话对话清除完成后兑现的 Promise。
   */
  clearMessages: async () => {
    activeAbortController?.abort();
    activeAbortController = null;
    activeStreamId = null;
    activeStreamStartedAt = null;
    clearStreamPersistTimer();
    clearPendingStreamChunks();
    const { currentSessionId } = get();
    if (currentSessionId) {
      await clearMessagesBySession(currentSessionId);
    }
    set((state) => ({
      messages: [],
      isStreaming: false,
      sessions: sortSessions(
        state.sessions.map((session) =>
          session.id === currentSessionId
            ? { ...session, title: "New Chat", updatedAt: Date.now() }
            : session,
        ),
      ),
    }));
  },
}));
