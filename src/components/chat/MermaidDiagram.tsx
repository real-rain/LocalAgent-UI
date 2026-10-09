/*
 * @Description: 按需加载 Mermaid，并根据源文本渲染图表。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-08 21:50:04
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:26:53
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\MermaidDiagram.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved.
 */

import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    isMermaidSourceComplete,
    normalizeMermaidSource,
} from "./normalizeMermaidSource";

interface MermaidDiagramProps {
    source: string;
    isStreaming?: boolean;
}

let mermaidInitialization: Promise<typeof import("mermaid")> | null = null;

async function loadMermaid() {
    mermaidInitialization ??= import("mermaid").then((module) => {
        module.default.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            suppressErrorRendering: true,
            theme: "dark",
        });
        return module;
    });
    return mermaidInitialization;
}

function useDebouncedValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
        return () => window.clearTimeout(timeout);
    }, [delay, value]);

    return debouncedValue;
}

/**
 * 渲染已完成的 Mermaid 源文本；流式内容等待稳定后再进行解析。
 * @param props Mermaid 源文本及流式状态。
 * @returns 已渲染图表或安静的加载占位卡片。
 */
export function MermaidDiagram({
    source,
    isStreaming = false,
}: MermaidDiagramProps) {
    const { t } = useTranslation();
    const id = `mermaid-${useId().replace(/:/g, "")}`;
    const debouncedSource = useDebouncedValue(source, 300);
    const normalizedSource = normalizeMermaidSource(debouncedSource);
    const canRender =
        source === debouncedSource &&
        normalizedSource.length > 0 &&
        (!isStreaming || isMermaidSourceComplete(debouncedSource));
    const [result, setResult] = useState<{
        source: string;
        svg?: string;
        failed?: boolean;
    }>({ source: "" });
    const svg = canRender && result.source === normalizedSource ? result.svg : undefined;
    const failed =
        canRender && result.source === normalizedSource && result.failed === true;

    useEffect(() => {
        if (!canRender) return;

        let isActive = true;
        void (async () => {
            try {
                const module = await loadMermaid();
                const { svg: renderedSvg } = await module.default.render(
                    id,
                    normalizedSource,
                );
                if (isActive) setResult({ source: normalizedSource, svg: renderedSvg });
            } catch {
                if (isActive) setResult({ source: normalizedSource, failed: true });
            }
        })();

        return () => {
            isActive = false;
        };
    }, [canRender, id, normalizedSource]);

    if (
        !isStreaming &&
        (failed || (source.trim().length > 0 && normalizedSource.length === 0))
    ) {
        return (
            <pre className="my-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
                <code className="whitespace-pre">{source}</code>
            </pre>
        );
    }

    return (
        <div
            className="my-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4"
            aria-label={t("chat.mermaidDiagram")}
            aria-busy={!svg}
        >
            {svg ? (
                <div
                    className="mx-auto w-fit max-w-full [&_svg]:max-w-full"
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            ) : (
                <p className="text-xs text-zinc-500" role="status">
                    {t("chat.renderingDiagram")}
                </p>
            )}
        </div>
    );
}
