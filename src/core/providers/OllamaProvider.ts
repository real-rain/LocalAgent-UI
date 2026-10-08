/*
 * @Description: Ollama Provider 适配器
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 20:36:55
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-08 16:35:36
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\providers\OllamaProvider.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import { CODE_FORMATTING_SYSTEM_PROMPT } from "./systemPrompt";
import { StreamParser, type StreamChunk } from "../parser/StreamParser";

export interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OllamaStreamResponse {
  message?: {
    content?: string;
    reasoning_content?: string;
    thinking?: string;
  };
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
  ): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: CODE_FORMATTING_SYSTEM_PROMPT },
          ...messages,
        ],
        options: {
          temperature: 0.6,
          top_p: 0.9,
        },
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
    const parser = new StreamParser();
    let buffer = "";

    function readLine(line: string): OllamaStreamResponse | undefined {
      if (!line.trim()) return undefined;

      let data: OllamaStreamResponse;
      try {
        data = JSON.parse(line) as OllamaStreamResponse;
      } catch {
        throw new Error("无法解析 Ollama 返回的流数据。");
      }

      if (data.error) throw new Error(data.error);
      return data;
    }

    function parseResponse(data: OllamaStreamResponse): StreamChunk[] {
      return [
        ...parser.parseReasoning(
          data.message?.reasoning_content ?? data.message?.thinking ?? "",
        ),
        ...parser.parse(data.message?.content ?? ""),
      ];
    }

    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const data = readLine(line);
          if (!data) continue;
          for (const chunk of parseResponse(data)) yield chunk;
        }

        if (done) {
          const data = readLine(buffer);
          if (data) {
            for (const chunk of parseResponse(data)) yield chunk;
          }
          for (const chunk of parser.flush()) yield chunk;
          break;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export default OllamaProvider;
