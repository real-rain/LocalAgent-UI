/*
 * @Description: 测试 IndexedDB 持久化、会话排序、流式响应恢复与提示词预设。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-09 14:59:54
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:32:35
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\db\indexedDB.test.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createSessionBackup,
    createSession,
    db,
    deleteUserPromptPreset,
    getUserPromptPresets,
    importSessionBackup,
    recoverInterruptedMessages,
    saveMessage,
    saveUserPromptPreset,
} from "./indexedDB";
import { useChatStore } from "../store/useChatStore";
import type { Message } from "../types/chat";

function resetChatStore() {
    useChatStore.setState({
        sessions: [],
        currentSessionId: null,
        messages: [],
        isStreaming: false,
        storageError: null,
    });
}

describe("local database workflows", () => {
    beforeEach(async () => {
        vi.spyOn(Date, "now").mockReturnValue(
            new Date("2026-01-01T00:00:00.000Z").getTime(),
        );
        await db.delete();
        await db.open();
        resetChatStore();
    });

    afterEach(async () => {
        resetChatStore();
        await db.delete();
        vi.restoreAllMocks();
    });

    it("moves a session to the top when a message is saved", async () => {
        const older = await useChatStore.getState().createNewSession("model-a");
        vi.mocked(Date.now).mockReturnValue(
            new Date("2026-01-01T00:00:01.000Z").getTime(),
        );
        const newer = await useChatStore.getState().createNewSession("model-b");

        vi.mocked(Date.now).mockReturnValue(
            new Date("2026-01-01T00:00:02.000Z").getTime(),
        );
        const message: Message = {
            id: "new-message",
            sessionId: older.id,
            createdAt: Date.now(),
            role: "user",
            content: "Bring this session to the top",
        };
        await useChatStore.getState().addMessage(message);

        expect(useChatStore.getState().sessions[0]?.id).toBe(older.id);
        expect(older.updatedAt).toBeLessThan(
            useChatStore.getState().sessions[0]!.updatedAt,
        );
        expect(newer.id).not.toBe(older.id);
    });

    it("recovers incomplete messages and preserves generated content", async () => {
        const session = await createSession("Interrupted", "model-a");
        const message: Message = {
            id: "interrupted-message",
            sessionId: session.id,
            createdAt: Date.now(),
            role: "assistant",
            content: "Partial answer",
            thoughtProcess: "Partial reasoning",
            status: "streaming",
        };
        await saveMessage(message);

        const recovered = await recoverInterruptedMessages();

        expect(recovered).toHaveLength(1);
        expect(recovered[0]).toMatchObject({
            id: message.id,
            status: "interrupted",
            content: message.content,
            thoughtProcess: message.thoughtProcess,
        });
        expect(await db.messages.get(message.id)).toMatchObject({
            status: "interrupted",
            content: message.content,
        });
    });

    it("persists documents and their embedding chunks", async () => {
        const document = {
            id: "document-1",
            title: "notes.txt",
            uploadTime: Date.now(),
            size: 12,
        };
        const chunk = {
            id: "chunk-1",
            docId: document.id,
            text: "Local knowledge",
            embedding: [0.25, 0.75],
        };

        await db.transaction("rw", db.documents, db.chunks, async () => {
            await db.documents.add(document);
            await db.chunks.add(chunk);
        });

        expect(await db.documents.get(document.id)).toEqual(document);
        expect(await db.chunks.where("docId").equals(document.id).toArray()).toEqual([
            chunk,
        ]);
    });

    it("persists streamed content while generation is still running", async () => {
        vi.stubGlobal("window", {
            setTimeout,
            clearTimeout,
            requestAnimationFrame: undefined,
            cancelAnimationFrame: clearTimeout,
        });
        const session = await useChatStore.getState().createNewSession("model-a");
        const message: Message = {
            id: "streaming-message",
            sessionId: session.id,
            createdAt: Date.now(),
            role: "assistant",
            content: "",
            status: "streaming",
        };
        await useChatStore.getState().addMessage(message);
        useChatStore
            .getState()
            .startGeneration(new AbortController(), message.id);
        useChatStore.getState().appendStreamChunk(message.id, {
            type: "text_delta",
            content: "Saved while streaming",
        });

        await new Promise((resolve) => setTimeout(resolve, 600));

        expect(await db.messages.get(message.id)).toMatchObject({
            content: "Saved while streaming",
            status: "streaming",
        });
        await useChatStore.getState().stopGeneration();
    });

    it("switches sessions to the default preset when deleting a user preset", async () => {
        const preset = await saveUserPromptPreset(
            "Reviewer",
            "Review code carefully.",
        );
        const session = await createSession("Review", "model-a", {
            presetId: preset.id,
        });
        const legacySession = {
            ...session,
            customSystemPrompt: preset.prompt,
        };
        await db.sessions.put(legacySession);

        expect(await getUserPromptPresets()).toEqual([preset]);
        await deleteUserPromptPreset(preset.id);

        expect(await getUserPromptPresets()).toEqual([]);
        const updatedSession = await db.sessions.get(session.id);
        expect(updatedSession).toMatchObject({
            presetId: "code-assistant",
        });
        expect(updatedSession).not.toHaveProperty("customSystemPrompt");
    });

    it("rejects empty presets and attempts to change built-ins", async () => {
        await expect(saveUserPromptPreset(" ", "prompt")).rejects.toThrow(
            "required",
        );
        await expect(
            saveUserPromptPreset("Override", "prompt", "translator"),
        ).rejects.toThrow("cannot be overwritten");
        await expect(deleteUserPromptPreset("translator")).rejects.toThrow(
            "cannot be deleted",
        );
    });

    it("exports and imports full backups without overwriting existing records", async () => {
        const existing = await createSession("Existing", "model-local");
        const preset = {
            id: "backup-reviewer",
            name: "Backup Reviewer",
            prompt: "Review imported code.",
            builtIn: false,
        };
        const backupSession = {
            id: existing.id,
            title: "Imported review",
            model: "model-backup",
            engine: "ollama" as const,
            presetId: preset.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        const backupMessage: Message = {
            id: "backup-message",
            sessionId: backupSession.id,
            createdAt: Date.now(),
            role: "assistant",
            content: "Partially generated",
            status: "streaming",
            thoughtProcess: "Imported thought",
        };
        const result = await importSessionBackup({
            format: "localagent-ui-backup",
            version: 1,
            exportedAt: Date.now(),
            sessions: [backupSession],
            messages: [backupMessage],
            promptPresets: [preset],
        });

        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0]?.id).not.toBe(existing.id);
        expect(result.sessions[0]?.presetId).not.toBe(preset.id);
        expect(result.messageCount).toBe(1);
        expect(result.promptPresetCount).toBe(1);

        const importedMessage = await db.messages
            .where("sessionId")
            .equals(result.sessions[0]!.id)
            .first();
        expect(importedMessage).toMatchObject({
            id: expect.not.stringMatching(/^backup-message$/),
            status: "interrupted",
            content: backupMessage.content,
            thoughtProcess: backupMessage.thoughtProcess,
        });
        expect(await db.sessions.get(existing.id)).toMatchObject({
            title: "Existing",
            model: "model-local",
        });
        expect(await db.promptPresets.get(result.sessions[0]!.presetId!)).toMatchObject({
            name: preset.name,
            prompt: preset.prompt,
        });

        const exportedBackup = await createSessionBackup();
        expect(exportedBackup).toMatchObject({
            format: "localagent-ui-backup",
            version: 1,
        });
        expect(exportedBackup.sessions).toHaveLength(2);
        expect(exportedBackup.messages).toHaveLength(1);
        expect(exportedBackup.promptPresets).toHaveLength(1);
    });

    it("imports legacy single-session JSON exports", async () => {
        const session = await createSession("Legacy", "model-a");
        const result = await importSessionBackup({
            session,
            messages: [
                {
                    id: "legacy-message",
                    sessionId: session.id,
                    createdAt: Date.now(),
                    role: "user",
                    content: "Legacy export",
                },
            ],
        });

        expect(result.sessions[0]?.id).not.toBe(session.id);
        expect(result.messageCount).toBe(1);
        expect(
            await db.messages.where("sessionId").equals(result.sessions[0]!.id).count(),
        ).toBe(1);
    });

    it("rejects malformed backups before writing any records", async () => {
        await expect(
            importSessionBackup({
                format: "localagent-ui-backup",
                version: 1,
                exportedAt: Date.now(),
                sessions: [{ id: "bad-session" }],
                messages: [],
                promptPresets: [],
            }),
        ).rejects.toThrow("invalid session");
        expect(await db.sessions.count()).toBe(0);
        expect(await db.messages.count()).toBe(0);
    });
});
