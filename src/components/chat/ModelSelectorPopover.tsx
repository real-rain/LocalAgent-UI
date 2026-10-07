/*
 * @Description: 模型选择弹出框
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 21:49:06
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 21:50:52
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\ModelSelectorPopover.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Cpu, Server, Sparkles } from 'lucide-react';

export interface ModelSelectorPopoverProps {
    selectedEngine: 'ollama' | 'webgpu';
    selectedModel: string;
    isWebLLMReady: boolean;
    isWebLLMLoading: boolean;
    onSelectEngine: (engine: 'ollama' | 'webgpu', model: string) => void;
}

const modelOptions = [
    {
        engine: 'ollama',
        model: 'qwen2.5',
        label: 'Qwen 2.5',
        icon: Server,
    },
    {
        engine: 'ollama',
        model: 'deepseek-r1',
        label: 'DeepSeek R1 Local',
        icon: Server,
    },
    {
        engine: 'webgpu',
        model: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        label: 'Llama 3.2 1B',
        icon: Cpu,
    },
    {
        engine: 'webgpu',
        model: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
        label: 'Qwen 2.5 0.5B',
        icon: Cpu,
    },
] as const;

export function ModelSelectorPopover({
    selectedEngine,
    selectedModel,
    isWebLLMReady,
    isWebLLMLoading,
    onSelectEngine,
}: ModelSelectorPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const selectedOption = modelOptions.find(
        (option) => option.engine === selectedEngine && option.model === selectedModel,
    );
    const engineLabel = selectedEngine === 'ollama' ? 'Ollama' : 'WebGPU';
    const triggerLabel = selectedOption
        ? `${engineLabel} · ${selectedOption.label}`
        : `${engineLabel} · ${selectedModel}`;

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

    return (
        <div className="relative inline-block" ref={popoverRef}>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-all hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            >
                {selectedEngine === 'ollama' ? (
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
                    className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-xl shadow-black/40"
                    role="listbox"
                    aria-label="选择模型"
                >
                    <div className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold tracking-[0.14em] text-zinc-500">
                        LOCAL ENDPOINTS
                    </div>
                    {modelOptions
                        .filter((option) => option.engine === 'ollama')
                        .map((option) => {
                            const Icon = option.icon;
                            const isSelected = selectedEngine === option.engine && selectedModel === option.model;

                            return (
                                <button
                                    key={option.model}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                        onSelectEngine(option.engine, option.model);
                                        setIsOpen(false);
                                    }}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:bg-zinc-800/70 focus-visible:outline-none"
                                >
                                    <Icon className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                                    <span className="flex-1">{option.label}</span>
                                    {isSelected && <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />}
                                </button>
                            );
                        })}

                    <div className="mx-2 my-1.5 border-t border-zinc-800" />
                    <div className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-1 text-[10px] font-semibold tracking-[0.14em] text-zinc-500">
                        <Sparkles className="h-3 w-3 text-blue-400" aria-hidden="true" />
                        IN-BROWSER WEBGPU
                    </div>
                    {modelOptions
                        .filter((option) => option.engine === 'webgpu')
                        .map((option) => {
                            const Icon = option.icon;
                            const isSelected = selectedEngine === option.engine && selectedModel === option.model;

                            return (
                                <button
                                    key={option.model}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                        onSelectEngine(option.engine, option.model);
                                        setIsOpen(false);
                                    }}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:bg-zinc-800/70 focus-visible:outline-none"
                                >
                                    <Icon className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                                    <span className="flex-1">{option.label}</span>
                                    {isSelected && <Check className="h-4 w-4 text-blue-400" aria-hidden="true" />}
                                </button>
                            );
                        })}
                </div>
            )}
        </div>
    );
}