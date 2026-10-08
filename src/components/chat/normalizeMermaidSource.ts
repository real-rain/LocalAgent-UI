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
