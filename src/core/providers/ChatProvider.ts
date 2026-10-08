import type { Message } from "../../types/chat";
import type { StreamChunk } from "../parser/StreamParser";

export type ProviderMessage = Pick<Message, "role" | "content">;

export interface ChatProvider {
    chatStream(
        modelId: string,
        messages: ProviderMessage[],
        systemPrompt: string,
        signal?: AbortSignal,
    ): AsyncGenerator<StreamChunk>;
}
