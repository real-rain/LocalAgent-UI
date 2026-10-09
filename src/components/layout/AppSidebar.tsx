/*
 * @Description: 侧边栏组件
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-09 18:56:43
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:58:36
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\layout\AppSidebar.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */
import {
  Download,
  FileJson,
  Mail,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import githubIcon from "../../assets/GitHub.svg";
import logo from "../../assets/logo.svg";
import telegramIcon from "../../assets/telegram.svg";
import twitterIcon from "../../assets/tuite-copy.svg";
import type { Session } from "../../db/indexedDB";

type ExportFormat = "md" | "json";

interface AppSidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  isLoadingSessions: boolean;
  searchQuery: string;
  copyToast: string | null;
  onSearchChange: (query: string) => void;
  onNewChat: () => void;
  onSwitchSession: (sessionId: string) => void;
  onExportSession: (sessionId: string, format: ExportFormat) => void;
  onDeleteSession: (sessionId: string) => void;
  onCopyContact: () => void;
}

const CONTACT_EMAIL = "1936648485@qq.com";

export default function AppSidebar({
  sessions,
  currentSessionId,
  isLoadingSessions,
  searchQuery,
  copyToast,
  onSearchChange,
  onNewChat,
  onSwitchSession,
  onExportSession,
  onDeleteSession,
  onCopyContact,
}: AppSidebarProps) {
  const { t, i18n } = useTranslation();
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const filteredSessions = sessions.filter((session) =>
    session.title.toLocaleLowerCase().includes(normalizedSearch),
  );

  return (
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
          onClick={onNewChat}
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
          {filteredSessions.length}
        </span>
      </div>

      <label className="relative mx-3 mb-2 block">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("sidebar.searchSessions")}
          aria-label={t("sidebar.searchSessions")}
          className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900/70 pl-8 pr-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
        />
      </label>

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
        ) : filteredSessions.length === 0 ? (
          <p className="px-3 py-4 text-xs leading-5 text-zinc-500">
            {t("sidebar.noSearchResults")}
          </p>
        ) : (
          filteredSessions.map((session) => {
            const isCurrent = session.id === currentSessionId;
            return (
              <div
                key={session.id}
                className={`group relative flex items-center gap-1 rounded-lg border px-2 py-1.5 transition ${isCurrent
                  ? "border-zinc-800 bg-zinc-900"
                  : "border-transparent hover:bg-zinc-900/70"
                  }`}
              >
                <button
                  type="button"
                  onClick={() => onSwitchSession(session.id)}
                  aria-current={isCurrent ? "page" : undefined}
                  className="min-w-0 flex-1 px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <motion.span
                    key={session.title}
                    title={session.title}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`block truncate text-[13px] ${isCurrent
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
                <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-md border border-zinc-700 bg-zinc-900 p-0.5 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    aria-label={`${t("sidebar.exportMarkdown")} ${session.title || t("sidebar.newSession")}`}
                    title={t("sidebar.exportMarkdown")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onExportSession(session.id, "md");
                    }}
                    className="grid size-7 place-items-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${t("sidebar.exportJson")} ${session.title || t("sidebar.newSession")}`}
                    title={t("sidebar.exportJson")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onExportSession(session.id, "json");
                    }}
                    className="grid size-7 place-items-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  >
                    <FileJson className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${t("sidebar.delete")} ${session.title || t("sidebar.newSession")}`}
                    title={t("sidebar.delete")}
                    onClick={() => onDeleteSession(session.id)}
                    className="grid size-7 place-items-center rounded text-zinc-400 hover:bg-red-400/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
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
            onClick={onCopyContact}
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
  );
}
