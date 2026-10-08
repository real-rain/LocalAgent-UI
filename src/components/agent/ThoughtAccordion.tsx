import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, ChevronDown, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Message } from "../../types/chat";

interface ThoughtAccordionProps {
    message: Message;
}

export function ThoughtAccordion({ message }: ThoughtAccordionProps) {
    const { t } = useTranslation();
    const thoughtProcess = message.thoughtProcess ?? "";
    const isStreaming = message.status === "streaming";
    const shouldRender = isStreaming || Boolean(thoughtProcess.trim());
    const [isExpanded, setIsExpanded] = useState(
        Boolean(thoughtProcess) || isStreaming,
    );
    const [promptIndex, setPromptIndex] = useState(0);
    const [displayedThought, setDisplayedThought] = useState("");
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const contentId = useId();
    const startedAtRef = useRef(0);
    const displayedLengthRef = useRef(0);
    const latestThoughtRef = useRef(thoughtProcess);

    useEffect(() => {
        latestThoughtRef.current = thoughtProcess;
    }, [thoughtProcess]);

    useEffect(() => {
        if (!isStreaming) return;

        const timer = window.setInterval(() => {
            const target = latestThoughtRef.current;
            if (displayedLengthRef.current < target.length) {
                displayedLengthRef.current += 1;
                setDisplayedThought(
                    target.slice(0, displayedLengthRef.current),
                );
            }
        }, 18);

        return () => window.clearInterval(timer);
    }, [isStreaming]);

    useEffect(() => {
        if (!isStreaming) return;

        startedAtRef.current = Date.now();
        const timer = window.setInterval(() => {
            setElapsedSeconds(
                Math.floor((Date.now() - startedAtRef.current) / 1000),
            );
        }, 1000);

        return () => window.clearInterval(timer);
    }, [isStreaming]);

    useEffect(() => {
        if (!isStreaming || thoughtProcess) return;

        const timer = window.setInterval(() => {
            setPromptIndex((index) => (index + 1) % 3);
        }, 2400);

        return () => window.clearInterval(timer);
    }, [isStreaming, thoughtProcess]);

    if (!shouldRender) return null;

    if (!thoughtProcess.trim()) {
        return (
            <motion.section
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 backdrop-blur"
                aria-live="polite"
                aria-label={t("chat.agentDeepThinking")}
            >
                <div className="flex items-center gap-2.5">
                    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
                        <Brain className="size-[18px] animate-pulse" aria-hidden="true" />
                        <Loader2
                            className="absolute -right-1 -top-1 size-3.5 animate-spin text-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.9)]"
                            aria-hidden="true"
                        />
                    </span>
                    <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold tracking-wide text-indigo-200">
                            {t("chat.deepThinking")}
                        </div>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={promptIndex}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.2 }}
                                className="mt-1 text-xs text-indigo-200/65"
                            >
                                {t(`chat.thinkingPrompts.${promptIndex}`)}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </motion.section>
        );
    }

    return (
        <motion.section
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 backdrop-blur"
        >
            <button
                type="button"
                className="flex w-full items-center gap-2.5 text-left"
                aria-expanded={isExpanded}
                aria-controls={contentId}
                onClick={() => setIsExpanded((expanded) => !expanded)}
            >
                <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
                    <Brain className="size-[18px]" aria-hidden="true" />
                    {isStreaming && (
                        <Loader2
                            className="absolute -right-1 -top-1 size-3.5 animate-spin text-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.9)]"
                            aria-hidden="true"
                        />
                    )}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-semibold tracking-wide text-indigo-200">
                        {t("chat.thoughtProcess")}
                    </span>
                    <span className="mt-1 block text-xs text-indigo-200/60">
                        {t("chat.thoughtFor", { seconds: elapsedSeconds })}
                    </span>
                    {isStreaming && (
                        <span className="mt-1 block text-xs text-indigo-200/60">
                            {t("chat.continuingThinking")}
                        </span>
                    )}
                </span>
                <ChevronDown
                    className={`size-4 shrink-0 text-indigo-300/70 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                />
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
                <div className="mt-3 border-t border-indigo-400/15 pt-3 font-mono text-xs leading-relaxed text-indigo-100/75">
                    <span className="whitespace-pre-wrap break-words">
                        {isStreaming ? displayedThought : thoughtProcess}
                    </span>
                    {isStreaming && (
                        <span className="ml-0.5 inline-block h-3 w-1 animate-pulse rounded-sm bg-indigo-300/80 align-middle" />
                    )}
                </div>
            </motion.div>
        </motion.section>
    );
}

export default ThoughtAccordion;
