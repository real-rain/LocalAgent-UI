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
* **🎭 角色预设与会话配置**：内置代码助手、翻译和自定义 Agent 提示词；支持创建、编辑、删除并跨会话复用自定义预设。模型、引擎及提示词选择均按会话保存在 IndexedDB。
* **📝 高清 Markdown**：代码语法高亮、KaTeX 数学公式和 Mermaid 流程图均在浏览器本地渲染。
* **🔒 100% 本地优先的数据隐私**：会话、模型配置、系统提示词和完整聊天记录均通过 Dexie.js 保存在浏览器的 IndexedDB 中；流式回复定期落盘，刷新后可恢复已生成内容。
* **💨 流畅的流式处理管线**：通过 Zustand 状态缓冲和 RAF 节流的智能自动滚动，处理高频 Token 流的同时避免界面卡顿。

---

## 🛠️ 技术栈

* **框架**：React 19 + Vite + TypeScript
* **样式**：Tailwind CSS + Lucide Icons + 自定义现代滚动条
* **状态管理与数据库**：Zustand + Dexie.js（IndexedDB）
* **推理引擎**：`@mlc-ai/web-llm`（WebGPU）和 Ollama REST 接口
* **Markdown 与语法高亮**：React-Markdown、highlight.js、KaTeX 和 Mermaid
* **测试**：Vitest + fake-indexeddb（运行 `npm test`）

---

## 🚀 快速开始

```bash
# 克隆仓库
git clone https://github.com/real-rain/LocalAgent-UI.git

# 安装依赖
npm install

# 启动本地开发服务器
npm run dev
```

### ⚙️ 本地 Ollama CORS 配置指南

从托管的网站域名（例如 Vercel / GitHub Pages）访问 `LocalAgent-UI` 时，如果未配置 `OLLAMA_ORIGINS`，浏览器会因 CORS（跨域资源共享）策略阻止向本地 Ollama（`http://localhost:11434`）发送请求。

#### 🪟 Windows（推荐）
1. 按 `Win + R`，输入 `sysdm.cpl`，然后按 Enter。
2. 切换到**高级**选项卡，点击**环境变量**。
3. 在**用户变量**下，点击**新建**：
   - **变量名**：`OLLAMA_ORIGINS`
   - **变量值**：`*`
4. 点击**确定**保存。
5. 右键点击系统托盘中的 Ollama 图标，选择**退出 Ollama**，然后从开始菜单重新启动 Ollama。

*（也可以在 PowerShell 中以管理员身份运行一次：`[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')`）*

---

#### 🍎 macOS / Linux
在终端中设置 `OLLAMA_ORIGINS` 环境变量并启动 Ollama：
```bash
OLLAMA_ORIGINS="*" ollama serve
```

## 📬 作者与社区
### 由 ☔[@real-rain](https://github.com/real-rain) 用 ❤️ 制作
### 联系方式 / 邮箱：1936648485@qq.com
