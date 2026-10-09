/*
 * @Description: WebLLM Provider 适配器
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 21:09:22
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:31:09
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
import type { ChatProvider } from "./ChatProvider";

export type { StreamChunk } from "../parser/StreamParser";

const WEBGPU_UNSUPPORTED_MESSAGE =
    "当前浏览器或设备不支持 WebGPU，无法运行本地模型。请使用支持 WebGPU 的最新版浏览器和设备。";

export class WebLLMProvider implements ChatProvider {
    engine: MLCEngine | null = null;
    private loadedModelId: string | null = null;

    /**
     * 创建或重新加载指定模型对应的 Worker 引擎。
     * @param modelId WebLLM 模型标识符。
     * @param onProgress 接收初始化进度信息的回调。
     * @returns 引擎就绪后兑现的 Promise。
     */
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
            // 切换模型时复用现有 Worker 引擎，避免重复创建。
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
            // Worker 引擎具有相同的 chat/reload API，但 SDK 将其工厂类型与主线程的 MLCEngine 分开定义。
            this.engine = engine as unknown as MLCEngine;
            this.loadedModelId = modelId;
        } catch (cause) {
            worker.terminate();
            throw cause;
        }
    }

    /**
     * 通过共享推理解析器流式处理 WebLLM 补全结果。
     * @param modelId WebLLM 模型标识符。
     * @param messages 对话历史。
     * @param systemPrompt 提供给模型的系统级指令。
     * @param signal 用于中断生成的可选信号。
     * @returns 包含推理内容与可见文本增量的异步数据流。
     */
    async *chatStream(
        modelId: string,
        messages: Pick<Message, "role" | "content">[],
        systemPrompt = WEBGPU_SMALL_MODEL_SYSTEM_PROMPT,
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

        // 将取消信号绑定到当前引擎请求，并在流式处理结束后解除绑定。
        signal?.addEventListener("abort", interrupt, { once: true });
        try {
            if (signal?.aborted) {
                interrupt();
                return;
            }

            const stream = await engine.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
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