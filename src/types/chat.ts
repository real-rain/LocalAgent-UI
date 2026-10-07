export type ToolCallStatus = "pending" | "running" | "success" | "failed";

export type MessageStatus = "streaming" | "complete" | "failed";

export interface Message {
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
