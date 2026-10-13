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
import type { Message, ToolCallStatus } from "../types/chat";
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

export interface SessionBackup {
    format: "localagent-ui-backup";
    version: 1;
    exportedAt: number;
    sessions: Session[];
    messages: Message[];
    promptPresets: PromptPreset[];
}

export interface SessionImportResult {
    sessions: Session[];
    messageCount: number;
    promptPresetCount: number;
}

/**
 * 本地知识库中文档的基本元数据。
 *
 * @property id 文档记录的唯一标识。
 * @property title 上传文件的名称。
 * @property uploadTime 文档导入时间的 Unix 毫秒时间戳。
 * @property size 原始文件的字节数。
 */
export interface Document {
    /** 文档记录的唯一标识。 */
    id: string;
    /** 上传文件的名称。 */
    title: string;
    /** 文档导入时间的 Unix 毫秒时间戳。 */
    uploadTime: number;
    /** 原始文件大小，单位为字节。 */
    size: number;
}

/**
 * 文档拆分后的文本片段及其语义特征向量。
 *
 * @property id 切块记录的唯一标识。
 * @property docId 所属文档的唯一标识，对应 {@link Document.id}。
 * @property text 切块中保存的原始文本内容。
 * @property embedding 由特征提取模型生成的数值特征向量数组。
 */
export interface DocumentChunk {
    /** 切块记录的唯一标识。 */
    id: string;
    /** 所属文档的唯一标识，对应 {@link Document.id}。 */
    docId: string;
    /** 切块中保存的原始文本内容。 */
    text: string;
    /** 由特征提取模型生成的数值特征向量数组。 */
    embedding: number[];
}

/** 用于会话、消息、文档与用户自定义提示词预设的 Dexie 数据结构。 */
export class LocalAgentDatabase extends Dexie {
    sessions!: Table<Session, string>;
    messages!: Table<Message, string>;
    promptPresets!: Table<PromptPreset, string>;
    /** 已导入文档的元数据表。 */
    documents!: Table<Document, string>;
    /** 文档切块与向量数据表。 */
    chunks!: Table<DocumentChunk, string>;

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
        // 保留既有会话表结构，并为本地 RAG 新增文档与切块表。
        this.version(3).stores({
            sessions: "id, createdAt, updatedAt, presetId",
            messages: "id, sessionId, createdAt, status",
            promptPresets: "id",
            documents: "id, title, uploadTime",
            chunks: "id, docId",
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
 * 创建包含会话、消息和自定义提示词预设的完整备份快照。
 * @returns 可序列化为 JSON 的完整本地数据备份。
 */
export async function createSessionBackup(): Promise<SessionBackup> {
    return db.transaction(
        "r",
        db.sessions,
        db.messages,
        db.promptPresets,
        async () => ({
            format: "localagent-ui-backup",
            version: 1,
            exportedAt: Date.now(),
            sessions: await db.sessions.toArray(),
            messages: await db.messages.toArray(),
            promptPresets: await db.promptPresets.toArray(),
        }),
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function validateSession(value: unknown): Session {
    if (
        !isRecord(value) ||
        typeof value.id !== "string" ||
        !value.id ||
        typeof value.title !== "string" ||
        typeof value.model !== "string" ||
        !isFiniteNumber(value.createdAt) ||
        !isFiniteNumber(value.updatedAt) ||
        (value.engine !== undefined &&
            value.engine !== "ollama" &&
            value.engine !== "webgpu") ||
        (value.presetId !== undefined && typeof value.presetId !== "string")
    ) {
        throw new Error("The backup contains an invalid session.");
    }

    return {
        id: value.id,
        title: value.title,
        model: value.model,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
        ...(value.engine ? { engine: value.engine } : {}),
        ...(value.presetId ? { presetId: value.presetId } : {}),
    };
}

function validateMessage(value: unknown): Message {
    const validStatuses = new Set<string>([
        "streaming",
        "complete",
        "failed",
        "error",
        "interrupted",
    ]);
    if (
        !isRecord(value) ||
        typeof value.id !== "string" ||
        !value.id ||
        typeof value.sessionId !== "string" ||
        !value.sessionId ||
        !isFiniteNumber(value.createdAt) ||
        (value.role !== "user" &&
            value.role !== "assistant" &&
            value.role !== "tool") ||
        typeof value.content !== "string" ||
        (value.status !== undefined &&
            (typeof value.status !== "string" ||
                !validStatuses.has(value.status))) ||
        (value.thoughtProcess !== undefined &&
            typeof value.thoughtProcess !== "string") ||
        (value.toolCalls !== undefined && !Array.isArray(value.toolCalls))
    ) {
        throw new Error("The backup contains an invalid message.");
    }

    const message: Message = {
        id: value.id,
        sessionId: value.sessionId,
        createdAt: value.createdAt,
        role: value.role,
        content: value.content,
        ...(value.status ? { status: value.status as Message["status"] } : {}),
        ...(value.thoughtProcess !== undefined
            ? { thoughtProcess: value.thoughtProcess }
            : {}),
    }

    if (Array.isArray(value.toolCalls)) {
        message.toolCalls = value.toolCalls.map((toolCall) => {
            if (
                !isRecord(toolCall) ||
                typeof toolCall.name !== "string" ||
                ![
                    "awaiting_confirmation",
                    "tool_executing",
                    "executed",
                    "failed",
                    "rejected",
                    "pending",
                    "running",
                    "success",
                ].includes(
                    String(toolCall.status),
                )
            ) {
                throw new Error("The backup contains an invalid tool call.");
            }
            const legacyStatus = String(toolCall.status);
            const status =
                legacyStatus === "pending"
                    ? "pending"
                    : legacyStatus === "running"
                        ? "failed"
                        : legacyStatus === "success"
                            ? "executed"
                            : (legacyStatus as ToolCallStatus);
            return {
                id:
                    typeof toolCall.id === "string"
                        ? toolCall.id
                        : crypto.randomUUID(),
                name: toolCall.name,
                status,
                arguments: isRecord(toolCall.arguments)
                    ? toolCall.arguments
                    : {},
                ...(Object.hasOwn(toolCall, "result")
                    ? { result: toolCall.result }
                    : legacyStatus === "running"
                        ? {
                            result: {
                                error: "Tool execution was interrupted before the backup was created.",
                            },
                        }
                    : {}),
            };
        });
    }

    if (value.performance !== undefined) {
        const performance = value.performance;
        if (
            !isRecord(performance) ||
            !isFiniteNumber(performance.startTime) ||
            !isFiniteNumber(performance.totalTokens) ||
            (performance.endTime !== undefined &&
                !isFiniteNumber(performance.endTime)) ||
            (performance.engine !== "ollama" &&
                performance.engine !== "webgpu") ||
            typeof performance.model !== "string"
        ) {
            throw new Error("The backup contains invalid performance data.");
        }
        message.performance = {
            startTime: performance.startTime,
            totalTokens: performance.totalTokens,
            engine: performance.engine,
            model: performance.model,
            ...(performance.endTime !== undefined
                ? { endTime: performance.endTime }
                : {}),
        };
    }

    return message;
}

function validatePromptPreset(value: unknown): PromptPreset {
    if (
        !isRecord(value) ||
        typeof value.id !== "string" ||
        !value.id ||
        typeof value.name !== "string" ||
        !value.name.trim() ||
        typeof value.prompt !== "string" ||
        !value.prompt.trim() ||
        value.builtIn === true
    ) {
        throw new Error("The backup contains an invalid custom prompt preset.");
    }

    if (PROMPT_PRESETS.some((preset) => preset.id === value.id)) {
        throw new Error("The backup contains a reserved prompt preset ID.");
    }

    return {
        id: value.id,
        name: value.name,
        prompt: value.prompt,
        builtIn: false,
    };
}

function assertUniqueIds<T extends { id: string }>(
    records: T[],
    recordName: string,
): void {
    const ids = new Set<string>();
    for (const record of records) {
        if (ids.has(record.id)) {
            throw new Error(`The backup contains duplicate ${recordName} IDs.`);
        }
        ids.add(record.id);
    }
}

/**
 * 验证并追加完整备份或旧版单会话 JSON；导入记录会重新生成 ID，不覆盖现有数据。
 * @param input 已解析的 JSON 数据。
 * @returns 导入的会话和记录数量。
 */
export async function importSessionBackup(
    input: unknown,
): Promise<SessionImportResult> {
    if (!isRecord(input)) {
        throw new Error("The selected file is not a valid LocalAgent-UI backup.");
    }

    let sessions: Session[];
    let messages: Message[];
    let promptPresets: PromptPreset[];

    if (input.format === "localagent-ui-backup") {
        if (
            input.version !== 1 ||
            !Array.isArray(input.sessions) ||
            !Array.isArray(input.messages) ||
            !Array.isArray(input.promptPresets)
        ) {
            throw new Error("The backup version or structure is not supported.");
        }
        sessions = input.sessions.map(validateSession);
        messages = input.messages.map(validateMessage);
        promptPresets = input.promptPresets.map(validatePromptPreset);
    } else if ("session" in input && "messages" in input) {
        if (!Array.isArray(input.messages)) {
            throw new Error("The selected session file is invalid.");
        }
        sessions = [validateSession(input.session)];
        messages = input.messages.map(validateMessage);
        promptPresets = [];
    } else {
        throw new Error("The selected file is not a supported backup.");
    }

    if (sessions.length === 0 && promptPresets.length === 0) {
        throw new Error("The backup does not contain any sessions or presets.");
    }

    assertUniqueIds(sessions, "session");
    assertUniqueIds(messages, "message");
    assertUniqueIds(promptPresets, "prompt preset");

    const sourceSessionIds = new Set(sessions.map((session) => session.id));
    if (messages.some((message) => !sourceSessionIds.has(message.sessionId))) {
        throw new Error("The backup contains messages without a matching session.");
    }

    const existingPresets = await db.promptPresets.toArray();
    const sessionIdMap = new Map(
        sessions.map((session) => [session.id, crypto.randomUUID()]),
    );
    const messageIdMap = new Map(
        messages.map((message) => [message.id, crypto.randomUUID()]),
    );
    const presetIdMap = new Map(
        promptPresets.map((preset) => [preset.id, crypto.randomUUID()]),
    );
    const availablePresetIds = new Set([
        ...PROMPT_PRESETS.map((preset) => preset.id),
        ...existingPresets.map((preset) => preset.id),
        ...promptPresets.map((preset) => preset.id),
    ]);

    const importedSessions = sessions.map((session) => {
        const presetId = session.presetId;
        return {
            ...session,
            id: sessionIdMap.get(session.id)!,
            ...(presetId
                ? {
                    presetId: presetIdMap.get(presetId) ??
                        (availablePresetIds.has(presetId)
                            ? presetId
                            : "code-assistant"),
                }
                : {}),
        };
    });
    const importedMessages = messages.map((message) => ({
        ...message,
        id: messageIdMap.get(message.id)!,
        sessionId: sessionIdMap.get(message.sessionId)!,
        ...(message.status === "streaming" ? { status: "interrupted" as const } : {}),
    }));
    const importedPresets = promptPresets.map((preset) => ({
        ...preset,
        id: presetIdMap.get(preset.id)!,
    }));

    await db.transaction(
        "rw",
        db.sessions,
        db.messages,
        db.promptPresets,
        async () => {
            if (importedSessions.length > 0) {
                await db.sessions.bulkAdd(importedSessions);
            }
            if (importedMessages.length > 0) {
                await db.messages.bulkAdd(importedMessages);
            }
            if (importedPresets.length > 0) {
                await db.promptPresets.bulkAdd(importedPresets);
            }
        },
    );

    return {
        sessions: importedSessions,
        messageCount: importedMessages.length,
        promptPresetCount: importedPresets.length,
    };
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