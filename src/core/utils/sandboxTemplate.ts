/*
 * @Description: iframe 页面包装模板
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 22:30:35
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 22:32:29
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\utils\sandboxTemplate.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
const PREVIEW_STYLES = `<style>
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 16px;
  width: 100%;
  min-height: 100%;
  font-family: system-ui, -apple-system, sans-serif;
  background-color: #09090b; /* zinc-950 黑板底色 */
  color: #f4f4f5;
}
/* 美化内部滚动条 */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
</style>`;

function addStylesToDocument(markup: string): string {
    if (/<html\b[^>]*>/i.test(markup)) {
        if (/<head\b[^>]*>/i.test(markup)) {
            return markup.replace(/<head\b[^>]*>/i, (head) => `${head}\n${PREVIEW_STYLES}`);
        }

        return markup.replace(/<html\b[^>]*>/i, (html) => `${html}\n<head>${PREVIEW_STYLES}</head>`);
    }

    if (/<head\b[^>]*>/i.test(markup)) {
        return `<!doctype html><html>${addStylesToDocument(markup)}</html>`;
    }

    const head = `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${PREVIEW_STYLES}</head>`;
    if (/<body\b[^>]*>/i.test(markup)) {
        return `<!doctype html><html>${head}${markup}</html>`;
    }

    return `<!doctype html><html>${head}<body>${markup}</body></html>`;
}

export function wrapSandboxHtml(code: string, language: string): string {
    const normalizedLanguage = language.toLowerCase();

    if (normalizedLanguage === "svg") {
        return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${PREVIEW_STYLES}
</head>
<body style="display: flex; justify-content: center; align-items: center; min-height: 100vh">${code}</body>
</html>`;
    }

    if (normalizedLanguage === "html") {
        return addStylesToDocument(code);
    }

    const content = normalizedLanguage === "javascript"
        ? `<script>${code.replace(/<\/script/gi, "<\\/script")}</script>`
        : code;

    return addStylesToDocument(content);
}