/*
 * @Description:  定义聊天模型 Provider 共用的流式响应接口。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-08 21:48:22
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:29:32
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\providers\ChatProvider.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

import type { Message } from "../../types/chat";
import type { StreamChunk } from "../parser/StreamParser";

export type ProviderMessage = Pick<Message, "role" | "content">;

/** 本地推理与浏览器推理 Provider 共用的流式接口。 */
export interface ChatProvider {
    /**
     * 将对话发送给模型，并逐步产出解析后的响应增量。
     * @param modelId Provider 使用的模型标识符。
     * @param messages 不包含系统提示词的对话历史。
     * @param systemPrompt 添加到对话开头的系统指令。
     * @param signal 用于取消生成的可选信号。
     * @returns 包含推理内容与可见文本增量的异步数据流。
     */
    chatStream(
        modelId: string,
        messages: ProviderMessage[],
        systemPrompt: string,
        signal?: AbortSignal,
    ): AsyncGenerator<StreamChunk>;
}
