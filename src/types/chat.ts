/*
 * @Description: 定义聊天消息、性能数据与工具调用所共用的数据结构。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 20:36:55
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:35:22
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\types\chat.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

export type ToolCallStatus = "pending" | "running" | "success" | "failed";

export type MessageStatus =
  | "streaming"
  | "complete"
  | "failed"
  | "error"
  | "interrupted";

export interface Message {
  id: string;
  sessionId: string;
  createdAt: number;
  role: "user" | "assistant";
  content: string;
  status?: MessageStatus;
  thoughtProcess?: string;
  toolCalls?: ToolCall[];
  performance?: MessagePerformance;
}

export interface MessagePerformance {
  startTime: number;
  endTime?: number;
  totalTokens: number;
  engine: "ollama" | "webgpu";
  model: string;
}

export interface ToolCall {
  name: string;
  status: ToolCallStatus;
  arguments: unknown;
  result?: unknown;
}
