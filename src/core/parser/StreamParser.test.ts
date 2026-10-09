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
});
