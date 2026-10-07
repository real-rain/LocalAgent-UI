/*
 * @Description: WebGPU 浏览器端推理 Worker
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 21:07:32
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 21:09:39
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\core\workers\webllm.worker.ts
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);