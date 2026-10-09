/*
 * @Description: 组合本地聊天应用界面与模型运行流程。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 21:30:13
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:59:06
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\App.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Send,
  Sidebar,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import logo from "./assets/logo.svg";
import ChatMessageBubble from "./components/chat/ChatMessageBubble";
import { ModelSelectorPopover } from "./components/chat/ModelSelectorPopover";
import { PromptPresetSelector } from "./components/chat/PromptPresetSelector";
import { WebGPULoaderCard } from "./components/chat/WebGPULoaderCard";
import AppSidebar from "./components/layout/AppSidebar";
import CodeArtifactBox from "./components/agent/CodeArtifactBox";
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
  getMessagesBySession,
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

/**
 * 协调聊天状态、Provider 生命周期、会话导航与主界面。
 * @returns 完整的 LocalAgent 聊天应用界面。
 */
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
  const activeArtifact = useChatStore((state) => state.activeArtifact);
  const setActiveArtifact = useChatStore((state) => state.setActiveArtifact);

  const [engineMode, setEngineMode] = useState<Engine>("ollama");
  const [modelName, setModelName] = useState("");
  const [promptPresetId, setPromptPresetId] =
    useState<PromptPresetId>("code-assistant");
  const [userPromptPresets, setUserPromptPresets] = useState<PromptPreset[]>([]);
  const [input, setInput] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
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

    // 共享并发初始化请求，避免切换模型时重复创建引擎。
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

  async function handleDeleteSession(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);
    const title = session?.title || t("sidebar.newSession");
    if (!window.confirm(t("sidebar.confirmDelete", { title }))) return;

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

  async function handleExportSession(
    sessionId: string,
    format: "md" | "json",
  ) {
    try {
      const session = sessions.find((item) => item.id === sessionId);
      if (!session) throw new Error(t("errors.exportSession"));

      const sessionMessages = await getMessagesBySession(sessionId);
      const content =
        format === "json"
          ? JSON.stringify(
            {
              session,
              messages: sessionMessages,
            },
            null,
            2,
          )
          : [
            `# ${session.title || t("sidebar.newSession")}`,
            "",
            ...sessionMessages.flatMap((message) => {
              const sections = [
                `## ${message.role === "user" ? t("chat.you") : t("chat.assistant")}`,
                "",
                message.content,
              ];

              if (message.thoughtProcess) {
                sections.push(
                  "",
                  `### ${t("chat.thoughtProcess")}`,
                  "",
                  message.thoughtProcess,
                );
              }

              if (message.toolCalls?.length) {
                sections.push(
                  "",
                  `### ${t("chat.toolCalls")}`,
                  "",
                  "```json",
                  JSON.stringify(message.toolCalls, null, 2),
                  "```",
                );
              }

              return [...sections, ""];
            }),
          ].join("\n");

      const blob = new Blob([content], {
        type: format === "json" ? "application/json" : "text/markdown",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeTitle = Array.from(session.title || t("sidebar.newSession"))
        .map((character) => {
          const codePoint = character.codePointAt(0) ?? 0;
          return /[<>:"/\\|?*]/.test(character) ||
            codePoint < 32 ||
            codePoint === 127
            ? "_"
            : character;
        })
        .join("")
        .replace(/[. ]+$/g, "");
      anchor.href = url;
      anchor.download = `${safeTitle || "conversation"}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setRequestError(
        cause instanceof Error ? cause.message : t("errors.exportSession"),
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

      startGeneration(controller, streamMessageId, engineMode, modelName);
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
      // 按所选引擎选择 Provider，后续复用统一的流式消费与状态更新流程。
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
        <AppSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          isLoadingSessions={isLoadingSessions}
          searchQuery={sessionSearch}
          copyToast={copyToast}
          onSearchChange={setSessionSearch}
          onNewChat={() => void handleNewChat()}
          onSwitchSession={(sessionId) => void handleSwitchSession(sessionId)}
          onExportSession={(sessionId, format) =>
            void handleExportSession(sessionId, format)
          }
          onDeleteSession={(sessionId) => void handleDeleteSession(sessionId)}
          onCopyContact={() => void handleCopyContact()}
        />
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
            className={`shrink-0 justify-self-end px-2.5 py-1 text-xs rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${isStreaming
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
      {activeArtifact && (
        <aside
          aria-label={t("chat.artifactView")}
          className="fixed bottom-4 right-4 z-40 max-h-[calc(100dvh-2rem)] w-[min(42rem,calc(100vw-2rem))] overflow-auto rounded-lg shadow-2xl"
        >
          <CodeArtifactBox
            language={activeArtifact.language}
            code={activeArtifact.code}
            previewCode={activeArtifact.previewCode}
            title={t("chat.previewTitle", { title: activeArtifact.language })}
            initialView="preview"
            onClose={() => setActiveArtifact(null)}
          />
        </aside>
      )}
    </main>
  );
}

export default App;
