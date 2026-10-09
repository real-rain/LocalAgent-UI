import { describe, expect, it } from "vitest";
import { StreamParser } from "./StreamParser";

describe("StreamParser", () => {
    it("recognizes thought tags split across stream chunks", () => {
        const parser = new StreamParser();
        const chunks = [
            ...parser.parse("Answer: <thi"),
            ...parser.parse("nk>reasoning</thi"),
            ...parser.parse("nk> done"),
            ...parser.flush(),
        ];

        expect(chunks).toEqual([
            { type: "text_delta", content: "Answer: " },
            { type: "thought_delta", content: "reasoning" },
            { type: "text_delta", content: " done" },
        ]);
    });

    it("preserves an incomplete thought marker as plain text on flush", () => {
        const parser = new StreamParser();
        expect(parser.parse("hello <thi")).toEqual([
            { type: "text_delta", content: "hello " },
        ]);
        expect(parser.flush()).toEqual([
            { type: "text_delta", content: "<thi" },
        ]);
    });
});
