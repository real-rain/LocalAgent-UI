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
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Maximize2, Minimize2 } from "lucide-react";
import { wrapSandboxHtml } from "../../core/utils/sandboxTemplate";

interface CodeArtifactBoxProps {
    language: string;
    code: string;
    title?: string;
}

type ArtifactTab = "code" | "preview";

const PREVIEW_LANGUAGES = new Set(["html", "javascript", "jsx", "svg"]);

export function CodeArtifactBox({ language, code, title }: CodeArtifactBoxProps) {
    const [activeTab, setActiveTab] = useState<ArtifactTab>("code");
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
    const [isMaximized, setIsMaximized] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const supportsPreview = PREVIEW_LANGUAGES.has(language.toLowerCase());

    useEffect(() => {
        if (!isMaximized) {
            return;
        }

        iframeRef.current?.style.removeProperty("height");

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsMaximized(false);
            }
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isMaximized]);

    function adjustPreviewHeight() {
        const iframe = iframeRef.current;
        if (!iframe) {
            return;
        }

        try {
            const documentHeight = iframe.contentWindow?.document.body.scrollHeight;
            if (documentHeight && documentHeight > 0) {
                iframe.style.height = `${documentHeight}px`;
            }
        } catch (error) {
            console.warn("Unable to measure sandboxed preview height; iframe scrolling remains enabled.", error);
        }
    }

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
        <section className={`${isMaximized ? "fixed inset-3 z-50 flex flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 text-left text-sm shadow-2xl" : "overflow-hidden rounded-lg border border-zinc-200 bg-white text-left text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-950"}`}>
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
                            onClick={() => setIsMaximized((maximized) => !maximized)}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                            aria-label={isMaximized ? "Restore preview" : "Maximize preview"}
                            title={isMaximized ? "Restore preview" : "Maximize preview"}
                        >
                            {isMaximized ? (
                                <Minimize2 className="size-3.5" aria-hidden="true" />
                            ) : (
                                <Maximize2 className="size-3.5" aria-hidden="true" />
                            )}
                        </button>
                    )}
                    {supportsPreview && (
                        <div className="mr-1 flex rounded-md bg-zinc-200 p-0.5 dark:bg-zinc-800" role="tablist" aria-label="Artifact view">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === "code"}
                                className={`rounded px-2 py-1 text-xs transition-colors ${activeTab === "code" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
                                onClick={() => {
                                    setActiveTab("code");
                                    setIsMaximized(false);
                                }}
                            >
                                Code
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === "preview"}
                                className={`rounded px-2 py-1 text-xs transition-colors ${activeTab === "preview" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
                                onClick={() => setActiveTab("preview")}
                            >
                                Preview
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={copyCode}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        aria-label={copyStatus === "copied" ? "Code copied" : "Copy code"}
                    >
                        {copyStatus === "copied" ? (
                            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        ) : (
                            <Copy className="size-3.5" aria-hidden="true" />
                        )}
                        {copyStatus === "copied" ? "Copied" : "Copy"}
                    </button>
                </div>
            </header>

            {copyStatus === "error" && (
                <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" role="alert">
                    Unable to copy code. Please copy it manually.
                </p>
            )}

            {showingPreview ? (
                <div className={`border border-zinc-800 bg-zinc-950 ${isMaximized ? "min-h-0 flex-1" : "h-[50vh] min-h-[350px] max-h-[600px] resize-y overflow-y-auto"}`}>
                    <iframe
                        ref={iframeRef}
                        title={title ? `${title} preview` : `${language} preview`}
                        className="h-full w-full rounded-b-lg border-0 bg-zinc-950"
                        srcDoc={wrapSandboxHtml(code, language)}
                        sandbox="allow-scripts"
                        onLoad={adjustPreviewHeight}
                    />
                </div>
            ) : (
                <pre className="m-0 overflow-x-auto whitespace-pre bg-zinc-950 p-4 text-sm leading-6 text-zinc-100">
                    <code className="!block !bg-transparent !p-0 !text-inherit !text-sm !leading-6">
                        {code}
                    </code>
                </pre>
            )}
        </section>
    );
}

export default CodeArtifactBox;