import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db/indexedDB";

const { embedTextsMock } = vi.hoisted(() => ({
  embedTextsMock: vi.fn<(texts: string[]) => Promise<number[][]>>(),
}));

vi.mock("./embeddings", () => ({
  embedTexts: embedTextsMock,
}));

import { indexDocument, retrieveRelevantChunks } from "./knowledgeBase";

describe("local knowledge base", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    embedTextsMock.mockReset();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("stores document metadata and vectors after indexing a text file", async () => {
    embedTextsMock.mockResolvedValue([[0.6, 0.8]]);
    const progress: string[] = [];

    await indexDocument(
      new File(["Local document contents"], "notes.txt", {
        type: "text/plain",
      }),
      (phase) => progress.push(phase),
    );

    expect(await db.documents.toArray()).toMatchObject([
      { title: "notes.txt", size: 23 },
    ]);
    expect(await db.chunks.toArray()).toMatchObject([
      { text: "Local document contents", embedding: [0.6, 0.8] },
    ]);
    expect(progress).toEqual(["parsing", "embedding", "embedding"]);
  });

  it("ranks stored chunks by cosine similarity and returns only the requested count", async () => {
    embedTextsMock.mockResolvedValue([[1, 0]]);
    await db.chunks.bulkAdd([
      { id: "low", docId: "doc", text: "least relevant", embedding: [0, 1] },
      { id: "high", docId: "doc", text: "most relevant", embedding: [1, 0] },
      { id: "middle", docId: "doc", text: "next relevant", embedding: [0.8, 0.6] },
    ]);

    await expect(retrieveRelevantChunks("question", 2)).resolves.toEqual([
      "most relevant",
      "next relevant",
    ]);
    expect(embedTextsMock).toHaveBeenCalledWith(["question"]);
  });
});
