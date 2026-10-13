/*
 * @Description: 提供聊天文本输入、PDF/TXT 上传和本地知识库处理状态展示。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-13 18:45:54
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-13 19:11:28
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\components\chat\ChatInput.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

import {
  useRef,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from "react";
import { BookOpen, Paperclip, Send } from "lucide-react";

/**
 * 聊天输入区域当前展示的本地知识库处理状态。
 *
 * @remarks parsing 表示解析文档，embedding 表示生成向量，
 * retrieving 表示检索知识库，ready 表示文档已完成索引。
 */
export type KnowledgeStatus =
  | "parsing"
  | "embedding"
  | "ready"
  | "retrieving";

/**
 * 聊天输入组件的状态、展示文案与交互回调。
 *
 * @property value 当前输入框文本。
 * @property inputRef 聊天文本框引用，供父组件控制焦点。
 * @property placeholder 输入框占位文案。
 * @property disabled 是否禁用文本输入和提交。
 * @property canSend 当前是否允许提交消息。
 * @property uploadDisabled 是否禁用文件上传入口。
 * @property knowledgeStatus 当前知识库处理状态；null 时不显示状态提示。
 * @property knowledgeStatusText 知识库状态对应的本地化文案。
 * @property uploadLabel 上传按钮和文件控件的无障碍名称。
 * @property uploadTitle 上传按钮的提示文案。
 * @property messageLabel 文本输入框的无障碍标签。
 * @property sendLabel 发送按钮的无障碍名称与提示文案。
 * @property onChange 输入文本变化时调用的回调。
 * @property onSubmit 表单提交时调用的回调。
 * @property onUploadFile 选择 PDF/TXT 文件后调用的回调。
 */
interface ChatInputProps {
  /** 当前输入框文本。 */
  value: string;
  /** 聊天文本框引用，供父组件控制焦点。 */
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /** 输入框占位文案。 */
  placeholder: string;
  /** 是否禁用文本输入和提交。 */
  disabled: boolean;
  /** 当前是否允许提交消息。 */
  canSend: boolean;
  /** 是否禁用文件上传入口。 */
  uploadDisabled: boolean;
  /** 当前知识库处理状态；null 时不显示状态提示。 */
  knowledgeStatus: KnowledgeStatus | null;
  /** 知识库状态对应的本地化文案。 */
  knowledgeStatusText: string;
  /** 上传按钮和文件控件的无障碍名称。 */
  uploadLabel: string;
  /** 上传按钮的提示文案。 */
  uploadTitle: string;
  /** 本地知识库文档数量，用于显示入口角标。 */
  documentCount: number;
  /** 知识库管理按钮的无障碍名称和提示文案。 */
  knowledgeBaseLabel: string;
  knowledgeBaseTitle: string;
  /** 文本输入框的无障碍标签。 */
  messageLabel: string;
  /** 发送按钮的无障碍名称与提示文案。 */
  sendLabel: string;
  /** 输入文本变化时调用的回调。 */
  onChange: (value: string) => void;
  /** 表单提交时调用的回调。 */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** 选择 PDF/TXT 文件后调用的回调。 */
  onUploadFile: (file: File) => void;
  /** 打开本地知识库管理面板。 */
  onOpenKnowledgeBase: () => void;
}

/**
 * 渲染消息输入框、文档上传入口及知识库处理状态。
 *
 * @param props 输入框状态、展示文案和父组件提供的事件处理函数。
 * @returns 包含消息表单及可选知识库状态提示的 React 元素。
 */
export function ChatInput({
  value,
  inputRef,
  placeholder,
  disabled,
  canSend,
  uploadDisabled,
  knowledgeStatus,
  knowledgeStatusText,
  uploadLabel,
  uploadTitle,
  documentCount,
  knowledgeBaseLabel,
  knowledgeBaseTitle,
  messageLabel,
  sendLabel,
  onChange,
  onSubmit,
  onUploadFile,
  onOpenKnowledgeBase,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 将所选文件交给父组件处理，并清空控件以支持重复选择同一文件。
   *
   * @param event 文件选择控件的变更事件。
   */
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) onUploadFile(file);
    event.currentTarget.value = "";
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-xl shadow-black/20 transition focus-within:border-zinc-700"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="hidden"
          aria-label={uploadLabel}
          disabled={uploadDisabled}
          onChange={handleFileChange}
        />
        <button
          type="button"
          aria-label={uploadLabel}
          title={uploadTitle}
          disabled={uploadDisabled}
          onClick={() => fileInputRef.current?.click()}
          className="grid size-10 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Paperclip className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={knowledgeBaseLabel}
          title={knowledgeBaseTitle}
          onClick={onOpenKnowledgeBase}
          className="relative grid size-10 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <BookOpen className="size-4" aria-hidden="true" />
          {documentCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border border-zinc-950 bg-violet-500 px-1 text-[9px] font-semibold leading-none text-white">
              {documentCount}
            </span>
          )}
        </button>
        <label className="sr-only" htmlFor="chat-input">
          {messageLabel}
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
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
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="max-h-36 min-h-10 flex-1 resize-y bg-transparent px-3 py-2.5 text-sm leading-5 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50"
        />
        <button
          type="submit"
          aria-label={sendLabel}
          title={sendLabel}
          disabled={!canSend}
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-500 text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </form>
      {knowledgeStatus && (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 flex items-center gap-2 px-2 text-xs text-violet-300"
        >
          {knowledgeStatus !== "ready" && (
            <span
              className="size-2 animate-pulse rounded-full bg-violet-400"
              aria-hidden="true"
            />
          )}
          {knowledgeStatusText}
        </p>
      )}
    </div>
  );
}
