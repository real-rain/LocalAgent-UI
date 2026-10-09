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
