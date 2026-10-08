/*
 * @Description: 思考过程折叠组件
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 19:57:17
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 20:06:44
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\agent\ThoughtAccordion.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import { useId, useState } from "react";
import { motion } from "framer-motion";
import { Brain, ChevronDown } from "lucide-react";
import type { MessageStatus } from "../../types/chat";

interface ThoughtAccordionProps {
    thoughtProcess: string;
    status?: MessageStatus;
}

export function ThoughtAccordion({
    thoughtProcess,
    status,
}: ThoughtAccordionProps) {
    const isStreaming = status === "streaming";
    const [isExpanded, setIsExpanded] = useState(isStreaming);
    const contentId = useId();

    return (
        <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-3">
            <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                aria-expanded={isExpanded}
                aria-controls={contentId}
                onClick={() => {
                    if (!isStreaming) {
                        setIsExpanded((expanded) => !expanded);
                    }
                }}
            >
                {isStreaming ? (
                    <>
                        <Brain
                            className="size-4 shrink-0 text-zinc-400"
                            aria-hidden="true"
                        />
                        <motion.span
                            className="overflow-hidden whitespace-nowrap font-mono text-xs text-zinc-400"
                            aria-label="Reasoning..."
                            animate={{ width: ["0ch", "12ch", "0ch"] }}
                            transition={{
                                duration: 1.8,
                                repeat: Infinity,
                                ease: "linear",
                            }}
                        >
                            Reasoning...
                        </motion.span>
                        <motion.span
                            className="size-1.5 shrink-0 rounded-full bg-emerald-400"
                            aria-hidden="true"
                            animate={{ opacity: [0.25, 1, 0.25] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                        />
                    </>
                ) : (
                    <>
                        <span className="font-mono text-xs text-zinc-400">
                            Thought process
                        </span>
                        <ChevronDown
                            className={`ml-auto size-4 shrink-0 text-zinc-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""
                                }`}
                            aria-hidden="true"
                        />
                    </>
                )}
            </button>

            <motion.div
                id={contentId}
                initial={false}
                animate={{
                    height: isExpanded ? "auto" : 0,
                    opacity: isExpanded ? 1 : 0,
                }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
                aria-hidden={!isExpanded}
            >
                <div className="whitespace-pre-wrap break-words pt-2 font-mono text-xs text-zinc-400">
                    {thoughtProcess}
                </div>
            </motion.div>
        </section>
    );
}

export default ThoughtAccordion;