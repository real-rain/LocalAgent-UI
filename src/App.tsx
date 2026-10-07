/*
 * @Description: 
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 20:19:15
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 20:27:34
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\App.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";
import ChatMessageBubble from "./components/chat/ChatMessageBubble";
import { OllamaProvider } from "./core/providers/OllamaProvider";
import { useChatStore } from "./store/useChatStore";
import type { Message } from "./types/chat";

const mockMessage: Message = {
  role: "assistant",
  status: "complete",
  thoughtProcess:
    "1. 分析用户请求：生成一个计数器组件。\n2. 思考 CSS 样式与微交互动效...\n3. 编写符合 React 19 规范的代码并输出。",
  toolCalls: [
    {
      name: "execute_javascript",
      status: "success",
      arguments: { code: "console.log('Sandbox Ready')" },
      result: "Success",
    },
  ],
  content: `我已经准备好一个可交互的动态计数器页面。切换代码卡片右上角的 **Preview**，可以直接点击按钮测试计数效果。

\`\`\`html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>动态计数器</title>
  <style>
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #18181b, #27272a);
      color: #fafafa;
      font-family: system-ui, sans-serif;
    }
    .counter {
      width: min(90vw, 360px);
      padding: 36px;
      border: 1px solid #3f3f46;
      border-radius: 24px;
      background: #202023;
      text-align: center;
      box-shadow: 0 24px 80px #0006;
    }
    .counter h1 { margin: 0 0 8px; font-size: 1.25rem; }
    .value {
      display: block;
      margin: 24px 0;
      color: #a78bfa;
      font-size: 5rem;
      font-weight: 700;
      line-height: 1;
      transition: transform 180ms ease;
    }
    .value.bump { transform: scale(1.15); }
    button {
      padding: 12px 20px;
      border: 0;
      border-radius: 12px;
      background: #7c3aed;
      color: white;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms ease, transform 150ms ease;
    }
    button:hover { transform: translateY(-2px); background: #8b5cf6; }
    button:focus-visible { outline: 3px solid #c4b5fd; outline-offset: 3px; }
  </style>
</head>
<body>
  <main class="counter">
    <h1>动态计数器</h1>
    <p>点击按钮增加计数</p>
    <output class="value" id="value" aria-live="polite">0</output>
    <button id="increment" type="button">增加 +1</button>
  </main>
  <script>
    const value = document.querySelector("#value");
    let count = 0;
    document.querySelector("#increment").addEventListener("click", () => {
      value.textContent = String(++count);
      value.classList.add("bump");
      setTimeout(() => value.classList.remove("bump"), 180);
    });
  </script>
</body>
</html>
\`\`\``,
};

function App() {
  const messages = useChatStore((state) => state.messages);
  const addMessage = useChatStore((state) => state.addMessage);
  const appendStreamChunk = useChatStore((state) => state.appendStreamChunk);
  const setStreamingComplete = useChatStore((state) => state.setStreamingComplete);
  const setStreamingFailed = useChatStore((state) => state.setStreamingFailed);
  const clearMessages = useChatStore((state) => state.clearMessages);
  const [model, setModel] = useState("qwen2.5");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || abortControllerRef.current) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const conversation = [...messages, { role: "user" as const, content }];
    setInput("");
    setError(null);
    setIsSending(true);

    addMessage({ role: "user", content });
    addMessage({ role: "assistant", content: "", status: "streaming" });

    try {
      const provider = new OllamaProvider(model);
      for await (const chunk of provider.chatStream(conversation, controller.signal)) {
        appendStreamChunk(chunk);
      }
      setStreamingComplete();
    } catch (cause) {
      if (!controller.signal.aborted) {
        const message =
          cause instanceof Error ? cause.message : "与 Ollama 通信时发生未知错误。";
        setError(message);
        setStreamingFailed();
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsSending(false);
      }
    }
  }

  function loadMockMessage() {
    addMessage(mockMessage);
    setError(null);
  }

  function clearConversation() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
    setError(null);
    clearMessages();
  }

  return (
    <main className="flex h-[100dvh] min-h-[560px] flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="z-10 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
              LocalAgent-UI Studio
            </h1>
            <p className="text-xs text-zinc-500">Phase 1 &amp; 2 · Agent workspace</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="model-select">选择 Ollama 模型</label>
          <select
            id="model-select"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={isSending}
            className="h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none transition focus:border-violet-500 disabled:opacity-50"
          >
            <option value="qwen2.5">qwen2.5</option>
            <option value="llama3">llama3</option>
          </select>
          <button
            type="button"
            onClick={loadMockMessage}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 text-sm font-medium text-violet-200 transition hover:bg-violet-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">加载 Agent 测试假数据</span>
            <span className="sm:hidden">加载假数据</span>
          </button>
          <button
            type="button"
            onClick={clearConversation}
            disabled={messages.length === 0 && !isSending}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-sm text-zinc-400 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">清空对话</span>
          </button>
        </div>
      </header>

      <section
        ref={scrollContainerRef}
        aria-label="对话消息"
        className="flex-1 overflow-y-auto px-4 pb-36 pt-6 sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
              <div className="mb-5 grid size-14 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900 text-violet-300 shadow-xl shadow-violet-950/20">
                <Sparkles className="size-6" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-medium text-zinc-200">开始测试 Agent 工作流</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                加载假数据体验思考过程、工具调用和 HTML 实时预览，或连接本地 Ollama 开始对话。
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <ChatMessageBubble key={`${message.role}-${index}`} message={message} />
            ))
          )}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-300"
            >
              Ollama 请求失败：{error}
            </div>
          )}
          <div aria-hidden="true" />
        </div>
      </section>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800/80 bg-zinc-950/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:px-6">
        <form
          onSubmit={handleSend}
          className="mx-auto flex w-full max-w-4xl items-end gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-2xl shadow-black/30 focus-within:border-zinc-700"
        >
          <label className="sr-only" htmlFor="chat-input">输入消息</label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="给 Agent 发送消息…"
            rows={1}
            disabled={isSending}
            className="max-h-36 min-h-10 flex-1 resize-y bg-transparent px-3 py-2.5 text-sm leading-5 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50"
          />
          <button
            type="submit"
            aria-label="发送消息"
            disabled={!input.trim() || isSending}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500 text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
          >
            <Send className="size-4" aria-hidden="true" />
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-4xl text-center text-[11px] text-zinc-600">
          使用本地 Ollama · 按 Enter 发送，Shift + Enter 换行
        </p>
      </footer>
    </main>
  );
}

export default App;
