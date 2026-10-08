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
import CodeArtifactBox from "../agent/CodeArtifactBox";
import ThoughtAccordion from "../agent/ThoughtAccordion";
import ToolCallCard from "../agent/ToolCallCard";
import type { Message } from "../../types/chat";
import "./ChatMessageBubble.css";

interface ChatMessageBubbleProps {
    message: Message;
}

const markdownComponents: Components = {
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
            return <CodeArtifactBox language={language} code={codeContent} />;
        }

        return (
            <code className={className} {...props}>
                {children}
            </code>
        );
    },
};

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
    const isAssistant = message.role === "assistant";
    const isStreaming = message.status === "streaming";

    if (
        isAssistant &&
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
                {isAssistant && message.thoughtProcess && (
                    <div className="chat-message__section">
                        <ThoughtAccordion
                            thoughtText={message.thoughtProcess}
                            isStreaming={isStreaming}
                        />
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
                    <ReactMarkdown components={markdownComponents}>
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