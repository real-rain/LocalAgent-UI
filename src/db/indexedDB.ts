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

export interface Session {
    id: string;
    title: string;
    model: string;
    engine?: "ollama" | "webgpu";
    presetId?: PromptPresetId;
    customSystemPrompt?: string;
    createdAt: number;
    updatedAt: number;
}

export type SessionSettings = Pick<
    Session,
    "model" | "engine" | "presetId" | "customSystemPrompt"
>;

export class LocalAgentDatabase extends Dexie {
    sessions!: Table<Session, string>;
    messages!: Table<Message, string>;

    constructor() {
        super("LocalAgentDatabase");

        this.version(1).stores({
            sessions: "id, createdAt, updatedAt",
            messages: "id, sessionId, createdAt",
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
        customSystemPrompt: settings.customSystemPrompt ?? "",
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    await db.sessions.add(session);
    return session;
}

export async function updateSessionSettings(
    sessionId: string,
    settings: Partial<SessionSettings>,
): Promise<void> {
    await db.sessions.update(sessionId, {
        ...settings,
        updatedAt: Date.now(),
    });
}

export async function saveMessage(message: Message): Promise<void> {
    await db.messages.put(message);
}

export async function clearMessagesBySession(sessionId: string): Promise<void> {
    await db.transaction("rw", db.sessions, db.messages, async () => {
        await db.messages.where("sessionId").equals(sessionId).delete();
        await db.sessions.update(sessionId, { title: "New Chat" });
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