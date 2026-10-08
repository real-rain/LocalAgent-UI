/*
 * @Description: 综合消息气泡
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 20:03:10
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 20:07:52
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\ChatMessageBubble.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import CodeArtifactBox from "../agent/CodeArtifactBox";
import ThoughtAccordion from "../agent/ThoughtAccordion";
import ToolCallCard from "../agent/ToolCallCard";
import { MermaidDiagram } from "./MermaidDiagram";
import type { Message } from "../../types/chat";
import "./ChatMessageBubble.css";

interface ChatMessageBubbleProps {
    message: Message;
}

interface MarkdownCodeBlock {
    language: string;
    code: string;
}

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

function createMarkdownComponents(previewHtml?: string): Components {
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

            if (isCodeBlock && language) {
                if (language.toLowerCase() === "mermaid") {
                    return <MermaidDiagram source={codeContent} />;
                }

                const useCombinedPreview =
                    !previewAssigned && language.toLowerCase() === "html" && previewHtml;
                if (useCombinedPreview) previewAssigned = true;

                return (
                    <CodeArtifactBox
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

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
    const isAssistant = message.role === "assistant";
    const isStreaming = message.status === "streaming";
    const previewHtml = createCombinedHtml(extractMarkdownCodeBlocks(message.content));
    const markdownComponents = createMarkdownComponents(previewHtml);

    if (
        isAssistant &&
        !isStreaming &&
        !message.content.trim() &&
        !message.thoughtProcess?.trim() &&
        !message.toolCalls?.length
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

                {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="chat-message__section chat-message__tool-calls">
                        {message.toolCalls.map((toolCall, index) => (
                            <ToolCallCard
                                key={`${toolCall.name}-${index}`}
                                toolCall={toolCall}
                            />
                        ))}
                    </div>
                )}

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
            </article>
        </div>
    );
}

export default ChatMessageBubble;