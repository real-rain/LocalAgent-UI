<!--
 * @Description: README（简体中文）
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-08
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\README.zh-CN.md
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved.
-->
<h1><img src="./src/assets/logo.svg" width="32" height="32" alt="LocalAgent-UI 标志" /> LocalAgent-UI</h1>

> **轻量、本地优先的 AI Agent 工作台 UI，由 WebGPU（WebLLM）和 Ollama 驱动。无需后端依赖。**

[English](README.md) | [GitHub 仓库](https://github.com/real-rain/LocalAgent-UI)

`LocalAgent-UI` 是一款现代化、高性能的浏览器内 AI Agent 工作台。它将类原生 DevTools 体验带入浏览器，支持**可视化思维链（CoT）推理**、**交互式工具调用过程展示**，以及**隔离的客户端实时代码沙箱**。

<p align="center"><img src="./src/assets/logo.svg" alt="LocalAgent-UI 横幅" width="192" /></p>

---

## 🎬 在线演示

### WebGPU

<p align="center"><img src="./public/WebGPU_Demonstration.gif" alt="LocalAgent-UI WebGPU 演示" /></p>

### Ollama

<p align="center"><img src="./public/Ollama_Demonstration.gif" alt="LocalAgent-UI Ollama 演示" /></p>

---

## ✨ 主要特性

* **🧠 可视化思维链（CoT）**：自动解析 `<think>...</think>` 流式标签，并将其展示为可折叠的高科技推理卡片（`ThoughtAccordion`）。
* **🔧 交互式工具调用树**：通过实时状态节点（`pending` | `running` | `success` | `failed`）展示 Agent 函数执行过程，并提供可交互的 JSON 查看器。
* **⚡ 客户端实时代码沙箱**：在隔离的 iframe（`CodeArtifactBox`）中渲染生成的 HTML、SVG、CSS 和 JS，支持一键全屏预览，并自动合并被拆分的 LLM 输出。
* **🔌 混合式模型提供方架构**：
  * **浏览器内 WebGPU**：通过 WebWorker 中的 `@mlc-ai/web-llm` 运行完全本地、无需后端的 LLM。
  * **Ollama REST API**：连接本地 Ollama 接口，支持动态健康检查和已下载模型的自动发现。
* **🔒 100% 本地优先的数据隐私**：会话、系统提示词和完整聊天记录均通过 Dexie.js 保存在浏览器的 IndexedDB 中。
* **💨 流畅的流式处理管线**：通过 Zustand 状态缓冲和 RAF 节流的智能自动滚动，处理高频 Token 流的同时避免界面卡顿。

---

## 🛠️ 技术栈

* **框架**：React 19 + Vite + TypeScript
* **样式**：Tailwind CSS + Lucide Icons + 自定义现代滚动条
* **状态管理与数据库**：Zustand + Dexie.js（IndexedDB）
* **推理引擎**：`@mlc-ai/web-llm`（WebGPU）和 Ollama REST 接口
* **Markdown 与语法高亮**：自定义 React-Markdown 解析器，在 AST 层自动合并代码块

---

## 🚀 快速开始

```bash
# 克隆仓库
git clone [https://github.com/real-rain/LocalAgent-UI.git](https://github.com/real-rain/LocalAgent-UI.git)

# 安装依赖
npm install

# 启动本地开发服务器
npm run dev
```

## 📬 作者与社区
### 由 ☔[@real-rain](https://github.com/real-rain) 用 ❤️ 制作
### 联系方式 / 邮箱：1936648485@qq.com
