import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  Cpu,
  Plus,
  Send,
  Sidebar,
  Sparkles,
  Trash2,
} from "lucide-react";
import ChatMessageBubble from "./components/chat/ChatMessageBubble";
import { ModelSelectorPopover } from "./components/chat/ModelSelectorPopover";
import { OllamaProvider } from "./core/providers/OllamaProvider";
import { useChatStore } from "./store/useChatStore";
import type { Message } from "./types/chat";
import type { WebLLMProvider } from "./core/providers/WebLLMProvider";

const OLLAMA_MODEL = "qwen2.5";
let webLLMProvider: WebLLMProvider | null = null;

type Engine = "ollama" | "webgpu";

function App() {
  const sessions = useChatStore((state) => state.sessions);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const messages = useChatStore((state) => state.messages);
  const loadSessions = useChatStore((state) => state.loadSessions);
  const switchSession = useChatStore((state) => state.switchSession);
  const createNewSession = useChatStore((state) => state.createNewSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const addMessage = useChatStore((state) => state.addMessage);
  const appendStreamChunk = useChatStore((state) => state.appendStreamChunk);
  const setStreamingComplete = useChatStore((state) => state.setStreamingComplete);
  const setStreamingFailed = useChatStore((state) => state.setStreamingFailed);

  const [engineMode, setEngineMode] = useState<Engine>("ollama");
  const [modelName, setModelName] = useState(OLLAMA_MODEL);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isWebLLMLoading, setIsWebLLMLoading] = useState(false);
  const [isWebLLMReady, setIsWebLLMReady] = useState(false);
  const [webLLMProgress, setWebLLMProgress] = useState("");
  const [engineError, setEngineError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const webGPUInitializationRef = useRef<Promise<void> | null>(null);

  const initializeWebGPU = useCallback((modelId: string): Promise<void> => {
    if (webGPUInitializationRef.current) {
      return webGPUInitializationRef.current;
    }

    setEngineError(null);
    setWebLLMProgress("正在准备 WebGPU 模型…");
    setIsWebLLMLoading(true);
    setIsWebLLMReady(false);

    const initialization = import("./core/providers/WebLLMProvider")
      .then(({ WebLLMProvider: Provider }) => {
        webLLMProvider ??= new Provider();
        return webLLMProvider.initEngine(modelId, (progress) => {
          setWebLLMProgress(progress);
          const percentage = Number(
            progress.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? 0,
          );
          if (percentage >= 100) {
            setIsWebLLMReady(true);
            inputRef.current?.focus();
          }
        });
      })
      .then(() => {
        setIsWebLLMReady(true);
        inputRef.current?.focus();
      })
      .catch((cause: unknown) => {
        const message =
          cause instanceof Error ? cause.message : "WebGPU 模型初始化失败。";
        setEngineError(message);
        setIsWebLLMReady(false);
        throw cause;
      })
      .finally(() => {
        webGPUInitializationRef.current = null;
        setIsWebLLMLoading(false);
      });

    webGPUInitializationRef.current = initialization;
    return initialization;
  }, []);

  function handleEngineChange(nextEngine: Engine, nextModel: string) {
    setEngineMode(nextEngine);
    setModelName(nextModel);
    setEngineError(null);
    if (nextEngine === "webgpu") {
      setIsWebLLMReady(false);
    }
  }

  useEffect(() => {
    let isActive = true;
    void (async () => {
      try {
        await loadSessions();
        if (!isActive) return;

        const [latestSession] = useChatStore.getState().sessions;
        if (latestSession) {
          await switchSession(latestSession.id);
        }
      } catch (cause) {
        if (isActive) {
          setRequestError(
            cause instanceof Error ? cause.message : "无法加载本地会话。",
          );
        }
      } finally {
        if (isActive) setIsLoadingSessions(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [loadSessions, switchSession]);

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  function stopActiveStream() {
    if (!abortControllerRef.current) return;
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    setStreamingFailed();
    setIsSending(false);
  }

  async function handleNewChat() {
    stopActiveStream();
    setRequestError(null);
    try {
      await createNewSession(modelName);
    } catch (cause) {
      setRequestError(
        cause instanceof Error ? cause.message : "无法创建新会话。",
      );
    }
  }

  async function handleSwitchSession(sessionId: string) {
    if (sessionId === currentSessionId) return;
    stopActiveStream();
    setRequestError(null);
    try {
      await switchSession(sessionId);
    } catch (cause) {
      setRequestError(
        cause instanceof Error ? cause.message : "无法切换会话。",
      );
    }
  }

  async function handleDeleteSession(
    event: MouseEvent<HTMLButtonElement>,
    sessionId: string,
  ) {
    event.stopPropagation();
    if (sessionId === currentSessionId) stopActiveStream();
    setRequestError(null);

    try {
      await deleteSession(sessionId);
    } catch (cause) {
      setRequestError(
        cause instanceof Error ? cause.message : "无法删除会话。",
      );
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || abortControllerRef.current) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setInput("");
    setRequestError(null);
    setIsSending(true);

    try {
      const sessionId =
        currentSessionId ??
        (
          await createNewSession(
            modelName,
          )
        ).id;
      const createdAt = Date.now();
      const userMessage: Message = {
        id: crypto.randomUUID(),
        sessionId,
        createdAt,
        role: "user",
        content,
      };
      const assistantMessageId = crypto.randomUUID();

      await addMessage(userMessage);
      await addMessage({
        id: assistantMessageId,
        sessionId,
        createdAt: Date.now(),
        role: "assistant",
        content: "",
        status: "streaming",
      });

      const conversation = useChatStore.getState().messages;
      if (engineMode === "webgpu") {
        await initializeWebGPU(modelName);
        if (!webLLMProvider) {
          throw new Error("WebGPU 引擎初始化后不可用。");
        }
        for await (const chunk of webLLMProvider.chatStream(
          modelName,
          conversation,
          controller.signal,
        )) {
          appendStreamChunk(
            assistantMessageId,
            chunk.content,
            chunk.type === "thought_delta",
          );
        }
      } else {
        const ollamaMessages = conversation.map(({ role, content: text }) => ({
          role,
          content: text,
        }));
        const ollamaProvider = new OllamaProvider(modelName);
        for await (const chunk of ollamaProvider.chatStream(
          ollamaMessages,
          controller.signal,
        )) {
          appendStreamChunk(assistantMessageId, chunk);
        }
      }

      if (!controller.signal.aborted) {
        await setStreamingComplete(assistantMessageId);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setRequestError(
          cause instanceof Error ? cause.message : "与模型通信时发生未知错误。",
        );
        setStreamingFailed();
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsSending(false);
      }
    }
  }

  const currentSession = sessions.find(
    (session) => session.id === currentSessionId,
  );

  return (
    <main className="flex h-[100dvh] min-h-[560px] overflow-hidden bg-zinc-950 text-zinc-100">
      {isSidebarOpen && (
        <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/95">
          <div className="flex h-16 items-center justify-between border-b border-zinc-800 px-4">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg border border-violet-400/15 bg-violet-400/10 text-violet-300">
                <Sparkles className="size-4" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold tracking-tight">
                LocalAgent Studio
              </span>
            </div>
          </div>

          <div className="p-3">
            <button
              type="button"
              onClick={handleNewChat}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <Plus className="size-4" aria-hidden="true" />
              New Chat
            </button>
          </div>

          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Recent sessions
            </h2>
            <span className="text-[11px] tabular-nums text-zinc-600">
              {sessions.length}
            </span>
          </div>

          <nav
            aria-label="会话历史"
            className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3"
          >
            {isLoadingSessions ? (
              <p className="px-3 py-4 text-xs text-zinc-500">正在加载会话…</p>
            ) : sessions.length === 0 ? (
              <p className="px-3 py-4 text-xs leading-5 text-zinc-500">
                还没有会话。创建一个新对话即可开始。
              </p>
            ) : (
              sessions.map((session) => {
                const isCurrent = session.id === currentSessionId;
                return (
                  <div
                    key={session.id}
                    className={`group flex items-center gap-1 rounded-lg border px-2 py-1.5 transition ${
                      isCurrent
                        ? "border-zinc-800 bg-zinc-900"
                        : "border-transparent hover:bg-zinc-900/70"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleSwitchSession(session.id)}
                      aria-current={isCurrent ? "page" : undefined}
                      className="min-w-0 flex-1 px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                      <span
                        className={`block truncate text-[13px] ${
                          isCurrent ? "text-zinc-100" : "text-zinc-400"
                        }`}
                      >
                        {session.title || "新会话"}
                      </span>
                      <span className="mt-1 block text-[10px] text-zinc-600">
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`删除会话 ${session.title || "新会话"}`}
                      title="删除会话"
                      onClick={(event) =>
                        void handleDeleteSession(event, session.id)
                      }
                      className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-600 opacity-0 transition hover:bg-red-400/10 hover:text-red-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })
            )}
          </nav>

          <div className="border-t border-zinc-800 px-4 py-3">
            <p className="text-[11px] text-zinc-600">
              会话安全保存在本地 IndexedDB
            </p>
          </div>
        </aside>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="z-10 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label={isSidebarOpen ? "收起侧边栏" : "展开侧边栏"}
              title={isSidebarOpen ? "收起侧边栏" : "展开侧边栏"}
              onClick={() => setIsSidebarOpen((open) => !open)}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <Sidebar className="size-[18px]" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-medium text-zinc-200">
                {currentSession?.title || "新会话"}
              </h1>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                {engineMode === "ollama"
                  ? "本地 Ollama 推理"
                  : isWebLLMReady
                    ? "浏览器端 WebGPU 推理"
                    : "浏览器端模型运行环境"}
              </p>
            </div>
          </div>

          <fieldset
            disabled={isSending || isWebLLMLoading}
            className="shrink-0 border-0 p-0"
          >
            <ModelSelectorPopover
              selectedEngine={engineMode}
              selectedModel={modelName}
              isWebLLMReady={isWebLLMReady}
              isWebLLMLoading={isWebLLMLoading}
              onSelectEngine={(engine, model) =>
                handleEngineChange(engine, model)
              }
            />
          </fieldset>
        </header>

        <section
          ref={scrollContainerRef}
          aria-label="对话消息"
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-6 sm:px-6"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            {engineMode === "webgpu" && !isWebLLMReady ? (
              <div className="flex min-h-[52vh] items-center justify-center px-4 py-8">
                <section
                  aria-label="WebGPU 模型初始化"
                  className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-blue-500/20 bg-zinc-900/70 p-6 shadow-[0_0_70px_-24px_rgba(37,99,235,0.55)] sm:p-8"
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-blue-500/10 blur-3xl"
                  />
                  <div className="relative">
                    <div className="flex items-start gap-4">
                      <div className="relative grid size-12 shrink-0 place-items-center">
                        {isWebLLMLoading && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 animate-ping rounded-2xl bg-blue-500/15"
                          />
                        )}
                        <span className="absolute inset-0 rounded-2xl border border-blue-400/30 bg-blue-500/10 shadow-[0_0_28px_rgba(37,99,235,0.2)]" />
                        <Cpu
                          className={`relative size-5 text-blue-300 ${
                            isWebLLMLoading ? "animate-spin" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300/80">
                          Local inference · WebGPU
                        </p>
                        <h2 className="mt-2 text-sm font-semibold tracking-wide text-zinc-100">
                          WebGPU Accelerated Engine Initializing...
                        </h2>
                        <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                          {isWebLLMLoading
                            ? webLLMProgress || "正在准备端侧模型…"
                            : engineError
                              ? "初始化未完成，请重试。"
                              : "启动端侧模型后，即可在浏览器本地进行推理。"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-7">
                      <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
                        <span className="text-zinc-500">Model download</span>
                        <span className="tabular-nums text-blue-300">
                          {Number(
                            webLLMProgress.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ??
                              0,
                          ).toFixed(0)}
                          %
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-zinc-800"
                        role="progressbar"
                        aria-label="WebGPU 模型加载进度"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(
                          100,
                          Number(
                            webLLMProgress.match(
                              /(\d+(?:\.\d+)?)\s*%/,
                            )?.[1] ?? 0,
                          ),
                        )}
                      >
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              Number(
                                webLLMProgress.match(
                                  /(\d+(?:\.\d+)?)\s*%/,
                                )?.[1] ?? (isWebLLMLoading ? 8 : 0),
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {engineError && (
                      <p role="alert" className="mt-4 text-xs text-red-300">
                        WebGPU 初始化失败：{engineError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        void initializeWebGPU(modelName).catch(() => undefined)
                      }
                      disabled={isWebLLMLoading}
                      className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-blue-400/30 bg-blue-600 px-4 text-xs font-semibold tracking-wide text-white shadow-lg shadow-blue-950/30 transition hover:border-blue-300/50 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isWebLLMLoading ? (
                        <Cpu
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Cpu className="size-4" aria-hidden="true" />
                      )}
                      {isWebLLMLoading
                        ? "Initializing WebGPU Model…"
                        : "Initialize WebGPU Model"}
                    </button>
                  </div>
                </section>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[52vh] flex-col items-center justify-center px-4 text-center">
                <div className="mb-5 grid size-12 place-items-center rounded-xl border border-zinc-800 bg-zinc-900 text-violet-300 shadow-lg shadow-black/20">
                  <Sparkles className="size-5" aria-hidden="true" />
                </div>
                <h2 className="text-base font-medium text-zinc-200">
                  What can I help you build?
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  选择本地推理引擎，开始一段私密、流畅的 Agent 对话。
                </p>
                <p className="mt-5 rounded-md border border-zinc-800/80 bg-zinc-900/60 px-3 py-1.5 text-[11px] text-zinc-500">
                  {engineMode === "ollama"
                    ? `Ollama · ${modelName}`
                    : `WebGPU · ${modelName}`}
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} />
              ))
            )}
            {requestError && (
              <div
                role="alert"
                className="rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300"
              >
                {requestError}
              </div>
            )}
          </div>
        </section>

        <footer className="shrink-0 border-t border-zinc-800/80 bg-zinc-950/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:px-6">
          <form
            onSubmit={handleSend}
            className="mx-auto flex w-full max-w-4xl items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-xl shadow-black/20 transition focus-within:border-zinc-700"
          >
            <label className="sr-only" htmlFor="chat-input">
              输入消息
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={
                engineMode === "webgpu" && !isWebLLMReady
                  ? isWebLLMLoading
                    ? "WebGPU 模型加载中，请稍候..."
                    : "请先加载 WebGPU 端侧模型..."
                  : "Message your agent…"
              }
              rows={1}
              disabled={
                isSending || (engineMode === "webgpu" && !isWebLLMReady)
              }
              className="max-h-36 min-h-10 flex-1 resize-y bg-transparent px-3 py-2.5 text-sm leading-5 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50"
            />
            <button
              type="submit"
              aria-label="发送消息"
              disabled={
                !input.trim() ||
                isSending ||
                (engineMode === "webgpu" && !isWebLLMReady)
              }
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-500 text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-4xl text-center text-[10px] text-zinc-600">
            {engineMode === "ollama"
              ? "Ollama · localhost:11434"
              : "WebGPU · 模型仅在浏览器本地运行"}
            {"  ·  "}Enter 发送，Shift + Enter 换行
          </p>
        </footer>
      </section>
    </main>
  );
}

export default App;
