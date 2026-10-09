/*
 * @Description: 校验并规范化 Mermaid 源码，避免常见文本格式导致解析失败。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-08 22:10:08
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:27:49
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\normalizeMermaidSource.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved.
 */

const DIAGRAM_DECLARATION =
    /^(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4(?:Context|Container|Component|Dynamic|Deployment)|sankey(?:-beta)?|xyChart(?:-beta)?|block(?:-beta)?)\b/i;

function cleanNodeLabel(label: string): string {
    return label
        .replace(/\$([^$]*)\$/g, "$1")
        .replace(/\$+/g, "")
        .replace(/\\([A-Za-z]+)/g, "$1")
        .replace(/[{}]/g, "")
        .replace(/-{2,}/g, " ")
        .replace(/\\?"/g, "#quot;")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * 只接受已知 Mermaid 图表声明，并规范化流程图中的节点 ID 和标签。
 * @param source Mermaid 源文本。
 * @returns 可渲染的规范化源文本；空内容或未知图表声明返回空字符串。
 */
export function normalizeMermaidSource(source: string): string {
    const trimmedSource = source.trim();
    if (!trimmedSource) return "";

    const declarationLine = trimmedSource
        .split(/\r?\n/)
        .find((line) => line.trim() && !line.trim().startsWith("%%"));
    if (!declarationLine || !DIAGRAM_DECLARATION.test(declarationLine.trim())) {
        return "";
    }

    if (!/^\s*(?:flowchart|graph)\b/i.test(declarationLine)) {
        return trimmedSource;
    }

    const sourceWithValidNodeIds = trimmedSource.replace(
        /(^|[\s;])(\d+)(?=\s*(?:$|\[|\(|\{|--|==|-\.))/gm,
        "$1node_$2",
    );

    return sourceWithValidNodeIds.replace(
        /(\b[A-Za-z_][\w-]*)\[([^\]\r\n]*)\]/g,
        (_node, id: string, label: string) => {
            const unwrappedLabel =
                label.startsWith('"') && label.endsWith('"')
                    ? label.slice(1, -1)
                    : label;
            return `${id}["${cleanNodeLabel(unwrappedLabel)}"]`;
        },
    );
}

/**
 * 判断流式图表是否已有可解析的声明、闭合节点形状和完整连接符。
 * @param source Mermaid 源文本。
 * @returns 源码当前是否具备渲染所需的基本结构。
 */
export function isMermaidSourceComplete(source: string): boolean {
    const normalizedSource = normalizeMermaidSource(source);
    if (!normalizedSource) return false;

    const trimmedSource = normalizedSource.trimEnd();
    if (/(?:--?>?|==?>?|-\.-?|\.{2,}|[|<>=])\s*$/.test(trimmedSource)) {
        return false;
    }

    const delimiters: string[] = [];
    let inQuotes = false;

    for (const character of trimmedSource) {
        if (character === '"') {
            inQuotes = !inQuotes;
        } else if (!inQuotes && "([{".includes(character)) {
            delimiters.push(character);
        } else if (!inQuotes && ")]}".includes(character)) {
            const opening = delimiters.pop();
            if (
                (character === ")" && opening !== "(") ||
                (character === "]" && opening !== "[") ||
                (character === "}" && opening !== "{")
            ) {
                return false;
            }
        }
    }

    return !inQuotes && delimiters.length === 0;
}
