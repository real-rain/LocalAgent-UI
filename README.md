<!--
 * @Description: README
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 20:36:55
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-07 20:51:28
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\README.md
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
-->
# 🚀 LocalAgent-UI

> Lightweight, Local-First AI Agent Workbench UI powered by WebGPU (WebLLM) and Ollama. Zero backend dependencies required.

LocalAgent-UI is a modern, high-performance web studio designed for local AI models. It brings a native-like experience for visual Chain-of-Thought (CoT) reasoning, interactive Tool Calling nodes, and isolated client-side live code sandboxes directly inside your browser.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![TailwindCSS](https://img.shields.io/badge/Tailwind-v3%2Fv4-38bdf8.svg)

---

## ✨ Key Features

* **🧠 Visual Chain of Thought (CoT)**: Automatically parses `<think>...</think>` tags to display collapsible reasoning cards (`ThoughtAccordion`) with dynamic streaming indicators.
* **🔧 Interactive Tool Calling Visualization**: Displays agent function execution steps as dynamic node trees (`ToolCallCard`) with real-time status (`pending` | `running` | `success` | `failed`) and expandable JSON inspectors.
* **⚡ Live Code Preview Sandbox**: Renders generated HTML, SVG, and JavaScript code blocks in an isolated `iframe` sandbox (`CodeArtifactBox`) with a single click.
* **🔌 Hybrid Provider Architecture**: Seamlessly connect to local Ollama REST endpoints or run 100% in-browser WebGPU models via `@mlc-ai/web-llm` in a WebWorker.
* **🔒 100% Local-First Data Privacy**: Sessions, system prompts, and message history are stored completely in client-side IndexedDB (via Dexie.js). No server tracking or data leaks.
* **💨 Jank-Free Stream Pipeline**: Engineered with Zustand state buffering and smooth RAF-throttled rendering to handle high-frequency Token streaming without UI lag.

---

## 🏗️ Project Architecture & Tech Stack

### Core Technologies
* **Framework**: React 19 + Vite + TypeScript
* **Styling & UI**: Tailwind CSS + Lucide Icons + Framer Motion
* **State Management**: Zustand (Single-direction streaming buffer)
* **Local Storage**: Dexie.js (IndexedDB wrapper)
* **In-Browser Inference Engine**: `@mlc-ai/web-llm` (WebGPU)
* **Markdown & Code Rendering**: React-Markdown + Custom syntax highlighters

### Directory Structure
```text
local-agent-ui/
├── src/
│   ├── types/          # TypeScript interface definitions (Message, ToolCall, StreamChunk)
│   ├── core/
│   │   ├── parser/     # StreamParser for <think> tags & function call extraction
│   │   ├── providers/  # Provider adapters (OllamaProvider, WebLLMProvider)
│   │   └── workers/    # WebWorker for off-main-thread WebGPU execution
│   ├── store/          # Zustand state store (useChatStore)
│   ├── components/
│   │   ├── agent/      # ThoughtAccordion, ToolCallCard, CodeArtifactBox
│   │   └── chat/       # ChatMessageBubble, InputControls
│   └── db/             # IndexedDB / Dexie.js persistence layer
