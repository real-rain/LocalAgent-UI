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

export interface StreamChunk {
    type: "thought_delta" | "text_delta";
    content: string;
}

const THOUGHT_START_MARKERS = ["<think>", "[reasoning]", "Thinking Process:"];
const THOUGHT_END_MARKERS = ["</think>", "[/reasoning]"];
const THOUGHT_LIST_START =
    /^(?:分析|思考|梳理|理解|检查|评估|推演|analysis\b|analy[sz]e\b|thinking\b|think\b|review\b|consider\b|understand\b|inspect\b|identify\b)/i;

/**
 * 增量解析模型输出，并保留被拆分到多个数据块中的标记。
 */
export class StreamParser {
    private inThinkBlock = false;
    private buffer = "";
    private hasEmittedText = false;

    /**
     * 接收可见输出文本，并发出所有可安全分类的数据块。
     * @param value 新收到的模型文本。
     * @returns 解析后的推理内容与可见文本增量。
     */
    parse(value: string): StreamChunk[] {
        if (!value) return [];
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

            if (this.inThinkBlock) {
                const endMarker = this.findMarker(
                    THOUGHT_END_MARKERS,
                    normalizedBuffer,
                );
                if (endMarker) {
                    this.pushChunk(chunks, this.buffer.slice(0, endMarker.index));
                    this.buffer = this.buffer.slice(
                        endMarker.index + endMarker.marker.length,
                    );
                    this.inThinkBlock = false;
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
            if (startMarker) {
                this.pushChunk(chunks, this.buffer.slice(0, startMarker.index));
                this.buffer = this.buffer.slice(
                    startMarker.index + startMarker.marker.length,
                );
                this.inThinkBlock = true;
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
                    THOUGHT_START_MARKERS,
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

    private isNumberedThoughtStart(): boolean {
        const match = /^\s*1[.)]\s+([\s\S]*)$/.exec(this.buffer);
        return Boolean(match && THOUGHT_LIST_START.test(match[1]));
    }

    private isPotentialNumberedThought(): boolean {
        if (!this.buffer.trim()) return true;
        return /^\s*1[.)](?:\s+[\s\S]{0,40})?$/.test(this.buffer);
    }

    private pushChunk(chunks: StreamChunk[], content: string): void {
        if (!content) return;
        const type = this.inThinkBlock ? "thought_delta" : "text_delta";
        chunks.push({ type, content });
        if (type === "text_delta") this.hasEmittedText = true;
    }
}

export default StreamParser;
