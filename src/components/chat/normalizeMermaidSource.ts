/*
 * @Description: 规范化流程图标签，使 Mermaid 能正确解析包含特殊语法的标签。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-08 22:10:08
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:27:49
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\normalizeMermaidSource.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

/**
 * 为尚未加引号的流程图节点标签添加引号。
 * @param source Mermaid 源文本。
 * @returns 规范化后的流程图源文本；其他图表类型保持不变。
 */
export function normalizeMermaidSource(source: string): string {
    if (!/^\s*(?:flowchart|graph)\b/im.test(source)) return source;

    return source.replace(
        /(\b[A-Za-z_][\w-]*)\[([^\]\r\n]*)\]/g,
        (node, id: string, label: string) => {
            if (label.startsWith('"') && label.endsWith('"')) return node;
            const quotedLabel = label.replace(/"/g, "#quot;");
            return `${id}["${quotedLabel}"]`;
        },
    );
}
