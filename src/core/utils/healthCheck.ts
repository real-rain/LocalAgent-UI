/*
 * @Description: 模型与服务探活工具
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 22:10:48
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 22:13:49
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\utils\healthCheck.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
interface OllamaModel {
    name?: unknown;
}

interface OllamaTagsResponse {
    models?: unknown;
}

interface WebGPU {
    requestAdapter: () => Promise<unknown | null>;
}

/**
 * 查询 Ollama 的 tags 接口并提取有效的模型名称。
 * @param baseUrl 可选的 Ollama 服务基础 URL。
 * @returns 服务连接状态、模型名称，以及服务不可用时的错误信息。
 */
export async function fetchOllamaModels(
    baseUrl = 'http://localhost:11434',
): Promise<{ isAlive: boolean; models: string[]; error?: string }> {
    try {
        const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`, {
            signal: AbortSignal.timeout(3000),
        });

        if (!response.ok) {
            throw new Error(`Ollama returned HTTP ${response.status}`);
        }

        const data = (await response.json()) as OllamaTagsResponse;
        const models = Array.isArray(data.models)
            ? (data.models as OllamaModel[])
                .map((model) => model.name)
                .filter((name): name is string => typeof name === 'string')
            : [];

        return { isAlive: true, models };
    } catch {
        return {
            isAlive: false,
            models: [],
            error: 'Ollama 服务未启动或 CORS 跨域受限',
        };
    }
}

/**
 * 检查浏览器是否能够获取 WebGPU 适配器。
 * @returns WebGPU 支持状态，以及不支持时的可选原因说明。
 */
export async function checkWebGPUSupport(): Promise<{
    isSupported: boolean;
    reason?: string;
}> {
    if (typeof navigator === 'undefined') {
        return { isSupported: false, reason: '当前浏览器不支持 WebGPU' };
    }

    const gpu = (navigator as Navigator & { gpu?: WebGPU }).gpu;
    if (!gpu) {
        return { isSupported: false, reason: '当前浏览器不支持 WebGPU' };
    }

    try {
        const adapter = await gpu.requestAdapter();
        if (!adapter) {
            return {
                isSupported: false,
                reason: '当前设备未开启 GPU 加速或驱动不支持',
            };
        }

        return { isSupported: true };
    } catch {
        return { isSupported: false, reason: '无法获取 GPU 适配器' };
    }
}