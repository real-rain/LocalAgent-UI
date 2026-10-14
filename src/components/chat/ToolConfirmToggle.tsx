/*
 * @Description: 胶囊按钮组件，用于切换 Agent 工具执行模式
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-13 21:37:45
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-13 21:40:55
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\ToolConfirmToggle.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import { ShieldCheck, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ToolConfirmToggleProps {
    checked: boolean;
    disabled: boolean;
    onChange: (checked: boolean) => void;
}

/**
 * Switches between confirmation-before-tool-execution and automatic execution.
 */
export function ToolConfirmToggle({
    checked,
    disabled,
    onChange,
}: ToolConfirmToggleProps) {
    const { t } = useTranslation();
    const label = checked
        ? t("chat.toolConfirmToggle.confirmationEnabled")
        : t("chat.toolConfirmToggle.automaticExecution");

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            title={
                checked
                    ? t("chat.toolConfirmToggle.confirmationEnabledDescription")
                    : t("chat.toolConfirmToggle.automaticExecutionDescription")
            }
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-medium border transition-all shrink-0 select-none cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                checked
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/40 hover:bg-amber-500/25"
            }`}
        >
            {checked ? (
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
                <Zap className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            {label}
        </button>
    );
}
