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
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={checked ? "安全确认: 开启" : "工具执行: 自动"}
            title={
                checked
                    ? "已开启安全防护：Agent 调用工具前需人工二次确认"
                    : "已开启极速模式：Agent 将自动执行工具并回传结果"
            }
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`flex items-center gap-2 whitespace-nowrap shrink-0 px-2.5 py-1 text-xs rounded-full cursor-pointer transition-all duration-200 select-none border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50 ${checked
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-zinc-800/80 text-zinc-400 border-zinc-700/60 hover:bg-zinc-700/80"
                }`}
        >
            {checked ? (
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
                <Zap className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            {checked ? "安全确认: 开启" : "工具执行: 自动"}
        </button>
    );
}
