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

import { memo, useEffect, useId, useRef, useState } from "react";
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
export const MermaidDiagram = memo(function MermaidDiagram({
    source,
    isStreaming = false,
}: MermaidDiagramProps) {
    const { t } = useTranslation();
    const id = useRef(`mermaid-${useId().replace(/:/g, "")}`);
    const diagramRef = useRef<HTMLDivElement>(null);
    const debouncedSource = useDebouncedValue(source, 300);
    const normalizedSource = normalizeMermaidSource(debouncedSource);
    const canRender =
        source === debouncedSource &&
        normalizedSource.length > 0 &&
        (!isStreaming || isMermaidSourceComplete(debouncedSource));
    const chartCode = canRender ? normalizedSource : "";
    const [result, setResult] = useState<{
        source: string;
        failed?: boolean;
    }>({ source: "" });
    const failed =
        chartCode.length > 0 &&
        result.source === chartCode &&
        result.failed === true;

    useEffect(() => {
        const container = diagramRef.current;
        if (!container) return;

        container.innerHTML = "";
        if (!chartCode) return;

        let isActive = true;
        void (async () => {
            try {
                const module = await loadMermaid();
                const { svg: renderedSvg } = await module.default.render(
                    id.current,
                    chartCode,
                );
                if (!isActive) return;

                container.innerHTML = renderedSvg;
                const svgElement = container.querySelector("svg");
                if (svgElement) {
                    const bounds = svgElement.getBoundingClientRect();
                    const viewBox = svgElement.viewBox.baseVal;
                    const parsePixelDimension = (value: string | null) => {
                        if (!value || value.trim().endsWith("%")) return 0;
                        const dimension = Number.parseFloat(value);
                        return Number.isFinite(dimension) ? dimension : 0;
                    };
                    const width =
                        bounds.width ||
                        parsePixelDimension(svgElement.getAttribute("width")) ||
                        viewBox.width ||
                        640;
                    const aspectRatio =
                        viewBox.width > 0 && viewBox.height > 0
                            ? viewBox.height / viewBox.width
                            : 0;
                    const height =
                        aspectRatio > 0
                            ? width * aspectRatio
                            : bounds.height ||
                              parsePixelDimension(svgElement.getAttribute("height")) ||
                              120;

                    svgElement.setAttribute("width", `${Math.round(width)}`);
                    svgElement.setAttribute("height", `${Math.round(height)}`);
                    svgElement.style.width = `${width}px`;
                    svgElement.style.height = `${height}px`;
                    svgElement.style.display = "block";
                    svgElement.style.maxWidth = "none";
                }
                setResult({ source: chartCode });
            } catch {
                if (isActive) setResult({ source: chartCode, failed: true });
            }
        })();

        return () => {
            isActive = false;
        };
    }, [chartCode]);

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
            className="w-full overflow-x-auto my-4 min-h-[120px] flex justify-center items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800"
            aria-label={t("chat.mermaidDiagram")}
            aria-busy={!chartCode || result.source !== chartCode}
        >
            <div className="relative w-fit min-w-full">
                <div
                    ref={diagramRef}
                    className="w-fit min-w-full flex justify-center"
                />
                {(!chartCode || result.source !== chartCode || failed) && (
                    <p
                        className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500"
                        role="status"
                    >
                        {t("chat.renderingDiagram")}
                    </p>
                )}
            </div>
        </div>
    );
});
