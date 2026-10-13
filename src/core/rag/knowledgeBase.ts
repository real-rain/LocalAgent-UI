import { db, type Document, type DocumentChunk } from "../../db/indexedDB";
import { embedTexts } from "./embeddings";
import { cosineSimilarity } from "./similarity";

/** 限制单次推理输入规模，避免大量文本一次性占用过多内存。 */
const EMBEDDING_BATCH_SIZE = 8;

/**
 * 解析并索引单个文档，将元数据、文本块和向量一起写入 IndexedDB。
 *
 * @param file 用户选择的 PDF 或 TXT 文件。
 * @param onProgress 解析或向量化阶段的进度回调。
 *   向量化阶段会提供已处理切块数和总切块数。
 * @returns 所有切块完成向量化并与文档元数据持久化后兑现的 Promise。
 */
export async function indexDocument(
    file: File,
    onProgress: (status: "parsing" | "embedding", completed?: number, total?: number) => void,
): Promise<void> {
    const { chunkText, parseDocument } = await import("./documentParser");
    onProgress("parsing");
    const text = await parseDocument(file);
    const textChunks = chunkText(text);
    if (textChunks.length === 0) {
        throw new Error("No text could be extracted from the selected document.");
    }

    const embeddings: number[][] = [];
    for (let start = 0; start < textChunks.length; start += EMBEDDING_BATCH_SIZE) {
        const batch = textChunks.slice(start, start + EMBEDDING_BATCH_SIZE);
        // 分批调用 Worker，并报告当前批次进度。
        onProgress("embedding", start, textChunks.length);
        embeddings.push(...await embedTexts(batch));
        onProgress("embedding", Math.min(start + batch.length, textChunks.length), textChunks.length);
    }

    const documentId = crypto.randomUUID();
    const document: Document = {
        id: documentId,
        title: file.name,
        uploadTime: Date.now(),
        size: file.size,
    };
    const chunks: DocumentChunk[] = textChunks.map((chunk, index) => ({
        id: crypto.randomUUID(),
        docId: documentId,
        text: chunk,
        embedding: embeddings[index]!,
    }));
    // 元数据与所有切块在同一事务内保存，避免留下不完整的文档记录。
    await db.transaction("rw", db.documents, db.chunks, async () => {
        await db.documents.add(document);
        await db.chunks.bulkAdd(chunks);
    });
}

/**
 * 将提问向量化，并按余弦相似度返回最相关的文本块。
 *
 * @param prompt 当前用户输入。
 * @param limit 最多返回的片段数量，默认返回前三条。
 * @returns 按相似度从高到低排列的文本片段。
 */
export async function retrieveRelevantChunks(
    prompt: string,
    limit = 3,
): Promise<string[]> {
    const [queryEmbedding] = await embedTexts([prompt]);
    if (!queryEmbedding) return [];
    const chunks = await db.chunks.toArray();
    // 先按余弦相似度从高到低排序，再截取前 limit 个切块作为 Top-K 结果。
    return chunks
        .map((chunk) => ({
            text: chunk.text,
            score: cosineSimilarity(queryEmbedding, chunk.embedding),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map(({ text }) => text);
}
