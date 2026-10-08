export interface StreamChunk {
    type: "thought_delta" | "text_delta";
    content: string;
}

export class StreamParser {
    private inThinkBlock = false;
    private buffer = "";

    parse(value: string): StreamChunk[] {
        this.buffer += value;
        const chunks: StreamChunk[] = [];

        while (this.buffer.length > 0) {
            const marker = this.inThinkBlock ? "</think>" : "<think>";
            const markerIndex = this.buffer.indexOf(marker);

            if (markerIndex >= 0) {
                this.pushChunk(chunks, this.buffer.slice(0, markerIndex));
                this.buffer = this.buffer.slice(markerIndex + marker.length);
                this.inThinkBlock = !this.inThinkBlock;
                continue;
            }

            const possibleMarkerLength = marker.length - 1;
            const textLength = Math.max(0, this.buffer.length - possibleMarkerLength);
            if (textLength > 0) {
                this.pushChunk(chunks, this.buffer.slice(0, textLength));
                this.buffer = this.buffer.slice(textLength);
            }
            break;
        }

        return chunks;
    }

    parseReasoning(value: string): StreamChunk[] {
        return value ? [{ type: "thought_delta", content: value }] : [];
    }

    flush(): StreamChunk[] {
        const chunks: StreamChunk[] = [];
        this.pushChunk(chunks, this.buffer);
        this.buffer = "";
        return chunks;
    }

    private pushChunk(chunks: StreamChunk[], content: string): void {
        if (content) {
            chunks.push({
                type: this.inThinkBlock ? "thought_delta" : "text_delta",
                content,
            });
        }
    }
}

export default StreamParser;
