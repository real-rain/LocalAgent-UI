/*
 * @Description: IndexedDB 本地持久化数据库
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

export const db = new LocalAgentDatabase();

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

export async function getUserPromptPresets(): Promise<PromptPreset[]> {
    return db.promptPresets.toArray();
}

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

export async function deleteUserPromptPreset(id: string): Promise<void> {
    if (PROMPT_PRESETS.some((preset) => preset.id === id)) {
        throw new Error("Built-in prompt presets cannot be deleted.");
    }
    const preset = await db.promptPresets.get(id);
    if (!preset) return;
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

export async function saveMessage(message: Message): Promise<number> {
    const updatedAt = Date.now();
    await db.transaction("rw", db.sessions, db.messages, async () => {
        await db.messages.put(message);
        await db.sessions.update(message.sessionId, {
            updatedAt,
        });
    });
    return updatedAt;
}

export async function clearMessagesBySession(sessionId: string): Promise<void> {
    await db.transaction("rw", db.sessions, db.messages, async () => {
        await db.messages.where("sessionId").equals(sessionId).delete();
        await db.sessions.update(sessionId, {
            title: "New Chat",
            updatedAt: Date.now(),
        });
    });
}

export async function getMessagesBySession(
    sessionId: string,
): Promise<Message[]> {
    return db.messages.where("sessionId").equals(sessionId).sortBy("createdAt");
}

export async function getAllSessions(): Promise<Session[]> {
    return db.sessions.toArray();
}

export async function deleteSession(sessionId: string): Promise<void> {
    await db.transaction("rw", db.sessions, db.messages, async () => {
        await db.sessions.delete(sessionId);
        await db.messages.where("sessionId").equals(sessionId).delete();
    });
}

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