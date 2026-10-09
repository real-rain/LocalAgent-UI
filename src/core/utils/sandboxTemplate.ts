/*
 * @Description: iframe 页面包装模板 将生成的 HTML、CSS、SVG 或 JavaScript 包装为可预览的文档。
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

/**
 * 添加预览样式，并补齐缺失的文档结构。
 * @param markup 要规范化的源标记。
 * @returns 添加公共预览样式和文档标签后的标记内容。
 */
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

/**
 * 创建适用于沙盒 iframe 渲染的完整文档。
 * @param code 产物源代码。
 * @param language 产物的语言标识符。
 * @returns 根据产物类型配置的完整 HTML 文档。
 */
export function wrapSandboxHtml(code: string, language: string): string {
    const normalizedLanguage = language.toLowerCase();

    if (normalizedLanguage === "react") {
        const reactCode = code.replace(/<\/script/gi, "<\\/script");
        return addStylesToDocument(`
<div id="preview-root"></div>
<pre id="preview-error" style="display:none;white-space:pre-wrap;color:#b91c1c"></pre>
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.28.5/babel.min.js"></script>
<script>
  try {
    const transformed = Babel.transform(${JSON.stringify(reactCode)}, {
      presets: [["env", { modules: "commonjs" }], "react"],
    }).code;
    const module = { exports: {} };
    const requireModule = (name) => {
      if (name === "react") return React;
      if (name === "react-dom" || name === "react-dom/client") return ReactDOM;
      throw new Error("Unsupported React preview import: " + name);
    };
    const definitions = new Function(
      "React",
      "ReactDOM",
      "module",
      "exports",
      "require",
      transformed + "\\nreturn { App: typeof App !== 'undefined' ? App : undefined };",
    )(React, ReactDOM, module, module.exports, requireModule);
    const Component = module.exports.default || module.exports.App || definitions.App || module.exports;
    if (typeof Component !== "function") {
      throw new Error("Export a React component named App or as the default export.");
    }
    ReactDOM.createRoot(document.getElementById("preview-root")).render(
      React.createElement(Component),
    );
  } catch (error) {
    const errorMessage = document.getElementById("preview-error");
    errorMessage.style.display = "block";
    errorMessage.textContent = error instanceof Error ? error.message : String(error);
    console.error("React sandbox preview failed:", error);
  }
</script>`);
    }

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

    if (normalizedLanguage === "css") {
        return addStylesToDocument(
            `<style>${code.replace(/<\/style/gi, "<\\/style")}</style>
<main class="preview-fixture">
  <h1>CSS Preview</h1>
  <p>Use this sample content to inspect your styles.</p>
  <button type="button">Example button</button>
</main>`,
        );
    }

    if (normalizedLanguage === "js" || normalizedLanguage === "javascript") {
        return addStylesToDocument(
            `<main id="preview-root"><h1>JavaScript Preview</h1><p id="preview-status">Script is running…</p></main>
<script>${code.replace(/<\/script/gi, "<\\/script")}</script>`,
        );
    }

    return addStylesToDocument(code);
}