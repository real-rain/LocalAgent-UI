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
import { normalizeMermaidSource } from "./normalizeMermaidSource";

interface MermaidDiagramProps {
    source: string;
}

let mermaidInitialization: Promise<typeof import("mermaid")> | null = null;

/**
 * 初始化 Mermaid 模块并返回共享实例。
 * @returns 在 Mermaid 模块初始化完成后兑现的 Promise。
 */
async function loadMermaid() {
    mermaidInitialization ??= import("mermaid").then((module) => {
        module.default.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "dark",
        });
        return module;
    });
    return mermaidInitialization;
}

/**
 * 渲染 Mermaid 图表，并以无障碍方式呈现加载状态或渲染错误。
 * @param props Mermaid 图表源文本。
 * @returns 已渲染的图表、加载状态或错误信息。
 */
export function MermaidDiagram({ source }: MermaidDiagramProps) {
    const { t } = useTranslation();
    const id = `mermaid-${useId().replace(/:/g, "")}`;
    const [result, setResult] = useState<{
        source: string;
        svg?: string;
        error?: string;
    }>({ source: "" });
    const svg = result.source === source ? result.svg : undefined;
    const error = result.source === source ? result.error : undefined;

    useEffect(() => {
        let isActive = true;
        void loadMermaid()
            .then((module) =>
                module.default.render(id, normalizeMermaidSource(source)),
            )
            .then(({ svg: renderedSvg }) => {
                if (isActive) setResult({ source, svg: renderedSvg });
            })
            .catch((cause: unknown) => {
                if (isActive) {
                    setResult({
                        source,
                        error:
                            cause instanceof Error
                                ? cause.message
                                : t("chat.mermaidRenderError"),
                    });
                }
            });

        return () => {
            isActive = false;
        };
    }, [id, source, t]);

    if (error) {
        return (
            <pre
                className="my-3 overflow-x-auto rounded-lg border border-red-900/70 bg-red-950/30 p-3 text-xs text-red-200"
                role="alert"
            >
                {t("chat.mermaidRenderError")}: {error}
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
