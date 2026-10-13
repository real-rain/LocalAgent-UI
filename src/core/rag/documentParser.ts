/*
 * @Description: 提供 PDF/TXT 文档文本提取与滑动窗口切块工具。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-13 18:45:16
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-13 19:11:57
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\rag\documentParser.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export { cosineSimilarity } from "./similarity";

/** 指定 PDF.js 在浏览器中加载的解析 Worker 资源。 */
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** 默认切块字符数；较短的块有助于提升检索粒度。 */
const DEFAULT_CHUNK_SIZE = 500;
/** 相邻文本块之间保留的重叠字符数，减少上下文被边界截断。 */
const DEFAULT_OVERLAP = 50;

/**
 * 按文件类型读取 TXT 内容或提取 PDF 各页文本。
 *
 * @param file 用户选择的 PDF 或 TXT 文件。
 * @returns 拼接后的纯文本内容；无法读取或没有文本时抛出错误。
 */
export async function parseDocument(file: File): Promise<string> {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "txt") {
        const text = await file.text();
        if (!text.trim()) throw new Error("The selected text file is empty.");
        return text;
    }
    if (extension !== "pdf") {
        throw new Error("Only PDF and TXT documents are supported.");
    }

    const loadingTask = getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
    });
    try {
        const document = await loadingTask.promise;
        const pageTexts: string[] = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
            const page = await document.getPage(pageNumber);
            const content = await page.getTextContent();
            pageTexts.push(
                content.items
                    .map((item) => ("str" in item ? item.str : ""))
                    .join(" "),
            );
        }
        const text = pageTexts.join("\n").trim();
        if (!text) {
            throw new Error("No readable text was found in the PDF.");
        }
        return text;
    } finally {
        await loadingTask.destroy();
    }
}

/**
 * 使用固定大小的滑动窗口切分文本，并保留相邻块间的重叠内容。
 *
 * @param text 待切分的原始文本。
 * @param chunkSize 每个文本块的最大字符数，必须为正整数。
 * @param overlap 相邻文本块重叠的字符数，必须小于 chunkSize。
 * @returns 去除首尾空白后的非空文本块。
 */
export function chunkText(
    text: string,
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
): string[] {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
        throw new Error("Chunk size must be a positive integer.");
    }
    if (!Number.isInteger(overlap) || overlap < 0 || overlap >= chunkSize) {
        throw new Error("Chunk overlap must be non-negative and smaller than the chunk size.");
    }

    const chunks: string[] = [];
    const stride = chunkSize - overlap;
    for (let start = 0; start < text.length; start += stride) {
        const chunk = text.slice(start, start + chunkSize).trim();
        if (chunk) chunks.push(chunk);
    }
    return chunks;
}
