import { EMBEDDING_MODEL_ID } from "./embeddingModel";

/** 主线程中等待 Worker 返回结果的单个向量化请求。 */
type PendingRequest = {
    resolve: (embeddings: number[][]) => void;
    reject: (cause: Error) => void;
};

/** 主线程接收的 Worker 响应格式。 */
type EmbeddingResponse = {
    id: number;
    embeddings?: number[][];
    error?: string;
    status?: "loading" | "ready" | "error";
    modelId?: string;
    dimension?: number;
};

export type EmbeddingModelStatus = {
    state: "idle" | "loading" | "ready" | "error";
    modelId: string;
    dimension: number | null;
};

let modelStatus: EmbeddingModelStatus = {
    state: "idle",
    modelId: EMBEDDING_MODEL_ID,
    dimension: null,
};
const statusListeners = new Set<() => void>();

function updateModelStatus(update: Partial<EmbeddingModelStatus>) {
    modelStatus = { ...modelStatus, ...update };
    for (const listener of statusListeners) listener();
}

export function getEmbeddingModelStatus(): EmbeddingModelStatus {
    return modelStatus;
}

export function subscribeEmbeddingModelStatus(listener: () => void): () => void {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
}

let worker: Worker | undefined;
let nextRequestId = 0;
const pendingRequests = new Map<number, PendingRequest>();

/** 按需创建并复用 Worker，同时统一分发异步响应。 */
function getWorker(): Worker {
    if (worker) return worker;
    worker = new Worker(new URL("./embedding.worker.ts", import.meta.url), {
        type: "module",
    });
    worker.onmessage = (event: MessageEvent<EmbeddingResponse>) => {
        const response = event.data;
        // 模型下载进度只用于状态提示，不对应待完成的向量化请求。
        if (response.status) {
            updateModelStatus({
                state: response.status,
                modelId: response.modelId ?? EMBEDDING_MODEL_ID,
                ...(response.dimension ? { dimension: response.dimension } : {}),
            });
            return;
        }
        const pending = pendingRequests.get(response.id);
        if (!pending) return;
        pendingRequests.delete(response.id);
        if (response.error) {
            pending.reject(new Error(response.error));
        } else if (response.embeddings) {
            pending.resolve(response.embeddings);
        } else {
            pending.reject(new Error("Embedding worker returned an invalid response."));
        }
    };
    worker.onerror = (event) => {
        const error = new Error(event.message || "Embedding worker failed.");
        updateModelStatus({ state: "error" });
        for (const pending of pendingRequests.values()) pending.reject(error);
        pendingRequests.clear();
        worker?.terminate();
        worker = undefined;
    };
    return worker;
}

/**
 * 将一批文本交给 Worker 生成向量。
 * @param texts 待向量化的文本列表。
 * @returns 与输入顺序一致的向量数组；Worker 出错时拒绝 Promise。
 */
export function embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return Promise.resolve([]);
    const id = ++nextRequestId;
    const activeWorker = getWorker();
    return new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
        // 按 EmbeddingRequest 结构发送文本数组，并用请求 ID 匹配 Worker 响应。
        activeWorker.postMessage({ id, texts });
    });
}
