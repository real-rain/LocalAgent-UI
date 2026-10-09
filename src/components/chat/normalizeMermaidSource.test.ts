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
import { normalizeMermaidSource } from "./normalizeMermaidSource";

describe("normalizeMermaidSource", () => {
    it("quotes flowchart labels containing mathematical syntax", () => {
        const source = String.raw`flowchart TD
  A[初始化参数 θ] --> B[计算当前点的梯度 $\nabla J(\theta)$]
  B --> C[更新参数 θ]`;

        expect(normalizeMermaidSource(source)).toContain(
            String.raw`B["计算当前点的梯度 $\nabla J(\theta)$"]`,
        );
    });

    it("leaves non-flowchart diagrams unchanged", () => {
        const source = "sequenceDiagram\n A->>B: send";
        expect(normalizeMermaidSource(source)).toBe(source);
    });
});
