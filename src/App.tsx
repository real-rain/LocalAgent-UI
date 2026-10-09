import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Mail,
  Plus,
  Send,
  Sidebar,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import githubIcon from "./assets/GitHub.svg";
import logo from "./assets/logo.svg";
import telegramIcon from "./assets/telegram.svg";
import twitterIcon from "./assets/tuite-copy.svg";
import ChatMessageBubble from "./components/chat/ChatMessageBubble";
import { ModelSelectorPopover } from "./components/chat/ModelSelectorPopover";
import { PromptPresetSelector } from "./components/chat/PromptPresetSelector";
import { WebGPULoaderCard } from "./components/chat/WebGPULoaderCard";
import { OllamaProvider } from "./core/providers/OllamaProvider";
import type { ChatProvider } from "./core/providers/ChatProvider";
import {
  getPresetPrompt,
  PROMPT_PRESETS,
  type PromptPreset,
  type PromptPresetId,
} from "./core/providers/presets";
import {
  deleteUserPromptPreset,
  getUserPromptPresets,
  saveUserPromptPreset,
} from "./db/indexedDB";
import { useAutoScroll } from "./hooks/useAutoScroll";
import { useChatStore } from "./store/useChatStore";
import type { Message } from "./types/chat";
import type { WebLLMProvider } from "./core/providers/WebLLMProvider";

let webLLMProvider: WebLLMProvider | null = null;

type Engine = "ollama" | "webgpu";

const CONTACT_EMAIL = "1936648485@qq.com";

const starterSuggestions = [
  {
    id: "livePreview",
  },
  {
    id: "cotReasoning",
  },
  {
    id: "toolCalling",
  },
  {
    id: "quickAnswer",
  },
];

function App() {
  const { t, i18n } = useTranslation();
  const sessions = useChatStore((state) => state.sessions);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const messages = useChatStore((state) => state.messages);
  const switchSession = useChatStore((state) => state.switchSession);
  const createNewSession = useChatStore((state) => state.createNewSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const updateSessionSettings = useChatStore(
    (state) => state.updateSessionSettings,
  );
  const addMessage = useChatStore((state) => state.addMessage);
  const updateTitleFromFirstMessage = useChatStore(
    (state) => state.updateTitleFromFirstMessage,
  );
  const startGeneration = useChatStore((state) => state.startGeneration);
  const stopGeneration = useChatStore((state) => state.stopGeneration);
  const appendStreamChunk = useChatStore((state) => state.appendStreamChunk);
  const setStreamingComplete = useChatStore((state) => state.setStreamingComplete);
  const setStreamingFailed = useChatStore((state) => state.setStreamingFailed);
  const recoverInterruptedStreams = useChatStore(
    (state) => state.recoverInterruptedStreams,
  );
  const reloadSessions = useChatStore((state) => state.loadSessions);
  const storageError = useChatStore((state) => state.storageError);

  const [engineMode, setEngineMode] = useState<Engine>("ollama");
  const [modelName, setModelName] = useState("");
  const [promptPresetId, setPromptPresetId] =
    useState<PromptPresetId>("code-assistant");
  const [userPromptPresets, setUserPromptPresets] = useState<PromptPreset[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isWebLLMLoading, setIsWebLLMLoading] = useState(false);
  const [webLLMReadyModel, setWebLLMReadyModel] = useState<string | null>(null);
  const [webLLMProgress, setWebLLMProgress] = useState("");
  const [engineError, setEngineError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isWebLLMReady =
    engineMode === "webgpu" && webLLMReadyModel === modelName;
  const isStreaming = useChatStore((state) => state.isStreaming);
  const {
    scrollRef: scrollContainerRef,
    isAtBottom,
    scrollToBottom,
  } = useAutoScroll(messages, isStreaming);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCreatingSessionRef = useRef(false);
  const webGPUInitializationRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!copyToast) return;
    const timeout = window.setTimeout(() => setCopyToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyToast]);

  async function handleCopyContact() {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopyToast(t("footer.copiedContact", { email: CONTACT_EMAIL }));
    } catch {
      setCopyToast(t("footer.copyContactFailed"));
    }
  }

  function handleLanguageToggle() {
    if (isStreaming) return;

    const newLang = i18n.resolvedLanguage?.startsWith("zh") ? "en" : "zh";
    void i18n.changeLanguage(newLang);
    window.localStorage.setItem("app-language", newLang);
  }

  const handleInitWebLLM = useCallback((): Promise<void> => {
    if (!modelName) return Promise.resolve();

    if (webGPUInitializationRef.current) {
      return webGPUInitializationRef.current;
    }

    setEngineError(null);
    setWebLLMProgress(t("chat.acceleratedEngineInitializing"));
    setIsWebLLMLoading(true);

    const initialization = import("./core/providers/WebLLMProvider")
      .then(({ WebLLMProvider: Provider }) => {
        webLLMProvider ??= new Provider();
        return webLLMProvider.initEngine(modelName, (report) => {
          setWebLLMProgress(report);
        });
      })
      .then(() => {
        setWebLLMReadyModel(modelName);
      })
      .catch((cause: unknown) => {
        const message =
          cause instanceof Error
            ? cause.message
            : t("errors.webgpuInitializationFailed");
        setEngineError(message);
        throw cause;
      })
      .finally(() => {
        webGPUInitializationRef.current = null;
        setIsWebLLMLoading(false);
      });

    webGPUInitializationRef.current = initialization;
    return initialization;
  }, [modelName, t]);

  function handleEngineChange(nextEngine: Engine, nextModel: string) {
    if (isStreaming) return;

    setEngineMode(nextEngine);
    setModelName(nextModel);
    setEngineError(null);
    if (currentSessionId) {
      void updateSessionSettings(currentSessionId, {
        engine: nextEngine,
        model: nextModel,
      }).catch((cause: unknown) => {
        setRequestError(
          cause instanceof Error ? cause.message : t("errors.saveSessionSettings"),
        );
      });
    }
  }

  function applySessionSettings(sessionId: string) {
    const session = useChatStore
      .getState()
      .sessions.find((item) => item.id === sessionId);
    if (!session) return;

    setEngineMode(session.engine ?? "ollama");
    setModelName(session.model);
    setPromptPresetId(
      session.presetId === "custom-agent"
        ? "code-assistant"
        : session.presetId ?? "code-assistant",
    );
    setEngineError(null);
  }

  function handlePresetChange(presetId: PromptPresetId) {
    setPromptPresetId(presetId);
    if (currentSessionId) {
      void updateSessionSettings(currentSessionId, {
        presetId,
      }).catch(
        (cause: unknown) => {
          setRequestError(
            cause instanceof Error
              ? cause.message
              : t("errors.saveSessionSettings"),
          );
        },
      );
    }
  }

  async function handleSavePromptPreset(
    name: string,
    prompt: string,
    id?: string,
  ): Promise<PromptPreset> {
    const preset = await saveUserPromptPreset(name, prompt, id);
    setUserPromptPresets((current) => [
      ...current.filter((item) => item.id !== preset.id),
      preset,
    ]);
    return preset;
  }

  async function handleDeletePromptPreset(id: string) {
    await deleteUserPromptPreset(id);
    setUserPromptPresets((current) => current.filter((item) => item.id !== id));
    await reloadSessions();
  }

  useEffect(() => {
    if (
      engineMode === "webgpu" &&
      modelName &&
      !isWebLLMReady &&
      !isWebLLMLoading &&
      !engineError
    ) {
      void handleInitWebLLM().catch(() => undefined);
    }
  }, [
    engineMode,
    modelName,
    isWebLLMReady,
    isWebLLMLoading,
    engineError,
    handleInitWebLLM,
  ]);

  useEffect(() => {
    let isActive = true;
    void (async () => {
      try {
        const savedPresets = await getUserPromptPresets();
        if (!isActive) return;
        setUserPromptPresets(savedPresets);
        await recoverInterruptedStreams();
        if (!isActive) return;

        const [latestSession] = useChatStore.getState().sessions;
        if (latestSession) {
          await switchSession(latestSession.id);
          if (isActive) applySessionSettings(latestSession.id);
        }
      } catch (cause) {
        if (isActive) {
          setRequestError(
            cause instanceof Error ? cause.message : t("errors.loadSessions"),
          );
        }
      } finally {
        if (isActive) setIsLoadingSessions(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [recoverInterruptedStreams, switchSession, t]);

  async function stopActiveStream() {
    if (!abortControllerRef.current && !isStreaming) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
    await stopGeneration().catch((cause: unknown) => {
      setRequestError(
        cause instanceof Error
          ? cause.message
          : t("errors.unknownModelCommunication"),
      );
    });
  }

  async function handleNewChat() {
    if (isCreatingSessionRef.current) return;
    isCreatingSessionRef.current = true;
    setRequestError(null);
    try {
      if (isStreaming || abortControllerRef.current) {
        await stopActiveStream();
      }
      const session = await createNewSession(modelName, {
        engine: engineMode,
        presetId: promptPresetId,
      });
      applySessionSettings(session.id);
      setInput("");
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } catch (cause) {
      setRequestError(
        cause instanceof Error ? cause.message : t("errors.createSession"),
      );
    } finally {
      isCreatingSessionRef.current = false;
    }
  }

  async function handleSwitchSession(sessionId: string) {
    if (sessionId === currentSessionId) return;
    await stopActiveStream();
    setRequestError(null);
    try {
      await switchSession(sessionId);
      applySessionSettings(sessionId);
    } catch (cause) {
      setRequestError(
        cause instanceof Error ? cause.message : t("errors.switchSession"),
      );
    }
  }

  async function handleDeleteSession(
    event: MouseEvent<HTMLButtonElement>,
    sessionId: string,
  ) {
    event.stopPropagation();
    if (sessionId === currentSessionId) await stopActiveStream();
    setRequestError(null);

    try {
      await deleteSession(sessionId);
      const nextSessionId = useChatStore.getState().currentSessionId;
      if (nextSessionId) applySessionSettings(nextSessionId);
    } catch (cause) {
      setRequestError(
        cause instanceof Error ? cause.message : t("errors.deleteSession"),
      );
    }
  }

  async function handleSendMessage(promptText: string) {
    const content = promptText.trim();
    if (!content) {
      if (isSending || abortControllerRef.current) return;
      const { currentSessionId: sessionId, messages: currentMessages } =
        useChatStore.getState();
      if (sessionId && currentMessages.length === 0) {
        try {
          await updateTitleFromFirstMessage(sessionId, promptText);
        } catch (cause) {
          setRequestError(
            cause instanceof Error
              ? cause.message
              : t("errors.unknownModelCommunication"),
          );
        }
      }
      return;
    }
    if (isSending || abortControllerRef.current) return;
    if (!modelName) {
      setRequestError(t("errors.selectModel"));
      return;
    }

    setInput("");
    setRequestError(null);
    setIsSending(true);

    let controller: AbortController | null = null;
    let assistantMessageId: string | null = null;
    try {
      const sessionId =
        currentSessionId ??
        (
          await createNewSession(modelName, {
            engine: engineMode,
            presetId: promptPresetId,
          })
        ).id;
      if (
        currentSessionId !== sessionId &&
        useChatStore.getState().currentSessionId !== sessionId
      ) {
        return;
      }
      await updateTitleFromFirstMessage(sessionId, content);
      if (useChatStore.getState().currentSessionId !== sessionId) return;
      controller = new AbortController();
      abortControllerRef.current = controller;
      const createdAt = Date.now();
      const userMessage: Message = {
        id: crypto.randomUUID(),
        sessionId,
        createdAt,
        role: "user",
        content,
      };
      const streamMessageId = crypto.randomUUID();
      assistantMessageId = streamMessageId;

      startGeneration(controller, streamMessageId);
      await addMessage(userMessage);
      if (controller.signal.aborted) return;
      await addMessage({
        id: streamMessageId,
        sessionId,
        createdAt: Date.now(),
        role: "assistant",
        content: "",
        status: "streaming",
      });
      if (controller.signal.aborted) return;

      const conversation = useChatStore
        .getState()
        .messages.filter((message) => message.id !== streamMessageId)
        .map(({ role, content: text }) => ({ role, content: text }));
      let provider: ChatProvider;
      if (engineMode === "webgpu") {
        await handleInitWebLLM();
        if (!webLLMProvider) {
          throw new Error(t("errors.webgpuUnavailable"));
        }
        provider = webLLMProvider;
      } else {
        provider = new OllamaProvider();
      }

      const systemPrompt = getPresetPrompt(
        promptPresetId,
        [...PROMPT_PRESETS, ...userPromptPresets],
      );
      for await (const chunk of provider.chatStream(
        modelName,
        conversation,
        systemPrompt,
        controller.signal,
      )) {
        if (controller.signal.aborted) break;
        appendStreamChunk(streamMessageId, chunk);
      }

      if (!controller.signal.aborted) {
        await setStreamingComplete(streamMessageId);
      }
    } catch (cause) {
      if (!controller?.signal.aborted) {
        setRequestError(
          cause instanceof Error
            ? cause.message
            : t("errors.unknownModelCommunication"),
        );
        await setStreamingFailed(assistantMessageId ?? undefined).catch(
          (failure: unknown) => {
            setRequestError(
              failure instanceof Error
                ? failure.message
                : t("errors.unknownModelCommunication"),
            );
          },
        );
      }
    } finally {
      if (controller && abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsSending(false);
      } else if (!controller) {
        setIsSending(false);
      }
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleSendMessage(input);
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
              <img
                src={logo}
                alt={t("common.logoAlt")}
                className="w-6 h-6 rounded-md shadow-sm"
              />
              <span className="bg-gradient-to-r from-indigo-300 via-blue-300 to-cyan-300 bg-clip-text text-sm font-semibold tracking-tight text-transparent">
                LocalAgent-UI
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
              {t("sidebar.newChat")}
            </button>
          </div>

          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {t("sidebar.recentSessions")}
            </h2>
            <span className="text-[11px] tabular-nums text-zinc-600">
              {sessions.length}
            </span>
          </div>

          <nav
            aria-label={t("sidebar.recentSessions")}
            className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3"
          >
            {isLoadingSessions ? (
              <p className="px-3 py-4 text-xs text-zinc-500">
                {t("sidebar.loadingSessions")}
              </p>
            ) : sessions.length === 0 ? (
              <p className="px-3 py-4 text-xs leading-5 text-zinc-500">
                {t("sidebar.emptySessions")}
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
                      <motion.span
                        key={session.title}
                        title={session.title}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className={`block truncate text-[13px] ${
                          isCurrent
                            ? "max-w-[180px] text-zinc-100"
                            : "max-w-[180px] text-zinc-400"
                        }`}
                      >
                        {session.title || t("sidebar.newSession")}
                      </motion.span>
                      <span className="mt-1 block text-[10px] text-zinc-600">
                        {new Date(session.updatedAt).toLocaleDateString(
                          i18n.resolvedLanguage ?? i18n.language,
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${t("sidebar.delete")} ${session.title || t("sidebar.newSession")}`}
                      title={t("sidebar.delete")}
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
              {t("sidebar.localStorageNote")}
            </p>
          </div>

          <footer className="relative border-t border-zinc-800/80 bg-zinc-950/50 p-3">
            {copyToast && (
              <p
                role="status"
                aria-live="polite"
                className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-zinc-800 bg-zinc-900/90 px-2 py-1 text-xs text-zinc-200 shadow-lg backdrop-blur"
              >
                {copyToast}
              </p>
            )}
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span
                aria-label={t("common.liveStatus")}
                className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
              />
              <span>{t("footer.createdBy")}</span>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <a
                href="https://github.com/real-rain"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub: real-rain"
                title="GitHub: real-rain"
                className="group grid size-8 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <img
                  src={githubIcon}
                  alt=""
                  className="size-4 brightness-0 invert opacity-60 transition-opacity group-hover:opacity-100"
                />
              </a>
              <a
                href="https://x.com/realrain___"
                target="_blank"
                rel="noreferrer"
                aria-label="X: realrain___"
                title="X: realrain___"
                className="group grid size-8 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <img
                  src={twitterIcon}
                  alt=""
                  className="size-4 brightness-0 invert opacity-60 transition-opacity group-hover:opacity-100"
                />
              </a>
              <a
                href="https://t.me/real_rain"
                target="_blank"
                rel="noreferrer"
                aria-label="Telegram: real_rain"
                title="Telegram: real_rain"
                className="group grid size-8 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <img
                  src={telegramIcon}
                  alt=""
                  className="size-4 transition-opacity group-hover:opacity-80"
                />
              </a>
              <button
                type="button"
                aria-label={t("footer.copyContact", { email: CONTACT_EMAIL })}
                onClick={() => void handleCopyContact()}
                className="group relative grid size-8 cursor-pointer place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <Mail className="size-4" aria-hidden="true" />
                <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden whitespace-nowrap rounded border border-zinc-800 bg-zinc-900/90 px-2 py-1 text-xs text-zinc-200 shadow-lg backdrop-blur group-hover:block group-focus-visible:block">
                  {t("footer.copyContact", { email: CONTACT_EMAIL })}
                </span>
              </button>
            </div>
          </footer>
        </aside>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="z-10 grid min-h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label={
                isSidebarOpen
                  ? t("sidebar.collapseSidebar")
                  : t("sidebar.expandSidebar")
              }
              title={
                isSidebarOpen
                  ? t("sidebar.collapseSidebar")
                  : t("sidebar.expandSidebar")
              }
              onClick={() => setIsSidebarOpen((open) => !open)}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <Sidebar className="size-[18px]" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-medium text-zinc-200">
                {currentSession?.title || t("sidebar.newSession")}
              </h1>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                {engineMode === "ollama"
                  ? t("header.localOllama")
                  : isWebLLMReady
                    ? t("header.browserWebgpu")
                    : t("header.browserRuntime")}
              </p>
            </div>
          </div>

          <fieldset
            disabled={isStreaming}
            className="min-w-0 max-w-[min(70vw,40rem)] justify-self-center border-0 p-0"
          >
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ModelSelectorPopover
                selectedEngine={engineMode}
                selectedModel={modelName}
                isWebLLMReady={isWebLLMReady}
                isWebLLMLoading={isWebLLMLoading}
                disabled={isStreaming}
                onSelectEngine={(engine, model) =>
                  handleEngineChange(engine, model)
                }
              />
              <PromptPresetSelector
                presetId={promptPresetId}
                presets={userPromptPresets}
                disabled={isStreaming}
                onPresetChange={handlePresetChange}
                onSavePreset={handleSavePromptPreset}
                onDeletePreset={handleDeletePromptPreset}
              />
            </div>
          </fieldset>
          <button
            type="button"
            aria-label={t("common.switchLanguage")}
            disabled={isStreaming}
            title={
              isStreaming
                ? t(
                    "header.disabledWhileGenerating",
                    "Cannot change language while generating",
                  )
                : t("common.switchLanguage")
            }
            onClick={handleLanguageToggle}
            className={`shrink-0 justify-self-end px-2.5 py-1 text-xs rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              isStreaming
                ? "opacity-50 cursor-not-allowed pointer-events-none"
                : ""
            }`}
          >
            {i18n.resolvedLanguage?.startsWith("zh") ? "ZH" : "EN"}
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollContainerRef}
            role="region"
            aria-label={t("chat.conversationMessages")}
            className="chat-messages-scroll h-full overflow-y-auto px-4 pb-8 pt-6 sm:px-6"
          >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            {engineMode === "webgpu" && !isWebLLMReady ? (
              <WebGPULoaderCard
                progress={webLLMProgress}
                isLoading={isWebLLMLoading}
                error={engineError}
                onRetry={() => void handleInitWebLLM().catch(() => undefined)}
              />
            ) : messages.length === 0 ? (
              <div className="flex min-h-[52vh] flex-col items-center justify-center py-8 text-center">
                <img
                  src={logo}
                  alt={t("common.logoAlt")}
                  className="w-12 h-12 mb-3 drop-shadow-[0_0_15px_rgba(99,102,241,0.3)] animate-pulse"
                />
                <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
                  {t("chat.welcomeTitle")}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                  {t("chat.welcomeDescription")}
                </p>
                <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 px-4 md:grid-cols-2">
                  {starterSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() =>
                        setInput(t(`starterCards.${suggestion.id}.prompt`))
                      }
                      className="group flex cursor-pointer flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition-all hover:border-zinc-700/80 hover:bg-zinc-800/80 hover:shadow-lg hover:shadow-indigo-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      <span className="w-fit rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-400 transition-colors group-hover:text-indigo-300">
                        {t(`starterCards.${suggestion.id}.tag`)}
                      </span>
                      <span className="mt-2 text-sm font-semibold text-zinc-200 transition-colors group-hover:text-zinc-100">
                        {t(`starterCards.${suggestion.id}.title`)}
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs font-medium text-zinc-300 group-hover:text-zinc-100">
                        {t(`starterCards.${suggestion.id}.description`)}
                      </span>
                      <ArrowUpRight className="ml-auto mt-2 h-3.5 w-3.5 text-zinc-500 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-indigo-400" aria-hidden="true" />
                    </button>
                  ))}
                </div>
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
            {storageError && (
              <div
                role="alert"
                className="rounded-lg border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-200"
              >
                {t("errors.persistStream", {
                  detail: storageError,
                  defaultValue: `Unable to save this response locally: ${storageError}`,
                })}
              </div>
            )}
          </div>
          </div>
          {!isAtBottom && isStreaming && (
            <div className="absolute bottom-4 right-5 z-20 flex items-center gap-2">
              <span className="rounded-full border border-zinc-700/80 bg-zinc-900/95 px-3 py-1.5 text-[11px] font-medium text-zinc-300 shadow-lg shadow-black/30 backdrop-blur">
                {t("chat.newMessages")}
              </span>
              <button
                type="button"
                aria-label={t("chat.scrollToLatest")}
                title={t("chat.scrollToLatest")}
                onClick={scrollToBottom}
                className="grid size-10 place-items-center rounded-full border border-zinc-700 bg-zinc-800/95 text-zinc-100 shadow-lg shadow-black/30 transition hover:border-violet-400/50 hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <ArrowDown className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-zinc-800/80 bg-zinc-950/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:px-6">
          <form
            onSubmit={handleSend}
            className="mx-auto flex w-full max-w-4xl items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-xl shadow-black/20 transition focus-within:border-zinc-700"
          >
            <label className="sr-only" htmlFor="chat-input">
              {t("chat.messageLabel")}
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
                !modelName
                  ? t("chat.selectModelPlaceholder")
                  : engineMode === "webgpu" && !isWebLLMReady
                    ? isWebLLMLoading
                      ? t("chat.webgpuLoadingPlaceholder")
                      : t("chat.webgpuReadyPlaceholder")
                    : t("chat.messagePlaceholder")
              }
              rows={1}
              disabled={
                isSending || (engineMode === "webgpu" && !isWebLLMReady)
              }
              className="max-h-36 min-h-10 flex-1 resize-y bg-transparent px-3 py-2.5 text-sm leading-5 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50"
            />
            <button
              type="submit"
              aria-label={t("common.send")}
              title={t("common.send")}
              disabled={
                !input.trim() ||
                !modelName ||
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
              : t("chat.localWebgpuRuntime")}
            {"  ·  "}
            {t("chat.sendHint")}
          </p>
        </footer>
      </section>
    </main>
  );
}

export default App;
