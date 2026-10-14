/*
 * @Description: 提供聊天提示词预设的选择、新建、编辑与删除功能。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-09 14:57:13
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:28:23
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\PromptPresetSelector.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    PROMPT_PRESETS,
    type PromptPreset,
    type PromptPresetId,
} from "../../core/providers/presets";

interface PromptPresetSelectorProps {
    presetId: PromptPresetId;
    presets: PromptPreset[];
    disabled: boolean;
    onPresetChange: (presetId: PromptPresetId) => void;
    onSavePreset: (
        name: string,
        prompt: string,
        id?: string,
    ) => Promise<PromptPreset>;
    onDeletePreset: (id: string) => Promise<void>;
}

/**
 * 渲染当前提示词预设选择器及自定义预设管理界面。
 * @param props 预设数据、选择状态及持久化操作回调。
 * @returns 预设选择器，以及打开时显示的管理对话框。
 */
export function PromptPresetSelector({
    presetId,
    presets,
    disabled,
    onPresetChange,
    onSavePreset,
    onDeletePreset,
}: PromptPresetSelectorProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [isManaging, setIsManaging] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [prompt, setPrompt] = useState("");
    const [error, setError] = useState("");
    const selectorRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPosition, setMenuPosition] = useState<{
        left: number;
        top: number;
    } | null>(null);
    const builtInNames = new Map<string, string>([
        ["code-assistant", t("prompts.presets.codeAssistant")],
        ["translator", t("prompts.presets.translator")],
    ]);
    const editingPreset = presets.find((preset) => preset.id === editingId);
    const availablePresets = [
        ...PROMPT_PRESETS,
        ...presets.filter((item) => !item.builtIn),
    ];
    const selectedPreset = availablePresets.find((item) => item.id === presetId);
    const selectedPresetName = selectedPreset
        ? builtInNames.get(selectedPreset.id) ?? selectedPreset.name
        : t("prompts.label");

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (
                target instanceof Node &&
                !selectorRef.current?.contains(target) &&
                !menuRef.current?.contains(target)
            ) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    useLayoutEffect(() => {
        if (!isOpen) return;

        const updateMenuPosition = () => {
            const trigger = triggerRef.current;
            if (!trigger) return;

            const bounds = trigger.getBoundingClientRect();
            const menuWidth = 240;
            setMenuPosition({
                left: Math.min(
                    Math.max(8, bounds.left),
                    Math.max(8, window.innerWidth - menuWidth - 8),
                ),
                top: bounds.bottom,
            });
        };

        updateMenuPosition();
        window.addEventListener("resize", updateMenuPosition);
        window.addEventListener("scroll", updateMenuPosition, true);
        return () => {
            window.removeEventListener("resize", updateMenuPosition);
            window.removeEventListener("scroll", updateMenuPosition, true);
        };
    }, [isOpen]);

    function beginCreate() {
        setEditingId(null);
        setName("");
        setPrompt("");
        setError("");
    }

    function beginEdit(preset: PromptPreset) {
        setEditingId(preset.id);
        setName(preset.name);
        setPrompt(preset.prompt);
        setError("");
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        try {
            const saved = await onSavePreset(name, prompt, editingId ?? undefined);
            onPresetChange(saved.id);
            setEditingId(null);
            setName("");
            setPrompt("");
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : t("prompts.saveFailed"),
            );
        }
    }

    async function handleDelete(preset: PromptPreset) {
        if (!window.confirm(t("prompts.confirmDelete", { name: preset.name }))) {
            return;
        }
        setError("");
        try {
            await onDeletePreset(preset.id);
            if (preset.id === presetId) {
                onPresetChange("code-assistant");
            }
            if (editingId === preset.id) beginCreate();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : t("prompts.deleteFailed"),
            );
        }
    }

    return (
        <>
            <div
                ref={selectorRef}
                className="flex items-center gap-2 whitespace-nowrap shrink-0 select-none"
            >
                <label className="sr-only" htmlFor="prompt-preset">
                    {t("prompts.label")}
                </label>
                <button
                    ref={triggerRef}
                    id="prompt-preset"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    disabled={disabled}
                    onClick={() => setIsOpen((open) => !open)}
                    className="h-8 px-3 inline-flex items-center justify-center gap-1.5 leading-none rounded-full text-xs font-medium border border-zinc-700/60 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700/80 transition-all shrink-0 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="max-w-36 truncate leading-none">{selectedPresetName}</span>
                    <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                    />
                </button>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        setIsOpen(false);
                        setIsManaging(true);
                        beginCreate();
                    }}
                    className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-medium border border-zinc-700/60 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700/80 transition-all shrink-0 select-none cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {t("prompts.manage")}
                </button>
            </div>

            {isOpen && menuPosition && createPortal(
                <div
                    className="fixed z-50"
                    style={{
                        left: menuPosition.left,
                        top: menuPosition.top,
                    }}
                >
                    <div
                        ref={menuRef}
                        className="z-50 absolute top-full left-0 mt-2 min-w-[180px] max-w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-zinc-800/90 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
                        role="listbox"
                        aria-label={t("prompts.label")}
                    >
                        {availablePresets.map((preset) => {
                            const isSelected = preset.id === presetId;
                            const label =
                                builtInNames.get(preset.id) ?? preset.name;

                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                        onPresetChange(preset.id);
                                        setIsOpen(false);
                                    }}
                                    className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-800/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 ${
                                        isSelected
                                            ? "bg-emerald-500/10 font-medium text-emerald-400"
                                            : "text-zinc-300"
                                    }`}
                                >
                                    <span className="truncate">{label}</span>
                                    {isSelected && (
                                        <Check
                                            className="ml-3 size-3.5 shrink-0 text-emerald-400"
                                            aria-hidden="true"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body,
            )}

            {isManaging &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setIsManaging(false);
                            }
                        }}
                    >
                        <section
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="prompt-manager-title"
                            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl"
                        >
                            <header className="mb-4 flex items-center gap-3">
                                <h2
                                    id="prompt-manager-title"
                                    className="flex-1 text-base font-semibold text-zinc-100"
                                >
                                    {t("prompts.manage")}
                                </h2>
                                <button
                                    type="button"
                                    aria-label={t("common.close")}
                                    onClick={() => setIsManaging(false)}
                                    className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            </header>

                            <div className="grid gap-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                                <div>
                                    <button
                                        type="button"
                                        onClick={beginCreate}
                                        className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
                                    >
                                        <Plus className="size-4" aria-hidden="true" />
                                        {t("prompts.create")}
                                    </button>
                                    <ul className="space-y-1">
                                        {presets
                                            .filter((item) => !item.builtIn)
                                            .map((item) => (
                                                <li
                                                    key={item.id}
                                                    className="flex items-center gap-1 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-2 py-1.5 transition-colors hover:border-zinc-700"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => beginEdit(item)}
                                                        className="min-w-0 flex-1 truncate px-1 text-left text-sm text-zinc-300 hover:text-white"
                                                        title={item.name}
                                                    >
                                                        {item.name}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={t("prompts.editPreset", {
                                                            name: item.name,
                                                        })}
                                                        onClick={() => beginEdit(item)}
                                                        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                                                    >
                                                        <Pencil
                                                            className="size-3.5"
                                                            aria-hidden="true"
                                                        />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={t(
                                                            "prompts.deletePreset",
                                                            { name: item.name },
                                                        )}
                                                        onClick={() =>
                                                            void handleDelete(item)
                                                        }
                                                        className="rounded p-1.5 text-zinc-500 hover:bg-red-950 hover:text-red-300"
                                                    >
                                                        <Trash2
                                                            className="size-3.5"
                                                            aria-hidden="true"
                                                        />
                                                    </button>
                                                </li>
                                            ))}
                                        {presets.every((item) => item.builtIn) && (
                                            <li className="px-2 py-3 text-xs text-zinc-500">
                                                {t("prompts.noCustomPresets")}
                                            </li>
                                        )}
                                    </ul>
                                </div>

                                <form className="space-y-3" onSubmit={handleSave}>
                                    <h3 className="text-sm font-medium text-zinc-200">
                                        {editingId
                                            ? t("prompts.editing", {
                                                name: editingPreset?.name ?? name,
                                            })
                                            : t("prompts.newPreset")}
                                    </h3>
                                    <label className="block space-y-1 text-xs text-zinc-400">
                                        <span>{t("prompts.name")}</span>
                                        <input
                                            autoComplete="off"
                                            required
                                            maxLength={60}
                                            value={name}
                                            onChange={(event) =>
                                                setName(event.target.value)
                                            }
                                            className="w-full rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-600 focus-visible:ring-2 focus-visible:ring-zinc-600"
                                        />
                                    </label>
                                    <label className="block space-y-1 text-xs text-zinc-400">
                                        <span>{t("prompts.instructions")}</span>
                                        <textarea
                                            required
                                            rows={8}
                                            value={prompt}
                                            onChange={(event) =>
                                                setPrompt(event.target.value)
                                            }
                                            className="w-full resize-y rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 text-sm leading-5 text-zinc-100 outline-none transition focus:border-zinc-600 focus-visible:ring-2 focus-visible:ring-zinc-600"
                                        />
                                    </label>
                                    {error && (
                                        <p className="text-xs text-red-300" role="alert">
                                            {error}
                                        </p>
                                    )}
                                    <button
                                        type="submit"
                                        className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                                    >
                                        {t("prompts.save")}
                                    </button>
                                </form>
                            </div>
                        </section>
                    </div>,
                    document.body,
                )}
        </>
    );
}
