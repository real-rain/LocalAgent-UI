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
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, sans-serif;
  background-color: #ffffff;
  color: #000000;
}
/* 美化内部滚动条 */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
</style>`;

function addStylesToDocument(markup: string): string {
    const htmlOpen = /<html\b[^>]*>/i.exec(markup);
    const bodyExists = /<body\b[^>]*>/i.test(markup);
    let documentMarkup = markup;

    if (htmlOpen) {
        if (/<head\b[^>]*>/i.test(documentMarkup)) {
            documentMarkup = documentMarkup.replace(
                /<head\b[^>]*>/i,
                (head) => `${head}\n${PREVIEW_STYLES}`,
            );
        } else {
            const head = `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${PREVIEW_STYLES}</head>`;
            documentMarkup = documentMarkup.replace(htmlOpen[0], `${htmlOpen[0]}${head}`);
        }

        if (!bodyExists) {
            const headClose = /<\/head\s*>/i.exec(documentMarkup);
            if (headClose) {
                const htmlClose = /<\/html\s*>/i.exec(documentMarkup);
                const bodyContentEnd = htmlClose?.index ?? documentMarkup.length;
                documentMarkup = `${documentMarkup.slice(0, headClose.index + headClose[0].length)}<body>${documentMarkup.slice(headClose.index + headClose[0].length, bodyContentEnd)}</body>${documentMarkup.slice(bodyContentEnd)}`;
            }
        }

        return documentMarkup;
    }

    const headOpen = /<head\b[^>]*>/i.exec(documentMarkup);
    if (headOpen) {
        documentMarkup = documentMarkup.replace(
            /<head\b[^>]*>/i,
            (head) => `${head}\n${PREVIEW_STYLES}`,
        );
        if (!bodyExists) {
            const headClose = /<\/head\s*>/i.exec(documentMarkup);
            if (headClose) {
                const headEnd = headClose.index + headClose[0].length;
                const headStart = /<head\b[^>]*>/i.exec(documentMarkup)?.index ?? 0;
                const headMarkup = documentMarkup.slice(headStart, headEnd);
                const surroundingContent = `${documentMarkup.slice(0, headStart)}${documentMarkup.slice(headEnd)}`;
                return `<!doctype html><html>${headMarkup}<body>${surroundingContent}</body></html>`;
            }
        }

        return `<!doctype html><html>${documentMarkup}</html>`;
    }

    const head = `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${PREVIEW_STYLES}</head>`;
    if (bodyExists) {
        return `<!doctype html><html>${head}${documentMarkup}</html>`;
    }

    return `<!doctype html><html>${head}<body>${documentMarkup}</body></html>`;
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