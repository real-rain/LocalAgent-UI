/*
 * @Description: 定义内置提示词预设及预设查询辅助函数。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-08 21:48:22
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:30:29
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\providers\presets.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

export type PromptPresetId = string;

export interface PromptPreset {
    id: PromptPresetId;
    name: string;
    prompt: string;
    builtIn: boolean;
}

export const PROMPT_PRESETS: PromptPreset[] = [
    {
        id: "code-assistant",
        name: "Code Assistant",
        prompt:
            "You are a careful coding assistant. Explain solutions clearly and provide complete, runnable code when requested. For web previews, return one complete ```html code block with CSS in <style> and JavaScript in <script>.",
        builtIn: true,
    },
    {
        id: "translator",
        name: "Translator",
        prompt:
            "You are a professional translator. Preserve the source meaning, tone, terminology, and formatting. Unless asked otherwise, return only the translation.",
        builtIn: true,
    },
];

/**
 * 根据预设标识查找对应的系统提示词。
 * @param id 要查询的预设标识符。
 * @param presets 可供查询的预设；默认使用内置预设列表。
 * @returns 匹配的提示词；标识符未知时返回空字符串。
 */
export function getPresetPrompt(
    id: PromptPresetId,
    presets: PromptPreset[] = PROMPT_PRESETS,
): string {
    return presets.find((preset) => preset.id === id)?.prompt ?? "";
}
