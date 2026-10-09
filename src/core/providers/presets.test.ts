import { describe, expect, it } from "vitest";
import {
    getPresetPrompt,
    PROMPT_PRESETS,
    type PromptPreset,
} from "./presets";

describe("prompt presets", () => {
    it("resolves built-in and persisted user prompts by ID", () => {
        const customPreset: PromptPreset = {
            id: "user-preset-1",
            name: "Reviewer",
            prompt: "Review code for correctness.",
            builtIn: false,
        };

        expect(getPresetPrompt("code-assistant")).toContain("coding assistant");
        expect(getPresetPrompt(customPreset.id, [...PROMPT_PRESETS, customPreset]))
            .toBe(customPreset.prompt);
        expect(getPresetPrompt("missing-preset", [customPreset])).toBe("");
    });
});
