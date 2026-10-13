import { describe, expect, it } from "vitest";
import { chunkText, cosineSimilarity } from "./documentParser";

describe("document text helpers", () => {
  it("splits text into overlapping chunks", () => {
    const chunks = chunkText("abcdefghijkl", 6, 2);

    expect(chunks).toEqual(["abcdef", "efghij", "ijkl"]);
  });

  it("rejects invalid chunk sizes and overlaps", () => {
    expect(() => chunkText("text", 0, 0)).toThrow("positive integer");
    expect(() => chunkText("text", 4, 4)).toThrow("smaller");
  });

  it("computes cosine similarity and handles empty or mismatched vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1], [1, 0])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});
