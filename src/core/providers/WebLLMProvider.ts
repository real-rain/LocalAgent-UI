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
import { StreamParser, type StreamChunk } from "../parser/StreamParser";
import type { Message } from "../../types/chat";
import { WEBGPU_SMALL_MODEL_SYSTEM_PROMPT } from "./systemPrompt";

export type { StreamChunk } from "../parser/StreamParser";

const WEBGPU_UNSUPPORTED_MESSAGE =
    "当前浏览器或设备不支持 WebGPU，无法运行本地模型。请使用支持 WebGPU 的最新版浏览器和设备。";

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
        messages: Pick<Message, "role" | "content">[],
        signal?: AbortSignal,
    ): AsyncGenerator<StreamChunk> {
        if (typeof navigator === "undefined" || !("gpu" in navigator)) {
            throw new Error(WEBGPU_UNSUPPORTED_MESSAGE);
        }

        if (!this.engine || this.loadedModelId !== modelId) {
            await this.initEngine(modelId, () => undefined);
        }

        if (signal?.aborted) return;

        if (!this.engine) {
            throw new Error("WebLLM 引擎初始化失败。");
        }

        const engine = this.engine;
        const parser = new StreamParser();
        let interruptPromise: Promise<void> | null = null;
        const interrupt = () => {
            if (!interruptPromise) {
                interruptPromise = engine.interruptGenerate();
                void interruptPromise.catch(() => undefined);
            }
        };

        signal?.addEventListener("abort", interrupt, { once: true });
        try {
            if (signal?.aborted) {
                interrupt();
                return;
            }

            const stream = await engine.chat.completions.create({
                messages: [
                    { role: "system", content: WEBGPU_SMALL_MODEL_SYSTEM_PROMPT },
                    ...messages,
                ],
                temperature: 0.6,
                top_p: 0.9,
                stream: true,
            });

            for await (const chunk of stream) {
                if (signal?.aborted) return;

                const delta = chunk.choices[0]?.delta;
                const reasoningContent =
                    delta && "reasoning_content" in delta &&
                    typeof delta.reasoning_content === "string"
                        ? delta.reasoning_content
                        : undefined;
                if (reasoningContent) {
                    for (const parsedChunk of parser.parseReasoning(reasoningContent)) {
                        yield parsedChunk;
                    }
                }

                const content = delta?.content;
                if (!content) continue;

                for (const parsedChunk of parser.parse(content)) {
                    yield parsedChunk;
                }
            }

            if (!signal?.aborted) {
                for (const parsedChunk of parser.flush()) {
                    yield parsedChunk;
                }
            }
        } finally {
            signal?.removeEventListener("abort", interrupt);
            if (signal?.aborted) {
                interrupt();
                await interruptPromise;
                await engine.resetChat();
            }
        }
    }
}

export default WebLLMProvider;