/*
 * @Description: 测试跨流式数据块的推理标记增量解析。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-09 14:59:54
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:29:03
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\parser\StreamParser.test.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

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

    it("treats all output after the first thought end marker as answer text", () => {
        const parser = new StreamParser();
        const chunks = [
            ...parser.parse("<think>draft</think>Answer <think>more draft</think> done"),
            ...parser.flush(),
        ];

        expect(chunks).toEqual([
            { type: "thought_delta", content: "draft" },
            { type: "text_delta", content: "Answer " },
            { type: "text_delta", content: "more draft" },
            { type: "text_delta", content: " done" },
        ]);
    });

    it("removes stray thought tags and stops after more than three closing tags", () => {
        const parser = new StreamParser();
        const chunks = parser.parse("<think>draft</think></think></think>");

        expect(chunks).toEqual([
            { type: "thought_delta", content: "draft" },
        ]);
        expect(parser.shouldStop).toBe(false);
        expect(parser.parse("</think>ignored")).toEqual([]);
        expect(parser.shouldStop).toBe(true);
    });

    it("extracts tool calls wrapped in tags across stream chunks", () => {
        const parser = new StreamParser();
        const chunks = [
            ...parser.parse("Before <tool_"),
            ...parser.parse('call>{"name":"calculator","arguments":{"expression":"1+2"}}'),
            ...parser.parse("</tool_call> after"),
            ...parser.flush(),
        ];

        expect(chunks).toMatchObject([
            { type: "text_delta", content: "Before " },
            {
                type: "tool_call",
                toolCall: {
                    id: expect.stringMatching(/^tool_call_/),
                    name: "calculator",
                    arguments: { expression: "1+2" },
                },
            },
            { type: "text_delta", content: " after" },
        ]);
    });

    it("extracts a tool call emitted as a standalone JSON object", () => {
        const parser = new StreamParser();
        expect(
            parser.parse('{"name":"calculator","arguments":{"expression":"0.1+0.2"}}'),
        ).toMatchObject([
            {
                type: "tool_call",
                toolCall: {
                    id: expect.stringMatching(/^tool_call_/),
                    name: "calculator",
                    arguments: { expression: "0.1+0.2" },
                },
            },
        ]);
    });

    it("assigns a distinct id to each generated tool call", () => {
        const parser = new StreamParser();
        const first = parser.parse('{"name":"calculator","arguments":{"expression":"1+1"}}');
        const second = parser.parse('{"name":"calculator","arguments":{"expression":"1+1"}}');

        expect(first[0]?.type).toBe("tool_call");
        expect(second[0]?.type).toBe("tool_call");
        if (first[0]?.type !== "tool_call" || second[0]?.type !== "tool_call") {
            throw new Error("Expected both parsed chunks to be tool calls.");
        }
        expect(first[0].toolCall.id).not.toBe(second[0].toolCall.id);
    });

    it("extracts a raw tool-call object following explanatory text", () => {
        const parser = new StreamParser();
        expect(
            parser.parse('Calculating now: {"name":"calculator","arguments":{"expression":"2+2"}}'),
        ).toMatchObject([
            { type: "text_delta", content: "Calculating now: " },
            {
                type: "tool_call",
                toolCall: {
                    id: expect.stringMatching(/^tool_call_/),
                    name: "calculator",
                    arguments: { expression: "2+2" },
                },
            },
        ]);
    });

    it("preserves malformed tool-call markup as visible text", () => {
        const parser = new StreamParser();
        expect(
            [...parser.parse("<tool_call>{not json}</tool_call>"), ...parser.flush()],
        ).toEqual([
            { type: "text_delta", content: "<tool_call>{not json}</tool_call>" },
        ]);
    });
});
