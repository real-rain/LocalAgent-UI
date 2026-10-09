/*
 * @Description: 在尊重用户手动滚动位置的同时，使聊天内容保持自动跟随到底部。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 22:21:18
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 22:23:22
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\hooks\useAutoScroll.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "../types/chat";

const BOTTOM_THRESHOLD = 100;
const SCROLL_INTERVAL = 100;

/**
 * 提供滚动控制；当滚动位置接近底部时自动跟随新消息。
 * @param messages 当前对话，用于检测新到达的流式内容。
 * @param isStreaming 当前是否正在生成回复。
 * @returns 滚动容器引用、是否位于底部的状态及主动滚动操作。
 */
export function useAutoScroll(messages: readonly Message[], isStreaming: boolean) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const isAtBottomRef = useRef(true);
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const updateIsAtBottom = useCallback(() => {
        const element = scrollRef.current;
        if (!element) return;

        const atBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight <=
            BOTTOM_THRESHOLD;
        isAtBottomRef.current = atBottom;
        setIsAtBottom((current) => (current === atBottom ? current : atBottom));
    }, []);

    const scrollToBottom = useCallback(() => {
        const element = scrollRef.current;
        if (!element) return;

        isAtBottomRef.current = true;
        setIsAtBottom(true);
        element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    }, []);

    useEffect(() => {
        const element = scrollRef.current;
        if (!element) return;

        element.addEventListener("scroll", updateIsAtBottom, { passive: true });
        updateIsAtBottom();
        return () => {
            element.removeEventListener("scroll", updateIsAtBottom);
        };
    }, [updateIsAtBottom]);

    useEffect(() => {
        if (!isAtBottomRef.current || scrollTimerRef.current !== null) return;

        scrollTimerRef.current = setTimeout(() => {
            scrollTimerRef.current = null;
            animationFrameRef.current = requestAnimationFrame(() => {
                animationFrameRef.current = null;
                const element = scrollRef.current;
                if (element && isAtBottomRef.current) {
                    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
                }
            });
        }, SCROLL_INTERVAL);
    }, [messages, isStreaming]);

    useEffect(
        () => () => {
            if (scrollTimerRef.current !== null) {
                clearTimeout(scrollTimerRef.current);
            }
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        },
        [],
    );

    return { scrollRef, isAtBottom, scrollToBottom };
}