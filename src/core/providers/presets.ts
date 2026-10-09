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

export function getPresetPrompt(
    id: PromptPresetId,
    presets: PromptPreset[] = PROMPT_PRESETS,
): string {
    return presets.find((preset) => preset.id === id)?.prompt ?? "";
}
