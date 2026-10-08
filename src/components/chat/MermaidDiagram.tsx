import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

interface MermaidDiagramProps {
    source: string;
}

let mermaidInitialization: Promise<typeof import("mermaid")> | null = null;

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
            .then((module) => module.default.render(id, source))
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
