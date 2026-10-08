import { CODE_FORMATTING_SYSTEM_PROMPT } from "./systemPrompt";

export interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OllamaStreamResponse {
  message?: { content?: string };
  done?: boolean;
  error?: string;
}

export class OllamaProvider {
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(model: string, baseUrl = "http://localhost:11434") {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async *chatStream(
    messages: OllamaMessage[],
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: CODE_FORMATTING_SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        detail || `Ollama 请求失败（HTTP ${response.status}）。请确认 Ollama 服务正在运行。`,
      );
    }

    if (!response.body) {
      throw new Error("Ollama 响应中没有可读取的流。");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    function readLine(line: string): string | undefined {
      if (!line.trim()) return undefined;

      let data: OllamaStreamResponse;
      try {
        data = JSON.parse(line) as OllamaStreamResponse;
      } catch {
        throw new Error("无法解析 Ollama 返回的流数据。");
      }

      if (data.error) throw new Error(data.error);
      return data.message?.content;
    }

    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const chunk = readLine(line);
          if (chunk) yield chunk;
        }

        if (done) {
          const chunk = readLine(buffer);
          if (chunk) yield chunk;
          break;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export default OllamaProvider;
