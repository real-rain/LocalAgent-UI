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

interface ThoughtAccordionProps {
    thoughtText: string;
    isStreaming: boolean;
    durationSeconds?: number;
}

export function ThoughtAccordion({
    thoughtText,
    isStreaming,
    durationSeconds,
}: ThoughtAccordionProps) {
    return (
        <ThoughtAccordionContent
            key={isStreaming ? "streaming" : "complete"}
            thoughtText={thoughtText}
            isStreaming={isStreaming}
            durationSeconds={durationSeconds}
        />
    );
}

function ThoughtAccordionContent({
    thoughtText,
    isStreaming,
    durationSeconds,
}: ThoughtAccordionProps) {
    const [isOpen, setIsOpen] = useState(isStreaming);
    const contentId = useId();

    return (
        <section className="rounded-lg bg-gray-100/70 p-3 text-xs text-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
            <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={() => {
                    if (!isStreaming) {
                        setIsOpen((open) => !open);
                    }
                }}
            >
                {isStreaming ? (
                    <>
                        <Brain className="size-4 shrink-0" aria-hidden="true" />
                        <span>Thinking...</span>
                        <motion.span
                            className="size-1.5 rounded-full bg-current"
                            aria-hidden="true"
                            animate={{ opacity: [0.25, 1, 0.25] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                        />
                    </>
                ) : (
                    <>
                        <span>Thought for {durationSeconds || 0}s</span>
                        <ChevronDown
                            className={`ml-auto size-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
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
                    height: isOpen ? "auto" : 0,
                    opacity: isOpen ? 1 : 0,
                }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
                aria-hidden={!isOpen}
            >
                <div className="whitespace-pre-wrap break-words pt-2">{thoughtText}</div>
            </motion.div>
        </section>
    );
}

export default ThoughtAccordion;