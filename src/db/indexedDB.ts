/*
 * @Description: 定义聊天记录与提示词预设的 IndexedDB 数据结构及持久化操作。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 21:02:39
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 21:05:58
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\db\indexedDB.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import Dexie, { type Table } from "dexie";
import type { Message } from "../types/chat";
import type { PromptPresetId } from "../core/providers/presets";
import { PROMPT_PRESETS, type PromptPreset } from "../core/providers/presets";

/** 已持久化的聊天会话及其当前模型和提示词配置。 */
export interface Session {
    id: string;
    title: string;
    model: string;
    engine?: "ollama" | "webgpu";
    presetId?: PromptPresetId;
    createdAt: number;
    updatedAt: number;
}

export type SessionSettings = Pick<
    Session,
    "model" | "engine" | "presetId"
>;

/** 用于会话、消息与用户自定义提示词预设的 Dexie 数据结构。 */
export class LocalAgentDatabase extends Dexie {
    sessions!: Table<Session, string>;
    messages!: Table<Message, string>;
    promptPresets!: Table<PromptPreset, string>;

    constructor() {
        super("LocalAgentDatabase");

        this.version(1).stores({
            sessions: "id, createdAt, updatedAt",
            messages: "id, sessionId, createdAt",
        });
        this.version(2).stores({
            sessions: "id, createdAt, updatedAt, presetId",
            messages: "id, sessionId, createdAt, status",
            promptPresets: "id",
        });
    }
}

/** 供持久化辅助函数共用的 IndexedDB 数据库实例。 */
export const db = new LocalAgentDatabase();

/**
 * 创建聊天会话，并为未指定的设置应用默认值后持久化。
 * @param title 会话初始标题。
 * @param model 会话默认使用的模型名称。
 * @param settings 可选的引擎、模型与提示词预设设置。
 * @returns 新建并已持久化的会话记录。
 */
export async function createSession(
    title: string,
    model: string,
    settings: Partial<SessionSettings> = {},
): Promise<Session> {
    const timestamp = Date.now();
    const session: Session = {
        id: crypto.randomUUID(),
        title,
        model: settings.model ?? model,
        engine: settings.engine ?? "ollama",
        presetId: settings.presetId ?? "code-assistant",
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    await db.sessions.add(session);
    return session;
}

/**
 * 持久化会话配置并更新其活动时间。
 * @param sessionId 要更新的会话 ID。
 * @param settings 要修改的配置字段。
 * @returns 写入会话最后更新时间的时间戳。
 */
export async function updateSessionSettings(
    sessionId: string,
    settings: Partial<SessionSettings>,
): Promise<number> {
    const updatedAt = Date.now();
    await db.sessions.update(sessionId, {
        ...settings,
        updatedAt,
    });
    return updatedAt;
}

/**
 * 从 IndexedDB 加载所有用户自定义提示词预设。
 * @returns 已持久化的自定义预设列表。
 */
export async function getUserPromptPresets(): Promise<PromptPreset[]> {
    return db.promptPresets.toArray();
}

/**
 * 校验并持久化自定义提示词预设。
 * @param name 用户可见的预设名称。
 * @param prompt 该预设对应的系统指令。
 * @param id 更新时使用的现有 ID；新建时使用自动生成的 ID。
 * @returns 规范化并持久化后的预设。
 */
export async function saveUserPromptPreset(
    name: string,
    prompt: string,
    id: string = crypto.randomUUID(),
): Promise<PromptPreset> {
    const normalizedName = name.trim();
    const normalizedPrompt = prompt.trim();
    if (!normalizedName || !normalizedPrompt) {
        throw new Error("Prompt preset name and instructions are required.");
    }
    if (PROMPT_PRESETS.some((preset) => preset.id === id)) {
        throw new Error("Built-in prompt presets cannot be overwritten.");
    }

    const preset: PromptPreset = {
        id,
        name: normalizedName,
        prompt: normalizedPrompt,
        builtIn: false,
    };
    await db.promptPresets.put(preset);
    return preset;
}

/**
 * 删除自定义预设，并将引用它的会话切换为内置默认预设。
 * @param id 要删除的预设 ID。
 * @returns 相关记录完成原子更新后兑现的 Promise。
 */
export async function deleteUserPromptPreset(id: string): Promise<void> {
    if (PROMPT_PRESETS.some((preset) => preset.id === id)) {
        throw new Error("Built-in prompt presets cannot be deleted.");
    }
    const preset = await db.promptPresets.get(id);
    if (!preset) return;
    // 在同一事务中更新引用该预设的会话并删除预设。
    await db.transaction("rw", db.sessions, db.promptPresets, async () => {
        const updatedAt = Date.now();
        await db.sessions
            .where("presetId")
            .equals(id)
            .modify((session) => {
                session.presetId = "code-assistant";
                session.updatedAt = updatedAt;
                Reflect.deleteProperty(session, "customSystemPrompt");
            });
        await db.promptPresets.delete(id);
    });
}

/**
 * 在同一事务中保存消息并更新其所属会话的活动时间。
 * @param message 要持久化的消息记录。
 * @returns 写入会话最后更新时间的时间戳。
 */
export async function saveMessage(message: Message): Promise<number> {
    const updatedAt = Date.now();
    // 将消息持久化与会话时间更新保持在同一事务中，确保写入一致。
    await db.transaction("rw", db.sessions, db.messages, async () => {
        await db.messages.put(message);
        await db.sessions.update(message.sessionId, {
            updatedAt,
        });
    });
    return updatedAt;
}

/**
 * 删除会话中的所有消息并重置会话标题。
 * @param sessionId 要清空对话的会话 ID。
 * @returns 消息删除和标题重置提交后兑现的 Promise。
 */
export async function clearMessagesBySession(sessionId: string): Promise<void> {
    await db.transaction("rw", db.sessions, db.messages, async () => {
        await db.messages.where("sessionId").equals(sessionId).delete();
        await db.sessions.update(sessionId, {
            title: "New Chat",
            updatedAt: Date.now(),
        });
    });
}

/**
 * 按时间顺序加载指定会话的消息。
 * @param sessionId 要加载消息的会话 ID。
 * @returns 按创建时间排序的会话消息列表。
 */
export async function getMessagesBySession(
    sessionId: string,
): Promise<Message[]> {
    return db.messages.where("sessionId").equals(sessionId).sortBy("createdAt");
}

/**
 * 加载所有已持久化的聊天会话。
 * @returns 全部会话记录。
 */
export async function getAllSessions(): Promise<Session[]> {
    return db.sessions.toArray();
}

/**
 * 原子删除会话及其消息。
 * @param sessionId 要删除的会话 ID。
 * @returns 会话和消息都删除后兑现的 Promise。
 */
export async function deleteSession(sessionId: string): Promise<void> {
    await db.transaction("rw", db.sessions, db.messages, async () => {
        await db.sessions.delete(sessionId);
        await db.messages.where("sessionId").equals(sessionId).delete();
    });
}

/**
 * 将上次应用运行中遗留的流式消息标记为已中断。
 * @returns 已恢复且状态更新为已中断的消息列表。
 */
export async function recoverInterruptedMessages(): Promise<Message[]> {
    return db.transaction("rw", db.sessions, db.messages, async () => {
        const interrupted = await db.messages
            .where("status")
            .equals("streaming")
            .toArray();
        const recoveredAt = Date.now();
        for (const message of interrupted) {
            await db.messages.update(message.id, { status: "interrupted" });
            await db.sessions.update(message.sessionId, {
                updatedAt: recoveredAt,
            });
        }
        return interrupted.map((message) => ({
            ...message,
            status: "interrupted",
        }));
    });
}