import { useTranslation } from "react-i18next";
import {
    PROMPT_PRESETS,
    type PromptPresetId,
} from "../../core/providers/presets";

interface PromptPresetSelectorProps {
    presetId: PromptPresetId;
    customPrompt: string;
    disabled: boolean;
    onPresetChange: (presetId: PromptPresetId) => void;
    onCustomPromptChange: (prompt: string) => void;
}

export function PromptPresetSelector({
    presetId,
    customPrompt,
    disabled,
    onPresetChange,
    onCustomPromptChange,
}: PromptPresetSelectorProps) {
    const { t } = useTranslation();

    return (
        <div className="flex min-w-0 items-center gap-2">
            <label className="sr-only" htmlFor="prompt-preset">
                {t("prompts.label")}
            </label>
            <select
                id="prompt-preset"
                value={presetId}
                disabled={disabled}
                onChange={(event) =>
                    onPresetChange(event.target.value as PromptPresetId)
                }
                className="max-w-36 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50"
            >
                {PROMPT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                        {t(preset.labelKey)}
                    </option>
                ))}
            </select>
            {presetId === "custom-agent" && (
                <label className="sr-only" htmlFor="custom-system-prompt">
                    {t("prompts.customPrompt")}
                </label>
            )}
            {presetId === "custom-agent" && (
                <textarea
                    id="custom-system-prompt"
                    rows={1}
                    value={customPrompt}
                    disabled={disabled}
                    onChange={(event) => onCustomPromptChange(event.target.value)}
                    placeholder={t("prompts.customPlaceholder")}
                    className="min-w-24 max-w-48 resize-x rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50"
                />
            )}
        </div>
    );
}
