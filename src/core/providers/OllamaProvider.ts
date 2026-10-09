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
import type { ChatProvider, ProviderMessage } from "./ChatProvider";

interface OllamaStreamResponse {
  message?: {
    content?: string;
    reasoning_content?: string;
    thinking?: string;
  };
  done?: boolean;
  error?: string;
}

export class OllamaProvider implements ChatProvider {
  private readonly baseUrl: string;

  constructor(baseUrl = "http://localhost:11434") {
    this.baseUrl = baseUrl;
  }

  /**
   * 请求 Ollama 聊天补全，并逐步产出解析后的响应数据块。
   * @param modelId Ollama 模型名称。
   * @param messages 对话历史。
   * @param systemPrompt 提供给模型的系统级指令。
   * @param signal 用于取消请求的可选信号。
   * @returns 包含推理内容与可见文本增量的异步数据流。
   */
  async *chatStream(
    modelId: string,
    messages: ProviderMessage[],
    systemPrompt = CODE_FORMATTING_SYSTEM_PROMPT,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
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
    let streamDone = false;

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

        // Ollama 每行输出一个 JSON 对象；末尾尚未完整的行留待下一块数据。
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const data = readLine(line);
          if (!data) continue;
          for (const chunk of parseResponse(data)) yield chunk;
        }

        if (done) {
          streamDone = true;
          const data = readLine(buffer);
          if (data) {
            for (const chunk of parseResponse(data)) yield chunk;
          }
          for (const chunk of parser.flush()) yield chunk;
          break;
        }
      }
    } finally {
      if (!streamDone) {
        await reader.cancel(signal?.reason);
      }
      reader.releaseLock();
    }
  }
}

export default OllamaProvider;
