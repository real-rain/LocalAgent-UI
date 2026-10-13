/*
 * @Description: 将模型流式输出拆分为可见文本增量与推理内容增量。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-08 15:56:19
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:29:16
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\parser\StreamParser.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

export type StreamChunk =
    | {
        type: "thought_delta" | "text_delta";
        content: string;
    }
    | {
        type: "tool_call";
        toolCall: {
            id: string;
            name: string;
            arguments: Record<string, unknown>;
        };
    };

const THOUGHT_START_MARKERS = ["<think>", "[reasoning]", "Thinking Process:"];
const THOUGHT_END_MARKERS = ["</think>", "[/reasoning]"];
const TOOL_CALL_START = "<tool_call>";
const TOOL_CALL_END = "</tool_call>";
let toolCallSequence = 0;
const THOUGHT_LIST_START =
    /^(?:分析|思考|梳理|理解|检查|评估|推演|analysis\b|analy[sz]e\b|thinking\b|think\b|review\b|consider\b|understand\b|inspect\b|identify\b)/i;

/**
 * 增量解析模型输出，并保留被拆分到多个数据块中的标记。
 */
export class StreamParser {
    private inThinkBlock = false;
    private thoughtBlockClosed = false;
    private inToolCallBlock = false;
    private buffer = "";
    private hasEmittedText = false;
    private consecutiveThinkEndMarkers = 0;
    private stopRequested = false;

    get shouldStop(): boolean {
        return this.stopRequested;
    }

    /**
     * 接收可见输出文本，并发出所有可安全分类的数据块。
     * @param value 新收到的模型文本。
     * @returns 解析后的推理内容与可见文本增量。
     */
    parse(value: string): StreamChunk[] {
        if (!value || this.stopRequested) return [];
        this.buffer += value;
        return this.drain(false);
    }

    /**
     * 将 Provider 提供的推理内容直接转换为推理增量。
     * @param value 从 Provider 收到的推理文本。
     * @returns 有文本时返回推理增量，否则返回空数组。
     */
    parseReasoning(value: string): StreamChunk[] {
        return value ? [{ type: "thought_delta", content: value }] : [];
    }

    /**
     * 在数据流结束时处理缓冲区中剩余的文本。
     * @returns 剩余的推理内容与可见文本增量。
     */
    flush(): StreamChunk[] {
        return this.drain(true);
    }

    private drain(flush: boolean): StreamChunk[] {
        const chunks: StreamChunk[] = [];

        while (this.buffer.length > 0) {
            const normalizedBuffer = this.buffer.toLowerCase();

            if (this.inToolCallBlock) {
                const endIndex = normalizedBuffer.indexOf(TOOL_CALL_END);
                if (endIndex < 0) {
                    if (flush) {
                        this.pushChunk(
                            chunks,
                            `${TOOL_CALL_START}${this.buffer}`,
                        );
                        this.buffer = "";
                        this.inToolCallBlock = false;
                    }
                    break;
                }

                const rawCall = this.buffer.slice(0, endIndex);
                const toolCall = this.parseToolCall(rawCall);
                if (toolCall) {
                    chunks.push({ type: "tool_call", toolCall });
                } else {
                    this.pushChunk(
                        chunks,
                        `${TOOL_CALL_START}${rawCall}${TOOL_CALL_END}`,
                    );
                }
                this.buffer = this.buffer.slice(endIndex + TOOL_CALL_END.length);
                this.inToolCallBlock = false;
                continue;
            }

            const toolMarkerIndex = this.inThinkBlock
                ? -1
                : normalizedBuffer.indexOf(TOOL_CALL_START);
            const jsonStartIndex = this.inThinkBlock
                ? -1
                : this.findJsonCandidateStart();
            if (
                jsonStartIndex >= 0 &&
                (toolMarkerIndex < 0 || jsonStartIndex < toolMarkerIndex)
            ) {
                if (jsonStartIndex > 0) {
                    this.pushChunk(chunks, this.buffer.slice(0, jsonStartIndex));
                    this.buffer = this.buffer.slice(jsonStartIndex);
                }
                const jsonEnd = this.findBalancedJsonEnd(this.buffer);
                if (jsonEnd === null) {
                    if (flush) {
                        this.pushChunk(chunks, this.buffer);
                        this.buffer = "";
                    }
                    break;
                }
                const rawCall = this.buffer.slice(0, jsonEnd);
                const toolCall = this.parseToolCall(rawCall);
                if (toolCall) {
                    chunks.push({ type: "tool_call", toolCall });
                } else {
                    this.pushChunk(chunks, rawCall);
                }
                this.buffer = this.buffer.slice(jsonEnd);
                continue;
            }

            if (toolMarkerIndex >= 0) {
                this.pushChunk(chunks, this.buffer.slice(0, toolMarkerIndex));
                this.buffer = this.buffer.slice(
                    toolMarkerIndex + TOOL_CALL_START.length,
                );
                this.inToolCallBlock = true;
                continue;
            }

            if (this.inThinkBlock) {
                const endMarker = this.findMarker(
                    THOUGHT_END_MARKERS,
                    normalizedBuffer,
                );
                if (endMarker) {
                    const thought = this.buffer.slice(0, endMarker.index);
                    this.pushChunk(chunks, thought);
                    this.buffer = this.buffer.slice(
                        endMarker.index + endMarker.marker.length,
                    );
                    this.inThinkBlock = false;
                    this.thoughtBlockClosed = true;
                    if (thought) this.consecutiveThinkEndMarkers = 0;
                    this.recordThoughtEnd(endMarker.marker);
                    if (this.stopRequested) {
                        this.buffer = "";
                        break;
                    }
                    continue;
                }

                // 保留可能是结束标记前缀的尾部，避免标记跨网络分块时被误输出。
                const safeLength = flush
                    ? this.buffer.length
                    : this.buffer.length -
                    this.possibleMarkerSuffixLength(
                        THOUGHT_END_MARKERS,
                        normalizedBuffer,
                    );
                if (safeLength > 0) {
                    this.pushChunk(chunks, this.buffer.slice(0, safeLength));
                    this.buffer = this.buffer.slice(safeLength);
                }
                break;
            }

            const startMarker = this.findMarker(
                THOUGHT_START_MARKERS,
                normalizedBuffer,
            );
            const endMarker = this.findMarker(
                THOUGHT_END_MARKERS,
                normalizedBuffer,
            );
            if (
                startMarker &&
                (!endMarker || startMarker.index < endMarker.index)
            ) {
                this.pushChunk(chunks, this.buffer.slice(0, startMarker.index));
                this.buffer = this.buffer.slice(
                    startMarker.index + startMarker.marker.length,
                );
                if (!this.thoughtBlockClosed) {
                    this.inThinkBlock = true;
                }
                continue;
            }

            if (endMarker) {
                this.pushChunk(chunks, this.buffer.slice(0, endMarker.index));
                this.buffer = this.buffer.slice(
                    endMarker.index + endMarker.marker.length,
                );
                this.thoughtBlockClosed = true;
                this.recordThoughtEnd(endMarker.marker);
                if (this.stopRequested) {
                    this.buffer = "";
                    break;
                }
                continue;
            }

            if (!this.hasEmittedText && this.isNumberedThoughtStart()) {
                this.inThinkBlock = true;
                continue;
            }

            if (!this.hasEmittedText && this.isPotentialNumberedThought()) {
                if (flush) {
                    this.pushChunk(chunks, this.buffer);
                    this.buffer = "";
                }
                break;
            }

            // 未闭合的起始标记前缀也暂存到下一块，确认后再分类输出。
            const safeLength = flush
                ? this.buffer.length
                : this.buffer.length -
                this.possibleMarkerSuffixLength(
                    [
                        ...THOUGHT_START_MARKERS,
                        ...THOUGHT_END_MARKERS,
                        TOOL_CALL_START,
                    ],
                    normalizedBuffer,
                );
            if (safeLength > 0) {
                this.pushChunk(chunks, this.buffer.slice(0, safeLength));
                this.buffer = this.buffer.slice(safeLength);
            }
            break;
        }

        if (flush) {
            this.inThinkBlock = false;
            this.inToolCallBlock = false;
            this.buffer = "";
        }

        return chunks;
    }

    private findMarker(
        markers: string[],
        normalizedBuffer: string,
    ): { marker: string; index: number } | undefined {
        let match: { marker: string; index: number } | undefined;

        for (const marker of markers) {
            const index = normalizedBuffer.indexOf(marker.toLowerCase());
            if (index >= 0 && (!match || index < match.index)) {
                match = { marker, index };
            }
        }

        return match;
    }

    private possibleMarkerSuffixLength(
        markers: string[],
        normalizedBuffer: string,
    ): number {
        let maxLength = 0;

        for (const marker of markers) {
            const maxCandidateLength = Math.min(
                normalizedBuffer.length,
                marker.length - 1,
            );
            for (let length = maxCandidateLength; length > maxLength; length -= 1) {
                if (
                    normalizedBuffer.endsWith(marker.slice(0, length).toLowerCase())
                ) {
                    maxLength = length;
                    break;
                }
            }
        }

        return maxLength;
    }

    private findJsonCandidateStart(): number {
        let index = this.buffer.indexOf("{");
        while (index >= 0) {
            const remainder = this.buffer.slice(index + 1).trimStart();
            const namePrefix = '"name"';
            const comparable = remainder.slice(0, namePrefix.length);
            const couldBeName = namePrefix.startsWith(comparable);
            const afterName = remainder.slice(namePrefix.length).trimStart();
            if (
                couldBeName &&
                (remainder.length < namePrefix.length ||
                    afterName.length === 0 ||
                    afterName.startsWith(":"))
            ) {
                return index;
            }
            index = this.buffer.indexOf("{", index + 1);
        }
        return -1;
    }

    private findBalancedJsonEnd(value: string): number | null {
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let index = 0; index < value.length; index += 1) {
            const character = value[index];
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (character === "\\") {
                    escaped = true;
                } else if (character === '"') {
                    inString = false;
                }
                continue;
            }

            if (character === '"') {
                inString = true;
            } else if (character === "{") {
                depth += 1;
            } else if (character === "}") {
                depth -= 1;
                if (depth === 0) return index + 1;
            }
        }
        return null;
    }

    private parseToolCall(
        value: string,
    ): { id: string; name: string; arguments: Record<string, unknown> } | undefined {
        try {
            const parsed: unknown = JSON.parse(value.trim());
            if (
                !parsed ||
                typeof parsed !== "object" ||
                Array.isArray(parsed) ||
                !("name" in parsed) ||
                typeof parsed.name !== "string" ||
                !("arguments" in parsed) ||
                !parsed.arguments ||
                typeof parsed.arguments !== "object" ||
                Array.isArray(parsed.arguments)
            ) {
                return undefined;
            }
            return {
                id: `tool_call_${Date.now()}_${++toolCallSequence}_${Math.random().toString(36).substring(2, 7)}`,
                name: parsed.name,
                arguments: parsed.arguments as Record<string, unknown>,
            };
        } catch {
            return undefined;
        }
    }

    private isNumberedThoughtStart(): boolean {
        const match = /^\s*1[.)]\s+([\s\S]*)$/.exec(this.buffer);
        return Boolean(match && THOUGHT_LIST_START.test(match[1]));
    }

    private isPotentialNumberedThought(): boolean {
        if (!this.buffer.trim()) return true;
        return /^\s*1[.)](?:\s+[\s\S]{0,40})?$/.test(this.buffer);
    }

    private pushChunk(chunks: StreamChunk[], content: string): void {
        const cleanedContent = content.replace(/<\/?think>/gi, "");
        if (!cleanedContent) return;
        this.consecutiveThinkEndMarkers = 0;
        const type = this.inThinkBlock ? "thought_delta" : "text_delta";
        chunks.push({ type, content: cleanedContent });
        if (type === "text_delta") this.hasEmittedText = true;
    }

    private recordThoughtEnd(marker: string): void {
        if (marker.toLowerCase() === "</think>") {
            this.consecutiveThinkEndMarkers += 1;
            this.stopRequested = this.consecutiveThinkEndMarkers > 3;
        } else {
            this.consecutiveThinkEndMarkers = 0;
        }
    }
}

export default StreamParser;
