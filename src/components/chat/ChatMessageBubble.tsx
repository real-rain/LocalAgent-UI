/*
 * @Description: 渲染聊天消息、Markdown 代码产物、推理过程与工具调用结果。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 20:03:10
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 17:42:46
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\ChatMessageBubble.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Copy, ExternalLink, RotateCcw } from "lucide-react";
import hljs from "highlight.js/lib/common";
import ThoughtAccordion from "../agent/ThoughtAccordion";
import ToolCallCard from "../agent/ToolCallCard";
import { MermaidDiagram } from "./MermaidDiagram";
import type { Message } from "../../types/chat";
import { useChatStore } from "../../store/useChatStore";
import "./ChatMessageBubble.css";

interface ChatMessageBubbleProps {
    message: Message;
    onToolApprove?: (toolCallId: string) => void;
    onToolReject?: (toolCallId: string) => void;
    onRetry?: (messageId: string) => void;
}

interface MarkdownCodeBlock {
    language: string;
    code: string;
}

/**
 * 从 Markdown 中提取围栏代码块，用于组合 HTML 预览。
 * @param markdown Markdown 源文本。
 * @returns 按源文本顺序排列且语言名称已规范化的代码块。
 */
function extractMarkdownCodeBlocks(markdown: string): MarkdownCodeBlock[] {
    const lines = markdown.split(/\r?\n/);
    const blocks: MarkdownCodeBlock[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const openingFence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[index]);
        if (!openingFence) continue;

        const fence = openingFence[1];
        const language = openingFence[2].trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
        const codeLines: string[] = [];
        const closingFence = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`);
        index += 1;

        while (index < lines.length && !closingFence.test(lines[index])) {
            codeLines.push(lines[index]);
            index += 1;
        }

        blocks.push({ language, code: codeLines.join("\n") });
    }

    return blocks;
}

/**
 * 优先将标记插入指定文档标签的闭合标签之前，并在必要时尝试备用标签。
 * @param html HTML 文档标记。
 * @param tag 首选的目标元素。
 * @param content 要插入的标记内容。
 * @returns 插入内容后的标记；找不到目标标签时将内容追加到末尾。
 */
function insertBeforeTagEnd(
    html: string,
    tag: "head" | "body",
    content: string,
): string {
    const fallbackTags = tag === "head" ? ["body", "html"] : ["html"];
    for (const targetTag of [tag, ...fallbackTags]) {
        const closingTag = new RegExp(`</${targetTag}\\s*>`, "i");
        if (closingTag.test(html)) {
            return html.replace(closingTag, `${content}\n$&`);
        }
    }

    return `${html}\n${content}`;
}

/**
 * 将分开的 HTML、CSS 与 JavaScript 代码块组合为 HTML 预览文档。
 * @param blocks 从 Markdown 中提取的代码块。
 * @returns 能附加额外资源时返回组合后的 HTML，否则返回 undefined。
 */
function createCombinedHtml(blocks: MarkdownCodeBlock[]): string | undefined {
    const htmlBlock = blocks.find((block) => block.language === "html");
    if (!htmlBlock) return undefined;

    const cssCode = blocks
        .filter((block) => block.language === "css")
        .map((block) => block.code)
        .filter(Boolean)
        .join("\n");
    const jsCode = blocks
        .filter((block) => block.language === "javascript" || block.language === "js")
        .map((block) => block.code)
        .filter(Boolean)
        .join("\n");

    let combinedHtml = htmlBlock.code;
    const hasStylesheet =
        /<style\b/i.test(combinedHtml) ||
        /<link\b[^>]*\brel\s*=\s*["']?stylesheet\b/i.test(combinedHtml);
    const hasScript = /<script\b/i.test(combinedHtml);

    // 仅当 HTML 代码块尚未包含样式或脚本时，才附加分离的资源。
    if (cssCode && !hasStylesheet) {
        const styleTag = `<style>\n${cssCode.replace(/<\/style/gi, "<\\/style")}\n</style>`;
        combinedHtml = insertBeforeTagEnd(combinedHtml, "head", styleTag);
    }
    if (jsCode && !hasScript) {
        const scriptTag = `<script>\n${jsCode.replace(/<\/script/gi, "<\\/script")}\n</script>`;
        combinedHtml = insertBeforeTagEnd(combinedHtml, "body", scriptTag);
    }

    return combinedHtml === htmlBlock.code ? undefined : combinedHtml;
}

/**
 * 创建 React Markdown 渲染器，并将组合预览分配给对应的 HTML 代码块。
 * @param previewHtml 由相邻代码块组合而成的可选 HTML 文档。
 * @returns Markdown 代码元素的组件覆盖配置。
 */
const SANDBOX_LANGUAGES = new Set([
    "html",
    "css",
    "js",
    "javascript",
    "svg",
]);

interface MarkdownCodeBlockProps {
    language: string;
    code: string;
    previewCode?: string;
}

function MarkdownCodeBlock({ language, code, previewCode }: MarkdownCodeBlockProps) {
    const { t } = useTranslation();
    const [copyStatus, setCopyStatus] = useState<"copied" | "error" | null>(null);
    const setActiveArtifact = useChatStore((state) => state.setActiveArtifact);
    const supportsSandbox = SANDBOX_LANGUAGES.has(language.toLowerCase());
    const highlightedCode = useMemo(() => {
        const normalizedLanguage =
            language.toLowerCase() === "html"
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
        if (!copyStatus) return;
        const timeout = window.setTimeout(() => setCopyStatus(null), 2000);
        return () => window.clearTimeout(timeout);
    }, [copyStatus]);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(code);
            setCopyStatus("copied");
        } catch {
            setCopyStatus("error");
        }
    }

    return (
        <div className="group my-3 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/80 text-left text-sm shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
            <header className="flex min-h-10 items-center gap-3 border-b border-zinc-800/80 bg-zinc-900/70 px-3 py-2">
                <span className="shrink-0 rounded-md border border-zinc-700/70 bg-zinc-800/70 px-2 py-0.5 font-mono text-xs text-zinc-300">
                    {language || "text"}
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                    {supportsSandbox && (
                        <button
                            type="button"
                            onClick={() => setActiveArtifact({ code, language, previewCode })}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-300 opacity-100 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 group-focus-within:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                        >
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                            {t("chat.openInSandbox")}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => void handleCopy()}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                        aria-label={copyStatus === "copied" ? "Copied!" : t("chat.copyCode")}
                        title={copyStatus === "copied" ? "Copied!" : t("chat.copyCode")}
                    >
                        {copyStatus === "copied" ? (
                            <>
                                <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="size-3.5" aria-hidden="true" />
                                {t("common.copy")}
                            </>
                        )}
                    </button>
                </div>
            </header>
            {copyStatus === "error" && (
                <p
                    className="border-b border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300"
                    role="alert"
                >
                    {t("chat.copyCodeError")}
                </p>
            )}
            <pre className="m-0 overflow-x-auto whitespace-pre p-4 text-sm leading-6 text-zinc-100">
                <code
                    className={`hljs !block !bg-transparent !p-0 !text-inherit !text-sm !leading-6 ${language ? `language-${language.toLowerCase()}` : ""}`}
                    dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
            </pre>
        </div>
    );
}

function createMarkdownComponents(
    previewHtml?: string,
    isStreaming = false,
): Components {
    let previewAssigned = false;

    return {
        code({ children, className, ...props }) {
            const matchLang = /language-(\w+)/.exec(className || "");
            const codeContent = String(children).replace(/\n$/, "");
            let language = matchLang ? matchLang[1] : "";

            if (
                !language &&
                /<!DOCTYPE html>|<html\b|<(?:style|script)\b/i.test(codeContent)
            ) {
                language = "html";
            }

            const isCodeBlock =
                Boolean(matchLang) ||
                codeContent.includes("\n") ||
                String(children).endsWith("\n");

            if (isCodeBlock) {
                if (language.toLowerCase() === "mermaid") {
                    return (
                        <MermaidDiagram
                            source={codeContent}
                            isStreaming={isStreaming}
                        />
                    );
                }

                const useCombinedPreview =
                    !previewAssigned && language.toLowerCase() === "html" && previewHtml;
                if (useCombinedPreview) previewAssigned = true;

                return (
                    <MarkdownCodeBlock
                        language={language}
                        code={codeContent}
                        previewCode={useCombinedPreview ? previewHtml : undefined}
                    />
                );
            }

            return (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        },
    };
}

function getErrorMessage(content: string): string {
    try {
        const parsed: unknown = JSON.parse(content);
        if (
            typeof parsed === "object" &&
            parsed !== null &&
            "error" in parsed &&
            typeof parsed.error === "string"
        ) {
            return parsed.error;
        }
    } catch {
        return content;
    }

    return content;
}

/**
 * 显示消息生成过程中的实时或最终耗时与吞吐量。
 * @param props 可选包含生成性能数据的消息。
 * @returns 存在性能数据时返回性能页脚，否则返回 null。
 */
function MessagePerformanceFooter({ message }: ChatMessageBubbleProps) {
    const performance = message.performance;
    const startTime = performance?.startTime;
    const isStreaming = message.status === "streaming";
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (startTime === undefined || !isStreaming) return;

        const timer = window.setInterval(() => setNow(Date.now()), 100);
        return () => window.clearInterval(timer);
    }, [isStreaming, startTime]);

    if (!performance) return null;

    const endTime = performance.endTime ?? (isStreaming ? now : performance.startTime);
    const generationTime = Math.max(0, (endTime - performance.startTime) / 1000);
    const tokensPerSecond =
        generationTime > 0 ? performance.totalTokens / generationTime : 0;
    const engineName = performance.engine === "webgpu" ? "WebGPU" : "Ollama";

    return (
        <footer className="mt-2 flex justify-end">
            <span className="text-xs font-mono text-zinc-500 opacity-80 transition-opacity hover:opacity-100">
                ⚡ {tokensPerSecond.toFixed(1)} t/s · {generationTime.toFixed(1)}s ·{" "}
                {engineName} ({performance.model})
            </span>
        </footer>
    );
}

/**
 * 渲染聊天消息，以及仅助手消息包含的推理内容、工具调用与性能数据。
 * @param props 要渲染的消息。
 * @returns 格式化后的聊天消息；已完成且内容为空的助手消息返回 null。
 */
export function ChatMessageBubble({
    message,
    onToolApprove,
    onToolReject,
    onRetry,
}: ChatMessageBubbleProps) {
    const { t } = useTranslation();
    const isAssistant = message.role === "assistant";
    const isStreaming = message.status === "streaming";
    const previewHtml = createCombinedHtml(extractMarkdownCodeBlocks(message.content));
    const markdownComponents = createMarkdownComponents(previewHtml, isStreaming);
    const uniqueToolCalls = message.toolCalls
        ? [...new Map(message.toolCalls.map((toolCall) => [toolCall.id, toolCall])).values()]
        : [];

    if (
        isAssistant &&
        !isStreaming &&
        !message.content.trim() &&
        !message.thoughtProcess?.trim() &&
        !message.toolCalls?.length &&
        message.status !== "error"
    ) {
        return null;
    }

    return (
        <div
            className={`chat-message chat-message--${message.role}`}
            data-role={message.role}
        >
            <article className="chat-message__bubble">
                {isAssistant && (
                    <div className="chat-message__section">
                        <ThoughtAccordion message={message} />
                    </div>
                )}

                {isAssistant && uniqueToolCalls.length > 0 && (
                    <div className="chat-message__section chat-message__tool-calls">
                        {uniqueToolCalls.map((toolCall, index) => (
                            <ToolCallCard
                                key={toolCall.id || `${toolCall.name}-${index}`}
                                toolCall={toolCall}
                                onApprove={onToolApprove}
                                onReject={onToolReject}
                            />
                        ))}
                    </div>
                )}

                {isAssistant && message.status === "interrupted" && (
                    <p
                        className="mb-3 rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200"
                        role="status"
                    >
                        {t("chat.interruptedResponse")}
                    </p>
                )}

                {isAssistant && message.status === "error" ? (
                    <section
                        className="mt-3 rounded-lg border border-amber-800/70 bg-amber-950/30 p-4 text-amber-100"
                        role="alert"
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangle
                                className="mt-0.5 size-5 shrink-0 text-amber-400"
                                aria-hidden="true"
                            />
                            <div className="min-w-0">
                                <h3 className="font-semibold">
                                    {t("chat.requestFailed")}
                                </h3>
                                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-amber-100/90">
                                    {getErrorMessage(message.content) ||
                                        t("chat.requestFailed")}
                                </p>
                                <p className="mt-2 text-xs text-amber-200/75">
                                    {t("chat.requestFailedHelp")}
                                </p>
                                {onRetry && (
                                    <button
                                        type="button"
                                        onClick={() => onRetry(message.id)}
                                        className="mt-3 inline-flex items-center gap-2 rounded-md border border-amber-700/80 bg-amber-900/40 px-3 py-1.5 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                    >
                                        <RotateCcw className="size-4" aria-hidden="true" />
                                        {t("common.retry")}
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                ) : (
                    <div className="chat-message__content">
                        <ReactMarkdown
                            components={markdownComponents}
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                        >
                            {message.content}
                        </ReactMarkdown>
                        {isAssistant && isStreaming && (
                            <span className="chat-message__cursor" aria-label="Generating">
                                {" "}
                            </span>
                        )}
                    </div>
                )}
                {isAssistant && <MessagePerformanceFooter message={message} />}
            </article>
        </div>
    );
}

export default ChatMessageBubble;