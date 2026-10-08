/*
 * @Description: 模型选择弹出框
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 21:49:06
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 22:14:33
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\ModelSelectorPopover.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Cpu, LoaderCircle, Server, Sparkles } from 'lucide-react';
import { checkWebGPUSupport, fetchOllamaModels } from '../../core/utils/healthCheck';

export interface ModelSelectorPopoverProps {
    selectedEngine: 'ollama' | 'webgpu';
    selectedModel: string;
    isWebLLMReady: boolean;
    isWebLLMLoading: boolean;
    onSelectEngine: (engine: 'ollama' | 'webgpu', model: string) => void;
}

const ollamaConnectionError = '无法连接到 Ollama 服务，请先在终端运行 ollama serve';

export function ModelSelectorPopover({
    selectedEngine,
    selectedModel,
    isWebLLMReady,
    isWebLLMLoading,
    onSelectEngine,
}: ModelSelectorPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [ollamaStatus, setOllamaStatus] = useState({
        isAlive: false,
        models: [] as string[],
        loading: true,
    });
    const [webgpuStatus, setWebgpuStatus] = useState<{
        isSupported: boolean;
        reason?: string;
    }>({ isSupported: false });
    const [isCheckingWebGPU, setIsCheckingWebGPU] = useState(true);
    const [webGPUModels, setWebGPUModels] = useState<
        { model: string; vramRequiredMB?: number }[]
    >([]);
    const [isLoadingWebGPUModels, setIsLoadingWebGPUModels] = useState(false);
    const [webGPUModelsError, setWebGPUModelsError] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const healthCheckId = useRef(0);
    const webGPUModelsRequest = useRef<Promise<void> | null>(null);

    const loadWebGPUModels = () => {
        if (webGPUModels.length > 0 || webGPUModelsRequest.current) return;

        setIsLoadingWebGPUModels(true);
        setWebGPUModelsError(null);
        webGPUModelsRequest.current = import('@mlc-ai/web-llm')
            .then(({ ModelType, prebuiltAppConfig }) => {
                setWebGPUModels(
                    prebuiltAppConfig.model_list
                        .filter(
                            (model) =>
                                model.model_type === undefined ||
                                model.model_type === ModelType.LLM,
                        )
                        .map((model) => ({
                            model: model.model_id,
                            vramRequiredMB: model.vram_required_MB,
                        })),
                );
            })
            .catch((cause: unknown) => {
                setWebGPUModelsError(
                    cause instanceof Error
                        ? `无法加载 WebGPU 模型列表：${cause.message}`
                        : '无法加载 WebGPU 模型列表。',
                );
            })
            .finally(() => {
                webGPUModelsRequest.current = null;
                setIsLoadingWebGPUModels(false);
            });
    };

    const refreshHealth = useCallback(async () => {
        const currentCheckId = ++healthCheckId.current;

        const [webgpuResult, ollamaResult] = await Promise.all([
            checkWebGPUSupport(),
            fetchOllamaModels(),
        ]);

        if (currentCheckId !== healthCheckId.current) {
            return ollamaResult;
        }

        setWebgpuStatus(webgpuResult);
        setIsCheckingWebGPU(false);
        setOllamaStatus({ ...ollamaResult, loading: false });
        return ollamaResult;
    }, []);

    useEffect(() => {
        void refreshHealth();
    }, [refreshHealth]);

    const beginHealthCheck = () => {
        setOllamaStatus((status) => ({ ...status, loading: true }));
        setIsCheckingWebGPU(true);
        void refreshHealth();
    };

    useEffect(() => {
        if (!errorMessage) return;
        const timeout = window.setTimeout(() => setErrorMessage(null), 4000);
        return () => window.clearTimeout(timeout);
    }, [errorMessage]);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!popoverRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const selectedIsOffline =
        (selectedEngine === 'ollama' && !ollamaStatus.loading && !ollamaStatus.isAlive) ||
        (selectedEngine === 'webgpu' && !isCheckingWebGPU && !webgpuStatus.isSupported);
    const triggerLabel = selectedModel
        ? `${selectedEngine === 'ollama' ? 'Ollama' : 'WebGPU'} · ${selectedModel}`
        : '选择模型';

    const handleOllamaSelect = (model: string) => {
        if (!ollamaStatus.isAlive) {
            setErrorMessage(ollamaConnectionError);
            return;
        }

        onSelectEngine('ollama', model);
        setIsOpen(false);
    };

    const handleReconnect = async () => {
        setErrorMessage(ollamaConnectionError);
        setOllamaStatus((status) => ({ ...status, loading: true }));
        setIsCheckingWebGPU(true);
        const result = await refreshHealth();
        if (result.isAlive) {
            setErrorMessage(null);
        }
    };

    return (
        <div className="relative inline-block" ref={popoverRef}>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => {
                    if (!isOpen) {
                        beginHealthCheck();
                        loadWebGPUModels();
                    }
                    setIsOpen(!isOpen);
                }}
                className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-all hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            >
                {selectedIsOffline ? (
                    <span className="h-2 w-2 rounded-full bg-red-500" aria-label="服务连接异常" />
                ) : selectedEngine === 'ollama' && ollamaStatus.loading ? (
                    <LoaderCircle className="h-3 w-3 animate-spin text-zinc-400" aria-label="正在检查 Ollama" />
                ) : selectedEngine === 'ollama' ? (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Ollama active" />
                ) : isWebLLMLoading ? (
                    <span
                        className="h-2.5 w-2.5 animate-spin rounded-full border border-blue-400/30 border-t-blue-400"
                        aria-label="WebGPU loading"
                    />
                ) : isWebLLMReady ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" aria-label="WebGPU ready" />
                ) : (
                    <span className="h-2 w-2 rounded-full bg-zinc-600" aria-label="WebGPU not ready" />
                )}
                <span>{triggerLabel}</span>
                <ChevronDown
                    className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-xl shadow-black/40"
                    role="listbox"
                    aria-label="选择模型"
                >
                    <div className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold tracking-[0.14em] text-zinc-500">
                        LOCAL ENDPOINTS
                    </div>
                    {ollamaStatus.loading ? (
                        <div className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-zinc-500">
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                            正在检查 Ollama…
                        </div>
                    ) : ollamaStatus.isAlive ? (
                        ollamaStatus.models.length > 0 ? (
                            ollamaStatus.models.map((model) => {
                                const isSelected = selectedEngine === 'ollama' && selectedModel === model;

                                return (
                                    <button
                                        key={model}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => handleOllamaSelect(model)}
                                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:bg-zinc-800/70 focus-visible:outline-none"
                                    >
                                        <Server className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
                                        <span className="flex-1 truncate">{model}</span>
                                        {isSelected && (
                                            <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                                        )}
                                    </button>
                                );
                            })
                        ) : (
                            <p className="px-2.5 py-2 text-xs text-zinc-500">
                                无可用模型 (请先执行 ollama pull)
                            </p>
                        )
                    ) : (
                        <button
                            type="button"
                            onClick={() => void handleReconnect()}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-amber-400 transition-colors hover:bg-zinc-800/70 focus-visible:bg-zinc-800/70 focus-visible:outline-none"
                        >
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                            Disconnected (点击重连)
                        </button>
                    )}

                    <div className="mx-2 my-1.5 border-t border-zinc-800" />
                    <div className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-1 text-[10px] font-semibold tracking-[0.14em] text-zinc-500">
                        <Sparkles className="h-3 w-3 text-blue-400" aria-hidden="true" />
                        IN-BROWSER WEBGPU
                    </div>
                    {isLoadingWebGPUModels ? (
                        <div className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-zinc-500">
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                            正在加载 WebGPU 模型列表…
                        </div>
                    ) : webGPUModelsError ? (
                        <p className="px-2.5 py-2 text-xs text-red-400" role="alert">
                            {webGPUModelsError}
                        </p>
                    ) : webGPUModels.length === 0 ? (
                        <p className="px-2.5 py-2 text-xs text-zinc-500">
                            当前没有可用的文本对话模型。
                        </p>
                    ) : (
                        webGPUModels.map((option) => {
                            const isSelected =
                                selectedEngine === 'webgpu' &&
                                selectedModel === option.model;
                            const isDisabled =
                                !webgpuStatus.isSupported ||
                                (isWebLLMLoading &&
                                    !(selectedEngine === 'webgpu' &&
                                        selectedModel === option.model));

                            return (
                                <button
                                    key={option.model}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    aria-disabled={isDisabled}
                                    title={
                                        !webgpuStatus.isSupported
                                            ? '浏览器不支持 WebGPU'
                                            : isWebLLMLoading
                                              ? 'WebGPU 模型加载期间无法切换模型'
                                              : option.model
                                    }
                                    disabled={isDisabled}
                                    onClick={() => {
                                        onSelectEngine('webgpu', option.model);
                                        setIsOpen(false);
                                    }}
                                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none ${
                                        isDisabled
                                            ? 'cursor-not-allowed text-zinc-600'
                                            : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:bg-zinc-800/70'
                                    }`}
                                >
                                    <Cpu
                                        className={`h-4 w-4 shrink-0 ${isDisabled ? 'text-zinc-700' : 'text-zinc-500'}`}
                                        aria-hidden="true"
                                    />
                                    <span className="flex-1 truncate">{option.model}</span>
                                    {option.vramRequiredMB !== undefined && (
                                        <span className="shrink-0 text-[10px] text-zinc-500">
                                            {(option.vramRequiredMB / 1024).toFixed(1)} GB
                                        </span>
                                    )}
                                    {isSelected && (
                                        <Check className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
                                    )}
                                </button>
                            );
                        })
                    )}

                    {errorMessage && (
                        <p
                            className="mt-1.5 border-t border-zinc-800 px-2.5 py-2 text-xs text-red-400"
                            role="alert"
                        >
                            {errorMessage}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
