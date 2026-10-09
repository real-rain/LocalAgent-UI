/*
 * @Description: 提供本地 Ollama 与浏览器内 WebGPU 引擎的模型选择功能。
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
import { useTranslation } from 'react-i18next';
import { checkWebGPUSupport, fetchOllamaModels } from '../../core/utils/healthCheck';

export interface ModelSelectorPopoverProps {
    selectedEngine: 'ollama' | 'webgpu';
    selectedModel: string;
    isWebLLMReady: boolean;
    isWebLLMLoading: boolean;
    disabled: boolean;
    onSelectEngine: (engine: 'ollama' | 'webgpu', model: string) => void;
}

/**
 * 展示可用的 Ollama 与 WebGPU 模型及运行时就绪状态。
 * @param props 当前引擎状态、模型选择回调及禁用状态。
 * @returns 模型选择触发按钮及按需显示的弹出菜单。
 */
export function ModelSelectorPopover({
    selectedEngine,
    selectedModel,
    isWebLLMReady,
    isWebLLMLoading,
    disabled,
    onSelectEngine,
}: ModelSelectorPopoverProps) {
    const { t } = useTranslation();
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
        // 复用进行中的模型列表请求，避免重复打开菜单时重复加载。
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

        // 并行检测两个运行时，并且仅允许最新一次检测更新界面。
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
        ? `${t(`header.engines.${selectedEngine}`)} · ${selectedModel}`
        : t('header.selectModel');

    const handleOllamaSelect = (model: string) => {
        if (disabled) return;

        if (!ollamaStatus.isAlive) {
            setErrorMessage(t('modelSelector.ollamaConnectionError'));
            return;
        }

        onSelectEngine('ollama', model);
        setIsOpen(false);
    };

    const handleReconnect = async () => {
        if (disabled) return;

        setErrorMessage(t('modelSelector.ollamaConnectionError'));
        setOllamaStatus((status) => ({ ...status, loading: true }));
        setIsCheckingWebGPU(true);
        const result = await refreshHealth();
        if (result.isAlive) {
            setErrorMessage(null);
        }
    };

    return (
        <div className="relative inline-block max-w-full" ref={popoverRef}>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                disabled={disabled}
                onClick={() => {
                    if (disabled) return;

                    if (!isOpen) {
                        beginHealthCheck();
                        loadWebGPUModels();
                    }
                    setIsOpen(!isOpen);
                }}
                className="flex max-w-full items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-all hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            >
                {!selectedModel || selectedIsOffline ? (
                    <span
                        className="h-2 w-2 rounded-full bg-red-500"
                        aria-label={
                            selectedModel
                                ? t('header.status.offline')
                                : t('header.selectModel')
                        }
                    />
                ) : selectedEngine === 'ollama' && ollamaStatus.loading ? (
                    <LoaderCircle className="h-3 w-3 animate-spin text-zinc-400" aria-label={t('header.status.loading')} />
                ) : selectedEngine === 'ollama' ? (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label={t('header.status.ready')} />
                ) : isWebLLMLoading ? (
                    <span
                        className="h-2.5 w-2.5 animate-spin rounded-full border border-blue-400/30 border-t-blue-400"
                        aria-label={t('header.status.loading')}
                    />
                ) : isWebLLMReady ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" aria-label={t('header.status.ready')} />
                ) : (
                    <span className="h-2 w-2 rounded-full bg-zinc-600" aria-label={t('header.status.offline')} />
                )}
                <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
                <ChevronDown
                    className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-xl shadow-black/40"
                    role="listbox"
                    aria-label={t('header.selectModel')}
                >
                    <div className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold tracking-[0.14em] text-zinc-500">
                        {t('modelSelector.localEndpoints')}
                    </div>
                    {ollamaStatus.loading ? (
                        <div className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-zinc-500">
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                            {t('modelSelector.checkingOllama')}
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
                                        disabled={disabled}
                                        onClick={() => handleOllamaSelect(model)}
                                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:bg-zinc-800/70 focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
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
                                {t('modelSelector.noOllamaModels')}
                            </p>
                        )
                    ) : (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => void handleReconnect()}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-amber-400 transition-colors hover:bg-zinc-800/70 focus-visible:bg-zinc-800/70 focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                            {t('header.status.offline')} · {t('modelSelector.reconnect')}
                        </button>
                    )}

                    <div className="mx-2 my-1.5 border-t border-zinc-800" />
                    <div className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-1 text-[10px] font-semibold tracking-[0.14em] text-zinc-500">
                        <Sparkles className="h-3 w-3 text-blue-400" aria-hidden="true" />
                        {t('modelSelector.inBrowserWebgpu')}
                    </div>
                    {isLoadingWebGPUModels ? (
                        <div className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-zinc-500">
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                            {t('modelSelector.loadingWebgpuModels')}
                        </div>
                    ) : webGPUModelsError ? (
                        <p className="px-2.5 py-2 text-xs text-red-400" role="alert">
                            {webGPUModelsError}
                        </p>
                    ) : webGPUModels.length === 0 ? (
                        <p className="px-2.5 py-2 text-xs text-zinc-500">
                            {t('modelSelector.noChatModels')}
                        </p>
                    ) : (
                        webGPUModels.map((option) => {
                            const isSelected =
                                selectedEngine === 'webgpu' &&
                                selectedModel === option.model;
                            const isDisabled =
                                disabled ||
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
                                            ? t('modelSelector.unsupportedWebgpu')
                                            : isWebLLMLoading
                                                ? t('modelSelector.modelSwitchDuringLoad')
                                                : option.model
                                    }
                                    disabled={isDisabled}
                                    onClick={() => {
                                        onSelectEngine('webgpu', option.model);
                                        setIsOpen(false);
                                    }}
                                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none ${isDisabled
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
