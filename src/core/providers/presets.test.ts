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
