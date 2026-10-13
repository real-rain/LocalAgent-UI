/*
 * @Description: 本地知识库管理抽屉组件
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-13 21:28:14
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-13 21:33:02
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\KnowledgeBaseDrawer.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  LoaderCircle,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  clearKnowledgeBase,
  db,
  deleteDocument,
  getDocuments,
  type DocumentChunk,
  type DocumentWithChunkCount,
} from "../../db/indexedDB";

interface KnowledgeBaseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onKnowledgeBaseChange: () => void;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 管理 IndexedDB 中的文档与向量切块。
 */
export function KnowledgeBaseDrawer({
  isOpen,
  onClose,
  onKnowledgeBaseChange,
}: KnowledgeBaseDrawerProps) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<DocumentWithChunkCount[]>([]);
  const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(
    null,
  );
  const [expandedChunks, setExpandedChunks] = useState<DocumentChunk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;
    void getDocuments()
      .then((result) => {
        if (isCurrent) {
          setDocuments(result);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (isCurrent) {
          setError(
            cause instanceof Error
              ? cause.message
              : t("rag.manager.loadFailed"),
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [isOpen, t]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  async function refreshDocuments() {
    const result = await getDocuments();
    setDocuments(result);
    onKnowledgeBaseChange();
  }

  async function handleToggleDocument(documentId: string) {
    setError(null);
    if (expandedDocumentId === documentId) {
      setExpandedDocumentId(null);
      setExpandedChunks([]);
      return;
    }
    try {
      const chunks = await db.chunks.where("docId").equals(documentId).toArray();
      setExpandedChunks(chunks);
      setExpandedDocumentId(documentId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("rag.manager.chunksFailed"),
      );
    }
  }

  async function handleDeleteDocument(document: DocumentWithChunkCount) {
    setError(null);
    try {
      await deleteDocument(document.id);
      if (expandedDocumentId === document.id) {
        setExpandedDocumentId(null);
        setExpandedChunks([]);
      }
      await refreshDocuments();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("rag.manager.deleteFailed"),
      );
    }
  }

  async function handleClearKnowledgeBase() {
    setIsClearing(true);
    setError(null);
    try {
      await clearKnowledgeBase();
      setExpandedDocumentId(null);
      setExpandedChunks([]);
      setPendingClear(false);
      await refreshDocuments();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("rag.manager.clearFailed"),
      );
    } finally {
      setIsClearing(false);
    }
  }

  if (!isOpen) return null;
  const chunkCount = documents.reduce(
    (total, document) => total + document.chunkCount,
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-base-title"
        className="flex h-full w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50"
      >
        <header className="shrink-0 border-b border-zinc-800 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="knowledge-base-title"
                className="flex items-center gap-2 text-lg font-semibold text-zinc-100"
              >
                <BookOpen className="size-5 text-violet-300" aria-hidden="true" />
                {t("rag.manager.title")}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {t("rag.manager.summary", {
                  documents: documents.length,
                  chunks: chunkCount,
                })}
              </p>
            </div>
            <button
              type="button"
              aria-label={t("common.close")}
              title={t("common.close")}
              onClick={onClose}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {documents.length > 0 && (
            <div className="mt-4">
              {pendingClear ? (
                <div
                  role="alertdialog"
                  aria-label={t("rag.manager.confirmClear")}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-900/70 bg-red-950/30 p-3"
                >
                  <p className="text-xs leading-5 text-red-200">
                    {t("rag.manager.confirmClearMessage")}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingClear(false)}
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      disabled={isClearing}
                      onClick={() => void handleClearKnowledgeBase()}
                      className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-400 disabled:opacity-50"
                    >
                      {isClearing
                        ? t("rag.manager.clearing")
                        : t("rag.manager.confirm")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingClear(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-900/60 px-3 py-2 text-xs font-medium text-red-300 transition hover:border-red-700 hover:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {t("rag.manager.clear")}
                </button>
              )}
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              {t("common.loading")}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-10 text-center">
              <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-violet-400/20 bg-violet-400/5 text-2xl">
                📚
              </div>
              <p className="max-w-sm text-sm leading-6 text-zinc-400">
                {t("rag.manager.empty")}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {documents.map((document) => {
                const isExpanded = expandedDocumentId === document.id;
                return (
                  <li
                    key={document.id}
                    className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60"
                  >
                    <div className="flex items-start gap-3 p-4">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => void handleToggleDocument(document.id)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400"
                      >
                        {isExpanded ? (
                          <ChevronDown
                            className="mt-0.5 size-4 shrink-0 text-violet-300"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRight
                            className="mt-0.5 size-4 shrink-0 text-zinc-500"
                            aria-hidden="true"
                          />
                        )}
                        <FileText
                          className="mt-0.5 size-4 shrink-0 text-zinc-400"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block break-all text-sm font-medium text-zinc-100">
                            {document.title}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-zinc-500">
                            {formatFileSize(document.size)} ·{" "}
                            {t("rag.manager.chunkCount", {
                              count: document.chunkCount,
                            })}
                            <br />
                            {new Date(document.uploadTime).toLocaleString()}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={t("rag.manager.deleteDocument", {
                          title: document.title,
                        })}
                        title={t("rag.manager.delete")}
                        onClick={() => void handleDeleteDocument(document)}
                        className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-950/50 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-zinc-800 bg-zinc-950/50 p-4">
                        {expandedChunks.length === 0 ? (
                          <p className="text-xs text-zinc-500">
                            {t("rag.manager.noChunks")}
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {expandedChunks.map((chunk, index) => (
                              <li
                                key={chunk.id}
                                className="rounded-lg border border-zinc-800/80 bg-zinc-900/70 p-3"
                              >
                                <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-wide text-violet-300/80">
                                  <span>
                                    {t("rag.manager.chunkNumber", {
                                      number: index + 1,
                                    })}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-zinc-500">
                                    <Check className="size-3" aria-hidden="true" />
                                    {t("rag.manager.vectorLength", {
                                      length: chunk.embedding.length,
                                    })}
                                  </span>
                                </div>
                                <p className="whitespace-pre-wrap break-words text-xs leading-5 text-zinc-300">
                                  {Array.from(chunk.text).slice(0, 100).join("")}
                                  {Array.from(chunk.text).length > 100 ? "…" : ""}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
