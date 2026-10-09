import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createSession,
    db,
    deleteUserPromptPreset,
    getUserPromptPresets,
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
        await db.sessions.put({
            ...session,
            customSystemPrompt: preset.prompt,
        });

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
});
