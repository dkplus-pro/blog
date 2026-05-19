---
title: '从零搭建 Agent MVP：React + Node.js 六阶段实战'
date: 2026-05-19
tags: ['Agent', 'AI', 'Node.js', 'React', 'TypeScript']
description: '分阶段实现最小可用 AI Agent：聊天界面、Express 后端、Prompt 组织与大模型调用闭环'
draft: false
---

可以分 **6 个阶段** 来做。你先不要一上来做复杂 Agent 框架，最简单版本可以理解成：

> **前端负责聊天界面，后端负责接收消息，Agent 层负责组织 Prompt、调用模型、返回结果。**

---

# 一、先理解什么是最简单的 Agent

最简单的 Agent 不是一堆复杂框架，而是这几个东西：

```text
用户输入
↓
后端接收
↓
Agent 判断用户要什么
↓
组织 Prompt
↓
调用大模型
↓
返回结果
↓
前端展示
```

第一版甚至可以没有工具调用、没有知识库、没有多 Agent。

最小闭环是：

```text
React 聊天页面
+
Node.js 接口
+
一个 AgentService
+
一个 LLMProvider
```

---

# 二、推荐技术选型

前端：

```text
React
Vite
TypeScript
Axios / fetch
```

Vite 官方推荐可以用 `npm create vite@latest` 初始化项目，它本身就是面向现代 Web 的前端构建工具。([vitejs][1])

后端：

```text
Node.js
Express
TypeScript
dotenv
cors
```

Node.js 适合写服务端、命令行工具和 Web 应用。([Node.js][2]) Express 是 Node.js 里比较轻量的 Web 框架，官方也提供了最简单的 Hello World 服务示例。([Express][3])

---

# 三、项目阶段拆分

## 阶段 1：项目初始化

目标：先让前端和后端都能跑起来。

目录建议：

```text
simple-agent/
├── frontend/
│   └── React 项目
│
├── backend/
│   └── Node.js 项目
│
└── README.md
```

初始化前端：

```bash
mkdir simple-agent
cd simple-agent

npm create vite@latest frontend
```

选择：

```text
React
TypeScript
```

然后：

```bash
cd frontend
npm install
npm run dev
```

初始化后端：

```bash
cd ../
mkdir backend
cd backend
npm init -y
npm install express cors dotenv
npm install -D typescript ts-node-dev @types/node @types/express @types/cors
```

创建 TypeScript 配置：

```bash
npx tsc --init
```

后端 `package.json` 加上：

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/app.ts"
  }
}
```

---

## 阶段 2：后端基础分层

目标：不要把所有代码写在一个 `app.ts` 里。

后端目录建议：

```text
backend/
├── src/
│   ├── app.ts
│   ├── routes/
│   │   └── agent.route.ts
│   ├── controllers/
│   │   └── agent.controller.ts
│   ├── services/
│   │   └── agent.service.ts
│   ├── providers/
│   │   └── llm.provider.ts
│   ├── types/
│   │   └── agent.ts
│   └── config/
│       └── env.ts
│
├── .env
└── package.json
```

每层职责：

| 层          | 作用         |
| ---------- | ---------- |
| routes     | 定义接口路径     |
| controller | 接收请求、返回响应  |
| service    | 写业务逻辑      |
| agent      | Agent 核心逻辑 |
| provider   | 调用模型接口     |
| config     | 环境变量配置     |
| types      | TS 类型定义    |

第一版可以先不单独建 `agents/`，直接放在 `agent.service.ts` 里。

---

## 阶段 3：先做一个假 Agent

目标：先不接模型，前后端打通。

后端接口：

```text
POST /api/agent/chat
```

请求：

```json
{
  "message": "帮我写一个活动方案"
}
```

响应：

```json
{
  "reply": "我收到你的问题了：帮我写一个活动方案"
}
```

### `src/app.ts`

```ts
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import agentRoute from './routes/agent.route'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/agent', agentRoute)

const port = process.env.PORT || 3001

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`)
})
```

### `src/routes/agent.route.ts`

```ts
import { Router } from 'express'
import { chatWithAgent } from '../controllers/agent.controller'

const router = Router()

router.post('/chat', chatWithAgent)

export default router
```

### `src/controllers/agent.controller.ts`

```ts
import { Request, Response } from 'express'
import { AgentService } from '../services/agent.service'

const agentService = new AgentService()

export async function chatWithAgent(req: Request, res: Response) {
  try {
    const { message } = req.body

    if (!message) {
      return res.status(400).json({
        message: 'message is required'
      })
    }

    const reply = await agentService.chat(message)

    return res.json({
      reply
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Agent error'
    })
  }
}
```

### `src/services/agent.service.ts`

```ts
export class AgentService {
  async chat(message: string) {
    return `我收到你的问题了：${message}`
  }
}
```

这个阶段的意义是：**先证明前后端通信没问题。**

---

## 阶段 4：前端做聊天页面

目标：能输入消息、发送到后端、展示回复。

前端目录建议：

```text
frontend/
├── src/
│   ├── App.tsx
│   ├── api/
│   │   └── agentApi.ts
│   ├── components/
│   │   ├── ChatBox.tsx
│   │   ├── ChatInput.tsx
│   │   └── MessageBubble.tsx
│   └── types/
│       └── chat.ts
```

### `src/types/chat.ts`

```ts
export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}
```

### `src/api/agentApi.ts`

```ts
export async function sendMessage(message: string) {
  const response = await fetch('http://localhost:3001/api/agent/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message })
  })

  if (!response.ok) {
    throw new Error('请求失败')
  }

  return response.json()
}
```

### `src/App.tsx`

```tsx
import { useState } from 'react'
import { sendMessage } from './api/agentApi'
import type { ChatMessage } from './types/chat'

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const result = await sendMessage(input)

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.reply
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '请求失败，请稍后再试'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'Arial' }}>
      <h1>Simple Agent</h1>

      <div style={{ border: '1px solid #ddd', padding: 16, minHeight: 400 }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              textAlign: msg.role === 'user' ? 'right' : 'left',
              marginBottom: 12
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '8px 12px',
                borderRadius: 8,
                background: msg.role === 'user' ? '#1677ff' : '#f1f1f1',
                color: msg.role === 'user' ? '#fff' : '#333'
              }}
            >
              {msg.content}
            </span>
          </div>
        ))}

        {loading && <div>Agent 正在思考...</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSend()
          }}
          placeholder="请输入你的问题"
          style={{ flex: 1, padding: 8 }}
        />

        <button onClick={handleSend} disabled={loading}>
          发送
        </button>
      </div>
    </div>
  )
}

export default App
```

到这里，你已经有一个最小聊天 Agent 页面了。

---

## 阶段 5：接入真正的大模型

目标：把假回复换成模型回复。

这里建议做一个单独的 `LLMProvider`，不要在 `AgentService` 里直接写请求模型的代码。

```text
AgentService
↓
LLMProvider
↓
大模型 API
```

### `src/providers/llm.provider.ts`

```ts
export class LLMProvider {
  async chat(prompt: string) {
    // 这里先写成伪代码
    // 实际可以换成 OpenAI、Claude、通义、DeepSeek、你自己的中转 API

    const response = await fetch(process.env.LLM_BASE_URL as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    const data = await response.json()

    return data.choices?.[0]?.message?.content || '模型没有返回内容'
  }
}
```

### `.env`

```bash
PORT=3001

LLM_BASE_URL=你的模型接口地址
LLM_API_KEY=你的 key
LLM_MODEL=你的模型名称
```

### 修改 `agent.service.ts`

```ts
import { LLMProvider } from '../providers/llm.provider'

export class AgentService {
  private llmProvider: LLMProvider

  constructor() {
    this.llmProvider = new LLMProvider()
  }

  async chat(message: string) {
    const prompt = `
你是一个简单的 AI Agent。
你需要用清晰、简洁的方式回答用户问题。

用户问题：
${message}
`

    return this.llmProvider.chat(prompt)
  }
}
```

这个时候，它就不只是“接口转发”了，而是有一点 Agent 的味道了：**后端开始控制角色、任务和输出规则。**

---

## 阶段 6：增加 Agent 能力

第一版 Agent 做完后，再逐步加能力。

建议顺序：

```text
1. 系统提示词
2. 会话上下文
3. 结构化返回
4. 工具调用
5. 流式输出
6. 任务状态
```

### 1. 系统提示词

比如你的 Agent 是“前端开发助手”：

```ts
const systemPrompt = `
你是一个前端开发 Agent。
你的职责是帮助用户分析需求、拆解任务、给出代码方案。
回答时要按：
1. 问题理解
2. 实现思路
3. 代码示例
4. 注意事项
输出。
`
```

### 2. 会话上下文

一开始可以存在内存里：

```ts
const sessionMessages = new Map<string, Array<{ role: string; content: string }>>()
```

后面再换数据库：

```text
SQLite
PostgreSQL
MongoDB
Redis
```

### 3. 结构化返回

不要永远只返回字符串。

可以返回：

```json
{
  "type": "text",
  "content": "这是回答内容"
}
```

以后扩展成：

```json
{
  "type": "tool_result",
  "toolName": "createTodo",
  "content": "我已经帮你创建任务"
}
```

### 4. 工具调用

最简单工具可以是：

```text
获取当前时间
生成 Todo
查询本地知识库
读取某个配置
```

例如：

```ts
export class ToolService {
  getCurrentTime() {
    return new Date().toLocaleString()
  }
}
```

Agent 判断用户问“现在几点”，就调用工具。

### 5. 流式输出

普通 HTTP 是：

```text
等模型全部生成完
↓
一次性返回
```

流式输出是：

```text
模型生成一点
↓
前端显示一点
```

后期可以用：

```text
SSE
WebSocket
```

你的第一版可以先不用流式，先用普通 HTTP。

---

# 四、最终推荐阶段表

| 阶段   | 目标       | 结果                            |
| ---- | -------- | ----------------------------- |
| 阶段 1 | 初始化项目    | React 和 Node 都能启动             |
| 阶段 2 | 后端分层     | routes、controller、service 分清楚 |
| 阶段 3 | 假 Agent  | 前后端接口打通                       |
| 阶段 4 | 聊天 UI    | 能输入、发送、展示回复                   |
| 阶段 5 | 接模型      | 真正生成 AI 回复                    |
| 阶段 6 | Agent 增强 | 上下文、工具、流式、结构化返回               |

---

# 五、最小版本的完整链路

你可以先做到这个程度：

```text
React 页面
  ↓
sendMessage()
  ↓
POST /api/agent/chat
  ↓
agent.route.ts
  ↓
agent.controller.ts
  ↓
agent.service.ts
  ↓
llm.provider.ts
  ↓
模型 API
  ↓
返回 reply
  ↓
React 展示
```

这就是一个最简单、分层清晰、后续可扩展的 Agent 项目。

---

# 六、我建议你第一版不要做这些

第一版先不要做：

```text
LangChain
LangGraph
复杂工作流
多 Agent
RAG 知识库
数据库记忆
WebSocket
权限系统
后台管理
```

先把这个最小闭环跑通：

```text
输入一句话
↓
后端 Agent 包装 Prompt
↓
模型返回
↓
前端展示
```

这个跑通之后，再加工具调用和上下文，Agent 才会越来越像真正的“智能体”。

[1]: https://vite.dev/guide/?utm_source=chatgpt.com "Getting Started"
[2]: https://nodejs.org/en?utm_source=chatgpt.com "Node.js"
[3]: https://expressjs.com/en/starter/hello-world.html?utm_source=chatgpt.com "Express \"Hello World\" example"
