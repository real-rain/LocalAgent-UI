/*
 * @Description: 测试 Mermaid 流程图节点标签的规范化处理。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-09 14:59:54
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:27:29
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\normalizeMermaidSource.test.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

import { describe, expect, it } from "vitest";
import {
    isMermaidSourceComplete,
    normalizeMermaidSource,
} from "./normalizeMermaidSource";

describe("normalizeMermaidSource", () => {
    it("quotes labels and removes LaTeX syntax from flowchart nodes", () => {
        const source = String.raw`flowchart TD
  A[初始化参数 θ] --> B[计算当前点的梯度 $\nabla J(\theta)$]
  B --> C[更新参数 θ]`;

        expect(normalizeMermaidSource(source)).toContain(
            `B["计算当前点的梯度 nabla J(theta)"]`,
        );
    });

    it("cleans divider lines and unescaped quotes from node labels", () => {
        expect(
            normalizeMermaidSource('flowchart TD\n A[中文 ------------ "说明"]'),
        ).toBe('flowchart TD\n A["中文 #quot;说明#quot;"]');
    });

    it("prefixes numeric flowchart node IDs", () => {
        const source = `graph TD
  1[开始] --> 2[初始化参数]
  2 --> 3`;

        expect(normalizeMermaidSource(source)).toBe(
            `graph TD
  node_1["开始"] --> node_2["初始化参数"]
  node_2 --> node_3`,
        );
    });

    it("leaves non-flowchart diagrams unchanged", () => {
        const source = "sequenceDiagram\n A->>B: send";
        expect(normalizeMermaidSource(source)).toBe(source);
    });

    it("rejects empty and unknown diagram sources", () => {
        expect(normalizeMermaidSource(" \n ")).toBe("");
        expect(normalizeMermaidSource("not a diagram")).toBe("");
    });

    it("detects incomplete streaming flowcharts", () => {
        expect(isMermaidSourceComplete("flowchart TD\n A[Open")).toBe(false);
        expect(isMermaidSourceComplete("flowchart TD\n A -->")).toBe(false);
        expect(isMermaidSourceComplete("flowchart TD\n A[Ready] --> B[Done]")).toBe(
            true,
        );
    });
});
