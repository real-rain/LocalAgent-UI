/*
 * @Description: 代码 Preview 预览沙盒
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 20:08:31
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 20:10:29
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\agent\CodeArtifactBox.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Maximize2, Minimize2, X } from "lucide-react";
import hljs from "highlight.js/lib/common";
import { useTranslation } from "react-i18next";
import { wrapSandboxHtml } from "../../core/utils/sandboxTemplate";

interface CodeArtifactBoxProps {
    language: string;
    code: string;
    previewCode?: string;
    title?: string;
    initialView?: ArtifactTab;
    onClose?: () => void;
}

type ArtifactTab = "code" | "preview";

const PREVIEW_LANGUAGES = new Set([
    "html",
    "svg",
    "css",
    "js",
    "javascript",
    "react",
]);

/**
 * 渲染代码产物，并提供复制、全屏及受支持的预览操作。
 * @param props 代码语言、源代码、可选预览代码与标题。
 * @returns 代码产物面板。
 */
export function CodeArtifactBox({
    language,
    code,
    previewCode,
    title,
    initialView = "code",
    onClose,
}: CodeArtifactBoxProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<ArtifactTab>(initialView);
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const supportsPreview = PREVIEW_LANGUAGES.has(language.toLowerCase());
    const sandboxHtml = useMemo(
        () => wrapSandboxHtml(previewCode ?? code, language),
        [previewCode, code, language],
    );
    // 将语言别名映射为 highlight.js 支持的名称；找不到对应语法时使用自动识别。
    const highlightedCode = useMemo(() => {
        const normalizedLanguage =
            language.toLowerCase() === "html" || language.toLowerCase() === "svg"
                ? "xml"
                : language.toLowerCase() === "js"
                    ? "javascript"
                    : language.toLowerCase();
        try {
            return hljs.getLanguage(normalizedLanguage)
                ? hljs.highlight(code, {
                    language: normalizedLanguage,
                    ignoreIllegals: true,
                }).value
                : hljs.highlightAuto(code).value;
        } catch {
            return hljs.highlightAuto(code).value;
        }
    }, [code, language]);

    useEffect(() => {
        function handleFullscreenChange() {
            setIsFullscreen(document.fullscreenElement === containerRef.current);
        }

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    const handleToggleFullscreen = async () => {
        if (!containerRef.current) return;
        try {
            if (!document.fullscreenElement) {
                await containerRef.current.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error("Fullscreen error:", err);
        }
    };

    async function copyCode() {
        try {
            await navigator.clipboard.writeText(code);
            setCopyStatus("copied");
            window.setTimeout(() => setCopyStatus("idle"), 2000);
        } catch {
            setCopyStatus("error");
        }
    }

    const showingPreview = supportsPreview && activeTab === "preview";

    return (
        <div
            ref={containerRef}
            className={`overflow-hidden border border-zinc-200 bg-white text-left text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-950 fullscreen:fixed fullscreen:inset-0 fullscreen:z-50 fullscreen:bg-zinc-950 ${isFullscreen ? "flex h-screen flex-col rounded-none" : "rounded-lg"}`}
        >
            <header className="flex min-h-11 items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
                <span className="shrink-0 rounded bg-zinc-200 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {language}
                </span>
                {title && (
                    <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                        {title}
                    </span>
                )}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                    {showingPreview && (
                        <button
                            type="button"
                            onClick={handleToggleFullscreen}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                            aria-label={isFullscreen ? t("common.exitFullscreen") : t("common.fullscreen")}
                            title={isFullscreen ? t("common.exitFullscreen") : t("common.fullscreen")}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="size-3.5" aria-hidden="true" />
                            ) : (
                                <Maximize2 className="size-3.5" aria-hidden="true" />
                            )}
                        </button>
                    )}
                    {supportsPreview && (
                        <div className="mr-1 flex rounded-md bg-zinc-200 p-0.5 dark:bg-zinc-800" role="tablist" aria-label={t("chat.artifactView")}>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === "code"}
                                className={`rounded px-2 py-1 text-xs transition-colors ${activeTab === "code" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
                                onClick={() => {
                                    setActiveTab("code");
                                    if (document.fullscreenElement === containerRef.current) {
                                        void document.exitFullscreen().catch((error: unknown) => {
                                            console.error("Unable to exit fullscreen for code preview.", error);
                                        });
                                    }
                                }}
                            >
                                {t("chat.code")}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === "preview"}
                                className={`rounded px-2 py-1 text-xs transition-colors ${activeTab === "preview" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
                                onClick={() => setActiveTab("preview")}
                            >
                                {t("chat.preview")}
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={copyCode}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        aria-label={copyStatus === "copied" ? t("chat.codeCopied") : t("chat.copyCode")}
                    >
                        {copyStatus === "copied" ? (
                            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        ) : (
                            <Copy className="size-3.5" aria-hidden="true" />
                        )}
                        {copyStatus === "copied" ? t("chat.codeCopied") : t("common.copy")}
                    </button>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                            aria-label={t("common.close")}
                            title={t("common.close")}
                        >
                            <X className="size-3.5" aria-hidden="true" />
                        </button>
                    )}
                </div>
            </header>

            {copyStatus === "error" && (
                <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" role="alert">
                    {t("chat.copyCodeError")}
                </p>
            )}

            {showingPreview ? (
                <div className={`bg-white ${isFullscreen ? "min-h-0 flex-1" : ""}`}>
                    <iframe
                        key="preview-iframe"
                        title={t("chat.previewTitle", {
                            title: title ?? language,
                        })}
                        className={`w-full border-0 bg-white ${isFullscreen ? "h-full" : "h-[450px] rounded-b-lg"}`}
                        srcDoc={sandboxHtml}
                        sandbox="allow-scripts allow-modals"
                    />
                </div>
            ) : (
                <pre className="m-0 overflow-x-auto whitespace-pre bg-zinc-950 p-4 text-sm leading-6 text-zinc-100">
                    <code
                        className={`hljs !block !bg-transparent !p-0 !text-inherit !text-sm !leading-6 language-${language.toLowerCase()}`}
                        dangerouslySetInnerHTML={{ __html: highlightedCode }}
                    >
                    </code>
                </pre>
            )}
        </div>
    );
}

export default CodeArtifactBox;