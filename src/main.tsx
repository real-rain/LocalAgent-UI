/*
 * @Description: 挂载 React 应用并加载全局样式与本地化配置。
 * @Author: realrain☔ 1936648485@qq.com
 * @Date: 2026-10-07 20:36:55
 * @LastEditors: realrain☔ 1936648485@qq.com
 * @LastEditTime: 2026-10-09 18:36:23
 * @FilePath: \LocalAgent-UI\LocalAgent-UI\src\main.tsx
 * @X/Discord/✈️: 1936648485@qq.com ~~~~~~~~~~~~~~~~~~~~~~~ Blog：reallyrain.com
 * Copyright (c) 2026 by realrain, All Rights Reserved. 
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
