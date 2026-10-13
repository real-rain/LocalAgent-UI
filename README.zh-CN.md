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
* **🛠️ 浏览器端工具调用闭环**：支持模型自主触发并执行前端函数（计算器、天气查询、Web 预览沙盒），并内置前端人机交互确认机制（`工具执行前确认`）。
* **🔧 内置前端工具**：`get_current_weather` 通过 Open-Meteo 获取实时天气；`calculator` 使用精确有理数运算处理十进制计算；未配置搜索服务时，`web_search` 会返回明确标注为模拟的结果。
* **🛡️ 工具执行控制**：开启 **工具执行前确认** 后，可在工具卡片上允许或拒绝调用。每次执行设有 10 秒超时（天气请求为 3 秒并在失败时返回 Mock 数据），错误会回传给模型；工具调用 ID 去重和最多 8 轮调用限制共同避免重复执行与无穷循环。
* **⚡ 客户端实时代码沙箱**：在隔离的 iframe（`CodeArtifactBox`）中渲染生成的 HTML、SVG、CSS 和 JS，支持一键全屏预览，并自动合并被拆分的 LLM 输出。
* **🔌 混合式模型提供方架构**：
  * **浏览器内 WebGPU**：通过 WebWorker 中的 `@mlc-ai/web-llm` 运行完全本地、无需后端的 LLM。
  * **Ollama REST API**：连接本地 Ollama 接口，支持动态健康检查和已下载模型的自动发现。
* **📚 Local-First RAG 本地知识库**：导入 PDF 或 TXT 后，在浏览器中提取文本并按重叠滑动窗口切块；通过 Web Worker 使用 `Xenova/bge-small-zh-v1.5` 生成向量。文档和向量保存在 IndexedDB，对话发送前会检索最相关的 3 个片段并注入系统提示词，Ollama 与 WebGPU 共用此流程。Embedding 模型首次使用时会下载并由 Transformers.js 缓存。
* **🎭 角色预设与会话配置**：内置代码助手、翻译和自定义 Agent 提示词；支持创建、编辑、删除并跨会话复用自定义预设。模型、引擎及提示词选择均按会话保存在 IndexedDB。
* **📦 会话备份与恢复**：一键导出包含所有会话、聊天记录及自定义提示词预设的 JSON 完整备份；导入时追加记录，不覆盖当前浏览器数据，并兼容导入单会话 JSON 文件。
* **📝 高清 Markdown**：代码语法高亮、KaTeX 数学公式和 Mermaid 流程图均在浏览器本地渲染。
* **🔒 本地优先的数据隐私**：会话、模型配置、系统提示词和聊天记录通过 Dexie.js 保存在浏览器的 IndexedDB 中。WebGPU 推理在浏览器内运行，Ollama 请求发送至本机 Ollama 服务。天气工具会将查询城市发送给 Open-Meteo 获取实时数据；`web_search` 为模拟搜索，不会请求搜索服务。流式回复定期落盘，刷新后可恢复已生成内容。
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

## 🔧 工具调用测试示例

选择模型并开始对话，然后发送以下任一提示词。开启**工具执行前确认**后，请在工具卡片上允许执行。

| Tool Name (工具名称) | Purpose (作用) | Example Prompt (测试提示词) |
| :--- | :--- | :--- |
| **Calculator (计算器)** | 高精度数学运算 | "请调用计算器工具帮我计算 `98765 * 43210` 的精确结果。" |
| **Weather API (天气查询)** | 拉取 Open-Meteo 北京实时数据（服务不可用时返回模拟数据） | "请查询北京当前的天气情况，并输出工具返回的数据。" |
| **Web Sandbox (代码沙盒)** | 前端代码生成与实时渲染 | "用 HTML/CSS/JS 编写一个 3D 翻转卡片，并在沙盒中预览。" |

## 🏗️ 工具调用架构 / 流程

```text
LLM Stream ➔ StreamParser (Detect Tool Call) ➔ User Confirmation (Optional) ➔ Browser JS Execution ➔ Feedback Tool Result to Context ➔ Final LLM Response
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
