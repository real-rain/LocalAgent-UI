/*
 * @Description: 测试内置、用户自定义及未知 ID 的提示词预设查询。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-09 14:59:54
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:30:09
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\providers\presets.test.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

import { describe, expect, it } from "vitest";
import {
    getPresetPrompt,
    mergeOllamaModels,
    PROMPT_PRESETS,
    PRESET_OLLAMA_MODELS,
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

describe("mergeOllamaModels", () => {
    it("keeps preset models available when Ollama has no local tags", () => {
        expect(mergeOllamaModels([])).toEqual([
            {
                id: "gemma4:31b-cloud",
                name: "gemma4:31b-cloud",
                source: "preset",
            },
        ]);
    });

    it("merges local and custom tags without duplicates and prioritizes local", () => {
        const models = mergeOllamaModels(
            ["gemma4:31b-cloud", "llama3:latest", " LLAMA3:LATEST "],
            ["llama3:latest", "custom-model"],
        );

        expect(models).toEqual([
            {
                id: PRESET_OLLAMA_MODELS[0],
                name: PRESET_OLLAMA_MODELS[0],
                source: "local",
            },
            {
                id: "llama3:latest",
                name: "llama3:latest",
                source: "local",
            },
            {
                id: "custom-model",
                name: "custom-model",
                source: "custom",
            },
        ]);
    });
});
