export type ToolCallStatus = "pending" | "running" | "success" | "failed";

export type MessageStatus = "streaming" | "complete" | "failed" | "error";

export interface Message {
  id: string;
  sessionId: string;
  createdAt: number;
  role: "user" | "assistant";
  content: string;
  status?: MessageStatus;
  thoughtProcess?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  status: ToolCallStatus;
  arguments: unknown;
  result?: unknown;
}
