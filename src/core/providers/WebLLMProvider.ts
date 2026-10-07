/*
 * @Description: WebLLM Provider 适配器
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 21:09:22
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 21:12:25
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\providers\WebLLMProvider.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import {
    CreateWebWorkerMLCEngine,
    type MLCEngine,
} from "@mlc-ai/web-llm";
import type { Message } from "../../types/chat";

export interface StreamChunk {
    type: "thought_delta" | "text_delta";
    content: string;
}

const WEBGPU_UNSUPPORTED_MESSAGE =
    "当前浏览器或设备不支持 WebGPU，无法运行本地模型。请使用支持 WebGPU 的最新版浏览器和设备。";

class StreamParser {
    private isThinking = false;
    private buffer = "";

    parse(value: string): StreamChunk[] {
        this.buffer += value;
        const chunks: StreamChunk[] = [];

        while (this.buffer.length > 0) {
            const marker = this.isThinking ? "</think>" : "<think>";
            const markerIndex = this.buffer.indexOf(marker);

            if (markerIndex >= 0) {
                this.pushChunk(chunks, this.buffer.slice(0, markerIndex));
                this.buffer = this.buffer.slice(markerIndex + marker.length);
                this.isThinking = !this.isThinking;
                continue;
            }

            const possibleMarkerLength = marker.length - 1;
            const textLength = Math.max(0, this.buffer.length - possibleMarkerLength);
            if (textLength > 0) {
                this.pushChunk(chunks, this.buffer.slice(0, textLength));
                this.buffer = this.buffer.slice(textLength);
            }
            break;
        }

        return chunks;
    }

    flush(): StreamChunk[] {
        const chunks: StreamChunk[] = [];
        this.pushChunk(chunks, this.buffer);
        this.buffer = "";
        return chunks;
    }

    private pushChunk(chunks: StreamChunk[], content: string): void {
        if (content) {
            chunks.push({
                type: this.isThinking ? "thought_delta" : "text_delta",
                content,
            });
        }
    }
}

export class WebLLMProvider {
    engine: MLCEngine | null = null;
    private loadedModelId: string | null = null;

    async initEngine(
        modelId: string,
        onProgress: (progress: string) => void,
    ): Promise<void> {
        if (typeof navigator === "undefined" || !("gpu" in navigator)) {
            throw new Error(WEBGPU_UNSUPPORTED_MESSAGE);
        }

        if (this.engine && this.loadedModelId === modelId) {
            onProgress("模型已就绪");
            return;
        }

        if (this.engine) {
            onProgress(`正在切换到模型 ${modelId}...`);
            await this.engine.reload(modelId);
            this.loadedModelId = modelId;
            onProgress("模型加载完成");
            return;
        }

        const worker = new Worker(
            new URL("../workers/webllm.worker.ts", import.meta.url),
            { type: "module" },
        );

        try {
            const engine = await CreateWebWorkerMLCEngine(worker, modelId, {
                initProgressCallback: (report) => onProgress(report.text),
            });
            // The worker engine has the same chat/reload API, but the SDK types its
            // factory separately from the main-thread MLCEngine class.
            this.engine = engine as unknown as MLCEngine;
            this.loadedModelId = modelId;
        } catch (cause) {
            worker.terminate();
            throw cause;
        }
    }

    async *chatStream(
        modelId: string,
        messages: Message[],
    ): AsyncGenerator<StreamChunk> {
        if (typeof navigator === "undefined" || !("gpu" in navigator)) {
            yield { type: "text_delta", content: WEBGPU_UNSUPPORTED_MESSAGE };
            return;
        }

        try {
            if (!this.engine || this.loadedModelId !== modelId) {
                await this.initEngine(modelId, () => undefined);
            }

            if (!this.engine) {
                throw new Error("WebLLM 引擎初始化失败。");
            }

            const parser = new StreamParser();
            const stream = await this.engine.chat.completions.create({
                messages,
                stream: true,
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta.content;
                if (!content) continue;

                for (const parsedChunk of parser.parse(content)) {
                    yield parsedChunk;
                }
            }

            for (const parsedChunk of parser.flush()) {
                yield parsedChunk;
            }
        } catch (cause) {
            const message =
                cause instanceof Error
                    ? cause.message
                    : "与 WebLLM 通信时发生未知错误。";
            yield { type: "text_delta", content: `WebLLM 请求失败：${message}` };
        }
    }
}

export default WebLLMProvider;