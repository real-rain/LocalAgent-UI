/*
 * @Description: 在独立 Web Worker 中加载本地特征提取模型并将文本转换为向量。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-13 18:45:16
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-13 19:12:14
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\rag\embedding.worker.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

import {
    pipeline,
    type FeatureExtractionPipeline,
} from "@xenova/transformers";
import { EMBEDDING_MODEL_ID } from "./embeddingModel";

/** 用于将文本转换为稠密语义向量的多语言轻量模型。 */
const MODEL_ID = EMBEDDING_MODEL_ID;

/**
 * 主线程提交给 Worker 的向量化请求格式。
 *
 * @property id 请求标识，用于将异步响应与发起请求关联。
 * @property texts 待向量化的文本数组。
 */
type EmbeddingRequest = {
    /** 请求标识，用于关联对应的响应。 */
    id: number;
    /** 待向量化的文本数组。 */
    texts: string[];
};

/**
 * Worker 返回给主线程的向量化结果或状态信息。
 *
 * @property id 对应请求的标识。
 * @property embeddings 与输入文本顺序一致的特征向量数组。
 * @property error 向量化失败时返回的错误说明。
 * @property status 可选的模型加载状态通知。
 */
type EmbeddingResponse = {
    /** 对应主线程请求的标识。 */
    id: number;
    /** 与输入文本顺序一致的特征向量数组。 */
    embeddings?: number[][];
    /** 向量化失败时返回的错误说明。 */
    error?: string;
    /** 模型加载期间发送的状态通知。 */
    status?: "loading" | "ready" | "error";
    modelId?: string;
    dimension?: number;
};

/** 延迟初始化并在后续请求中复用特征提取管道。 */
let extractor: FeatureExtractionPipeline | undefined;

/**
 * 处理主线程发来的向量化消息，并回传结果或错误。
 *
 * Worker 消息载荷为 {@link EmbeddingRequest}；结果消息为
 * {@link EmbeddingResponse}，模型加载期间另行发送状态通知。
 */
self.onmessage = async (event: MessageEvent<EmbeddingRequest>) => {
    // 从消息事件中读取请求标识和待向量化文本，确保响应可按 ID 匹配。
    const { id, texts } = event.data;
    try {
        if (!texts.length || texts.some((text) => !text.trim())) {
            throw new Error("Embedding input must contain non-empty text.");
        }
        if (!extractor) {
            self.postMessage({ id, status: "loading", modelId: MODEL_ID });
            extractor = await pipeline("feature-extraction", MODEL_ID, {
                progress_callback: (progress: { status?: string }) => {
                    // 模型权重下载时通知主线程更新处理状态。
                    if (progress.status === "progress") {
                        self.postMessage({ id, status: "loading", modelId: MODEL_ID });
                    }
                },
            });
        }
        self.postMessage({ id, status: "ready", modelId: MODEL_ID });
        const output = await extractor(texts, {
            pooling: "mean",
            normalize: true,
        });
        const vectors = output.tolist() as number[][];
        // 单条输入时模型输出也是二维数组；数量异常时按单条结果回退。
        const embeddings = vectors.length === texts.length
            ? vectors
            : [vectors[0] ?? []];
        self.postMessage({
            id,
            status: "ready",
            modelId: MODEL_ID,
            dimension: embeddings[0]?.length,
        });
        const response: EmbeddingResponse = { id, embeddings };
        // 将请求 ID 与按输入顺序排列的 number[][] 特征向量一起回传。
        self.postMessage(response);
    } catch (cause) {
        if (!extractor) {
            self.postMessage({ id, status: "error", modelId: MODEL_ID });
        }
        const response: EmbeddingResponse = {
            id,
            error: cause instanceof Error ? cause.message : "Embedding failed.",
        };
        // 失败响应携带原请求 ID 和错误文本，供主线程拒绝对应 Promise。
        self.postMessage(response);
    }
};
