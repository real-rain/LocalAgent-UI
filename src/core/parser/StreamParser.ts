export interface StreamChunk {
    type: "thought_delta" | "text_delta";
    content: string;
}

const THOUGHT_START_MARKERS = ["<think>", "[reasoning]", "Thinking Process:"];
const THOUGHT_END_MARKERS = ["</think>", "[/reasoning]"];
const THOUGHT_LIST_START =
    /^(?:分析|思考|梳理|理解|检查|评估|推演|analysis\b|analy[sz]e\b|thinking\b|think\b|review\b|consider\b|understand\b|inspect\b|identify\b)/i;

export class StreamParser {
    private inThinkBlock = false;
    private buffer = "";
    private hasEmittedText = false;

    parse(value: string): StreamChunk[] {
        this.buffer += value;
        return this.drain(false);
    }

    parseReasoning(value: string): StreamChunk[] {
        return value ? [{ type: "thought_delta", content: value }] : [];
    }

    flush(): StreamChunk[] {
        return this.drain(true);
    }

    private drain(flush: boolean): StreamChunk[] {
        const chunks: StreamChunk[] = [];

        while (this.buffer.length > 0) {
            if (this.inThinkBlock) {
                const endMarker = this.findMarker(THOUGHT_END_MARKERS);
                if (endMarker) {
                    this.pushChunk(chunks, this.buffer.slice(0, endMarker.index));
                    this.buffer = this.buffer.slice(
                        endMarker.index + endMarker.marker.length,
                    );
                    this.inThinkBlock = false;
                    continue;
                }

                const safeLength = flush
                    ? this.buffer.length
                    : this.buffer.length -
                      this.possibleMarkerSuffixLength(THOUGHT_END_MARKERS);
                if (safeLength > 0) {
                    this.pushChunk(chunks, this.buffer.slice(0, safeLength));
                    this.buffer = this.buffer.slice(safeLength);
                }
                break;
            }

            const startMarker = this.findMarker(THOUGHT_START_MARKERS);
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

            const safeLength = flush
                ? this.buffer.length
                : this.buffer.length -
                  this.possibleMarkerSuffixLength(THOUGHT_START_MARKERS);
            if (safeLength > 0) {
                this.pushChunk(chunks, this.buffer.slice(0, safeLength));
                this.buffer = this.buffer.slice(safeLength);
            }
            break;
        }

        return chunks;
    }

    private findMarker(markers: string[]): { marker: string; index: number } | undefined {
        let match: { marker: string; index: number } | undefined;
        const lowerBuffer = this.buffer.toLowerCase();

        for (const marker of markers) {
            const index = lowerBuffer.indexOf(marker.toLowerCase());
            if (index >= 0 && (!match || index < match.index)) {
                match = { marker, index };
            }
        }

        return match;
    }

    private possibleMarkerSuffixLength(markers: string[]): number {
        const lowerBuffer = this.buffer.toLowerCase();
        let maxLength = 0;

        for (const marker of markers) {
            const maxCandidateLength = Math.min(
                lowerBuffer.length,
                marker.length - 1,
            );
            for (let length = maxCandidateLength; length > maxLength; length -= 1) {
                if (
                    lowerBuffer.endsWith(marker.slice(0, length).toLowerCase())
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
