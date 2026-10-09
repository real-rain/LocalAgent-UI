<!--
 * @Description: README
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 20:36:55
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-08 17:07:27
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\README.md
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
-->
<h1><img src="./src/assets/logo.svg" width="32" height="32" alt="LocalAgent-UI Logo" /> LocalAgent-UI</h1>

> **Lightweight, Local-First AI Agent Workbench UI powered by WebGPU (WebLLM) and Ollama. Zero backend dependencies required.**

[中文](README.zh-CN.md) | [GitHub Repo](https://github.com/real-rain/LocalAgent-UI)

`LocalAgent-UI` is a modern, high-performance in-browser AI Agent studio. It brings a native-like DevTools experience for **visual Chain-of-Thought (CoT) reasoning**, **interactive Tool Calling visualization**, and **isolated client-side live code sandboxes** directly inside your browser.

<p align="center"><img src="./src/assets/logo.svg" alt="LocalAgent-UI Banner" width="192" /></p>

---

## 🎬 Live Demo

### WebGPU

<p align="center"><img src="./public/WebGPU_Demonstration.gif" alt="LocalAgent-UI WebGPU demonstration" /></p>

### Ollama

<p align="center"><img src="./public/Ollama_Demonstration.gif" alt="LocalAgent-UI Ollama demonstration" /></p>

---

## ✨ Key Highlights

* **🧠 Visual Chain of Thought (CoT)**: Automatically parses `<think>...</think>` streaming tags into collapsible, high-tech reasoning cards (`ThoughtAccordion`).
* **🔧 Interactive Tool Calling Tree**: Visualizes agent function executions with real-time status nodes (`pending` | `running` | `success` | `failed`) and interactive JSON inspectors.
* **⚡ Client-Side Live Code Sandbox**: Renders generated HTML, SVG, CSS, and JS in an isolated iframe (`CodeArtifactBox`) with 1-click fullscreen preview and auto-merging for fragmented LLM outputs.
* **🔌 Hybrid Provider Architecture**:
  * **In-Browser WebGPU**: Runs 100% local, zero-backend LLMs (via `@mlc-ai/web-llm` in WebWorker).
  * **Ollama REST API**: Connects to local Ollama endpoints with dynamic health checks and auto-discovery of pulled models.
* **🎭 Prompt Presets & Session Settings**: Includes Code Assistant, Translator, and Custom Agent prompts; create, edit, delete, and reuse custom presets across sessions. Engine, model, and prompt selection are stored per session in IndexedDB.
* **📝 Rich Markdown**: Syntax-highlighted code, KaTeX math, and Mermaid diagrams render locally in the browser.
* **🔒 100% Local-First Data Privacy**: Sessions, model settings, system prompts, and full chat histories stay strictly inside your browser's IndexedDB (via Dexie.js). Streaming replies are periodically saved so partial output can be recovered after a reload.
* **💨 Anti-Jank Stream Pipeline**: Engineered with Zustand state buffering and RAF-throttled smart auto-scrolling for high-frequency token streams without UI jitter.

---

## 🛠️ Tech Stack

* **Framework**: React 19 + Vite + TypeScript
* **Styling**: Tailwind CSS + Lucide Icons + Custom Modern Scrollbars
* **State & DB**: Zustand + Dexie.js (IndexedDB)
* **Inference Engines**: `@mlc-ai/web-llm` (WebGPU) & Ollama REST Endpoint
* **Markdown & Syntax**: React-Markdown, highlight.js, KaTeX, and Mermaid
* **Tests**: Vitest + fake-indexeddb (`npm test`)

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone [https://github.com/real-rain/LocalAgent-UI.git](https://github.com/real-rain/LocalAgent-UI.git)

# Install dependencies
npm install

# Start local dev server
npm run dev
```

### ⚙️ Local Ollama CORS Setup Guide

When accessing `LocalAgent-UI` from a hosted web domain (e.g., Vercel / GitHub Pages), your browser will block requests to local Ollama (`http://localhost:11434`) due to CORS policies unless `OLLAMA_ORIGINS` is configured.

#### 🪟 Windows (Recommended)
1. Press `Win + R`, type `sysdm.cpl`, and press Enter.
2. Go to **Advanced** tab -> Click **Environment Variables**.
3. Under **User variables**, click **New**:
   - **Variable name**: `OLLAMA_ORIGINS`
   - **Variable value**: `*`
4. Click **OK** to save.
5. Right-click the Ollama icon in the system tray and select **Quit Ollama**, then re-launch Ollama from the Start Menu.

*(Or run in PowerShell as Administrator once: `[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')`)*

---

#### 🍎 macOS / Linux
Run Ollama with the `OLLAMA_ORIGINS` environment variable in your terminal:
```bash
OLLAMA_ORIGINS="*" ollama serve
```

## 📬 Author & Community
### Created with ❤️ by ☔[@real-rain](https://github.com/real-rain)
### Contact / Email: 1936648485@qq.com