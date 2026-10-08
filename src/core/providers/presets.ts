export type PromptPresetId = "code-assistant" | "translator" | "custom-agent";

export interface PromptPreset {
    id: PromptPresetId;
    labelKey: string;
    prompt: string;
}

export const PROMPT_PRESETS: PromptPreset[] = [
    {
        id: "code-assistant",
        labelKey: "prompts.presets.codeAssistant",
        prompt:
            "You are a careful coding assistant. Explain solutions clearly and provide complete, runnable code when requested. For web previews, return one complete ```html code block with CSS in <style> and JavaScript in <script>.",
    },
    {
        id: "translator",
        labelKey: "prompts.presets.translator",
        prompt:
            "You are a professional translator. Preserve the source meaning, tone, terminology, and formatting. Unless asked otherwise, return only the translation.",
    },
    {
        id: "custom-agent",
        labelKey: "prompts.presets.customAgent",
        prompt: "",
    },
];

export function getPresetPrompt(id: PromptPresetId): string {
    return PROMPT_PRESETS.find((preset) => preset.id === id)?.prompt ?? "";
}
