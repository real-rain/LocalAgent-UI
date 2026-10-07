/*
 * @Description: 工具调用节点组件
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 20:00:39
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 20:07:31
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\agent\ToolCallCard.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import { useId, useState } from "react";
import {
    AlertTriangle,
    Check,
    ChevronDown,
    Loader2,
    Wrench,
} from "lucide-react";
import type { ToolCall } from "../../types/chat";

interface ToolCallCardProps {
    toolCall: ToolCall;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const contentId = useId();

    let statusIcon;
    let statusText: string;
    let statusClassName: string;

    switch (toolCall.status) {
        case "pending":
            statusIcon = <span className="size-2 rounded-full bg-zinc-400" aria-hidden="true" />;
            statusText = toolCall.name;
            statusClassName = "text-zinc-500 dark:text-zinc-400";
            break;
        case "running":
            statusIcon = <Loader2 className="size-4 animate-spin text-blue-500" aria-hidden="true" />;
            statusText = `Executing ${toolCall.name}...`;
            statusClassName = "text-blue-600 dark:text-blue-400";
            break;
        case "success":
            statusIcon = <Check className="size-4 text-emerald-500" aria-hidden="true" />;
            statusText = `Executed ${toolCall.name}`;
            statusClassName = "text-emerald-600 dark:text-emerald-400";
            break;
        case "failed":
            statusIcon = <AlertTriangle className="size-4 text-red-500" aria-hidden="true" />;
            statusText = `Failed ${toolCall.name}`;
            statusClassName = "text-red-600 dark:text-red-400";
            break;
    }

    return (
        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white font-mono text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
            <div className="flex items-center gap-2 px-3 py-2">
                <Wrench className="size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                <span className={`flex min-w-0 flex-1 items-center gap-2 ${statusClassName}`}>
                    {statusIcon}
                    <span className="truncate">{statusText}</span>
                </span>
                <button
                    type="button"
                    className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    aria-label={isOpen ? "Collapse tool call details" : "Expand tool call details"}
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    onClick={() => setIsOpen((open) => !open)}
                >
                    <ChevronDown
                        className={`size-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                    />
                </button>
            </div>

            {isOpen && (
                <div id={contentId} className="space-y-3 border-t border-zinc-200 p-3 dark:border-zinc-700">
                    <div className="space-y-1.5">
                        <h3 className="font-semibold uppercase tracking-wider text-zinc-500">Arguments</h3>
                        <pre className="overflow-x-auto whitespace-pre-wrap break-words">
                            <code className="block rounded bg-zinc-900 p-2 text-xs text-zinc-200">
                                {JSON.stringify(toolCall.arguments, null, 2)}
                            </code>
                        </pre>
                    </div>
                    <div className="space-y-1.5">
                        <h3 className="font-semibold uppercase tracking-wider text-zinc-500">Result</h3>
                        <pre className="overflow-x-auto whitespace-pre-wrap break-words">
                            <code className="block rounded bg-zinc-900 p-2 text-xs text-zinc-200">
                                {JSON.stringify(toolCall.result, null, 2)}
                            </code>
                        </pre>
                    </div>
                </div>
            )}
        </section>
    );
}

export default ToolCallCard;