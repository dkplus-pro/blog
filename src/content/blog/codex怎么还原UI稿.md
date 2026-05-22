---
title: 'Codex 还原 UI 稿：分步工作流与提示词模板'
date: 2026-05-02
tags: ['AI', 'Codex', '前端', 'Vue', 'uniapp', 'UI']
description: '用 Codex 从设计图或 Figma 还原页面的推荐流程：先分析拆分、再静态 UI、后状态与接口，附提示词与 AGENTS.md 规范'
draft: false
---

**有 UI 图时，不要让 Codex 一次性“看图 + 写完整页面 + 接接口 + 写状态管理”**。最稳的流程是：

**设计图理解 → 页面拆分 → 静态 UI → 状态与交互 → 接口/Store → 自测/Review**。

Codex 本身支持用截图/设计稿作为输入，CLI 里可以附 PNG/JPEG 等图片；如果是 Figma，也可以通过 Figma MCP 把布局、样式、组件信息提取给 Codex。OpenAI 官方也建议复杂任务先进入 Plan mode，让 Codex 先收集上下文、提问、出方案，再写代码；提示词最好包含目标、上下文、约束和完成标准。([OpenAI开发者][1])

---

## 1. 推荐工作流

### 第一步：先让 Codex 只读 UI，不写代码

先给 UI 图 / Figma 链接，让它输出：

```md
请先不要写代码，只分析这个 UI 页面：

1. 页面结构
2. 可拆分的组件
3. 每个组件的 props / emit
4. 页面状态
5. 交互流程
6. 需要哪些接口数据
7. 哪些地方需要复用现有组件
8. 实现顺序

项目技术栈：uniapp + Vue3 + TypeScript + Pinia。
请先输出实现计划，不要改代码。
```

这样能避免它直接乱写一整页。

---

### 第二步：把页面拆成组件

比如一个 AI 对话页面，不要直接让它实现 `pages/chat/index.vue` 全部逻辑。应该拆成：

```txt
pages/chat/index.vue              页面容器
components/chat/ChatMessageList.vue 消息列表
components/chat/ChatBubble.vue       单条消息
components/chat/InputBar.vue         底部输入框
components/chat/ToolPanel.vue        功能面板
components/chat/ClarifyCard.vue      需求澄清卡片
stores/chat.ts                       页面状态
services/chatService.ts              业务服务
api/chat.ts                          接口请求
types/chat.ts                        类型定义
```

**页面负责组装，组件负责展示，store 负责状态，service 负责业务流程，api 只负责请求。**

---

### 第三步：先实现静态 UI

提示词可以这样写：

```md
根据刚才的 UI 分析，只实现静态 UI。

要求：
1. 只修改以下文件：
   - pages/chat/index.vue
   - components/chat/ChatMessageList.vue
   - components/chat/ChatBubble.vue
   - components/chat/InputBar.vue

2. 暂时使用 mock 数据，不接接口。
3. 不引入新的状态管理。
4. 保持项目现有代码风格、ESLint、Prettier 规范。
5. 完成后请说明修改了哪些文件，以及每个文件的职责。
```

这一步只追求：**页面像设计图**。

---

### 第四步：再加交互状态

比如输入框、弹窗、展开收起、选择状态、loading、disabled、error。

提示词：

```md
在已有静态 UI 基础上，补充交互状态。

只处理前端本地交互，不接真实接口。

需要实现：
1. 输入框聚焦/失焦
2. 发送按钮 disabled / loading
3. 工具面板展开/收起
4. ClarifyCard 单选、多选、确认状态
5. 消息发送后的本地追加
6. 错误提示状态

不要重构页面结构，不要改无关文件。
```

---

### 第五步：最后接 Store / Service / API

提示词：

```md
现在接入真实业务逻辑。

要求：
1. api/chat.ts 只封装接口请求
2. services/chatService.ts 处理业务流程
3. stores/chat.ts 只维护页面共享状态
4. 页面和组件不要直接写复杂业务逻辑
5. 保留 mock 数据开关，方便自测
6. 接口字段不确定的地方先用 TODO 注释，不要猜字段

完成后运行类型检查和 lint。
```

Codex 官方也支持代码审查能力，可以让它看 diff、找严重问题；CLI 里 `/review` 可以审查未提交改动、commit 或相对 base branch 的差异。([OpenAI开发者][1])

---

## 2. 怎么保证 token 少、重做次数少

核心原则：**不要每次都把需求、规范、目录结构重新说一遍**。

你可以在项目根目录放一个 `AGENTS.md`，把长期规则写进去。OpenAI 官方也建议把仓库级规则、团队约定、评审要求放进 `AGENTS.md`，让 Codex 在仓库里自动读取。([OpenAI开发者][2])

建议写这些内容：

```md
# AGENTS.md

## 技术栈
- uniapp
- Vue 3
- TypeScript
- Pinia
- SCSS

## 分层规范
- api：只写 HTTP 请求
- services：写业务流程
- stores：写跨组件共享状态
- composables：写可复用逻辑
- components：只处理展示和局部交互
- pages：只做页面编排

## 代码要求
- 不要大范围重构
- 不要修改无关文件
- 优先复用已有组件
- 所有新增类型放到对应模块 types 文件
- 通过 ESLint 和 TypeScript 检查
- 不确定接口字段时加 TODO，不要编造

## 输出要求
- 先给计划
- 再改代码
- 最后说明修改文件、风险点、自测方式
```

然后每次任务只说当前目标：

```md
请实现聊天页底部输入框交互。
遵守 AGENTS.md。
只修改 InputBar.vue 和必要的类型文件。
不要改接口和 store。
```

这样 token 会少很多，Codex 也不容易跑偏。

---

## 3. 怎样控制上下文

推荐你用 **“任务文档 + 文件引用 + 阶段提交”** 控制上下文。

### 每个需求建一个任务文档

例如：

```txt
docs/tasks/chat-clarify-card.md
```

里面写：

```md
# 需求澄清卡片

## 目标
在 AI 对话流中展示需求澄清卡片，支持单选、多选、确认、上一题、下一题。

## UI 来源
Figma：xxx 页面 / 或截图 clarify-card.png

## 涉及文件
- components/chat/ClarifyCard.vue
- types/chat.ts
- stores/chat.ts

## 状态
- default
- selected
- disabled
- loading
- confirmed
- error

## 完成标准
- UI 与设计图基本一致
- 单选、多选可用
- 确认后不可重复提交
- 通过 lint 和类型检查
```

然后让 Codex 只读这个任务文档：

```md
请阅读 docs/tasks/chat-clarify-card.md。
先输出实现计划，不要写代码。
```

这样比你在聊天里反复解释更稳定。

---

## 4. UI 图的交互应该怎么描述

不要只说“照着图做”。要按 **状态 + 事件 + 数据变化 + 边界** 描述。

比如一个按钮，不要只说：

```txt
点击发送消息
```

要说：

```md
发送按钮状态：

1. input 为空：disabled
2. input 有内容：enabled
3. 点击发送后：loading，输入框禁用
4. 接口成功：清空输入框，消息追加到列表底部
5. 接口失败：恢复输入框，展示 toast，不清空内容
6. 连续点击：只允许触发一次
```

组件有不同状态时，最好给 Codex 这种表：

| 状态       | 触发条件 | UI 表现      | 可操作性   |
| -------- | ---- | ---------- | ------ |
| default  | 初始   | 普通样式       | 可点击    |
| selected | 用户已选 | 高亮边框/背景    | 可取消或切换 |
| disabled | 已提交  | 灰色         | 不可点击   |
| loading  | 请求中  | loading 图标 | 不可重复提交 |
| error    | 请求失败 | 错误提示       | 可重试    |

AI 最怕的是“隐藏状态”。你把状态表写出来，重做次数会明显减少。

---

## 5. 先画 UI 再写逻辑，还是 UI 和逻辑一起告诉 AI？

建议是：**同一个需求文档里同时说明 UI 和逻辑，但让 Codex 分阶段实现。**

也就是：

```txt
需求文档：UI + 状态 + 交互 + 接口都写清楚
实现顺序：先 UI，后交互，再接口
```

不要只给 UI，不给逻辑。因为它会按自己的理解猜交互。

也不要一开始就让它 UI + 逻辑 + 接口全写。因为一旦错了，重做成本很高。

最稳顺序：

```txt
1. 看图分析，不写代码
2. 静态 UI
3. 本地交互状态
4. mock 数据
5. 接真实接口
6. Review + 自测
```

---

## 6. 一整个页面一把梭，还是分组件实现？

**简单页面可以一把梭，复杂页面一定分组件。**

你的 uniapp 小程序页面，如果满足任意一个条件，就不要一把梭：

```txt
- 页面超过 200 行
- 有 3 个以上状态
- 有接口请求
- 有弹窗/卡片/列表/表单
- 组件未来可能复用
- 有 loading / empty / error / disabled 状态
- 涉及 Pinia store
```

像聊天页、AI 生成页、会员弹窗、需求澄清卡片，都应该分组件。

推荐实现粒度：

```txt
第一轮：页面骨架 + 组件目录
第二轮：核心展示组件
第三轮：交互组件
第四轮：store / service
第五轮：接口联调
第六轮：review / lint / 修 bug
```

---

## 7. 给 Codex 的标准提示词模板

你可以直接用这个：

```md
你是前端工程师，请基于当前项目实现这个需求。

## 背景
项目是 uniapp + Vue3 + TypeScript + Pinia 微信小程序。

## 目标
实现【这里写功能名称】。

## UI
参考我提供的 UI 图 / Figma 选区。
请先分析 UI 结构，不要直接写代码。

## 交互
- 状态 1：
- 状态 2：
- 点击行为：
- loading：
- error：
- empty：
- disabled：

## 分层要求
- 页面只做编排
- 组件只做展示和局部交互
- store 只维护共享状态
- service 处理业务流程
- api 只封装请求
- types 定义类型

## 限制
- 不要大范围重构
- 不要修改无关文件
- 优先复用已有组件
- 不确定的接口字段加 TODO，不要猜
- 保持 ESLint / Prettier 规范

## 执行方式
第一步：只输出实现计划和文件清单，不写代码。
等我确认后，再开始实现。
```

---

## 8. 我的推荐结论

你以后用 Codex 做 UI 页面，可以固定成这个节奏：

```txt
UI 图 / Figma
  ↓
Codex 只分析，不写代码
  ↓
确认组件拆分
  ↓
静态 UI
  ↓
状态和交互
  ↓
Pinia / service / api
  ↓
lint / typecheck / review
  ↓
人工验收
```

最重要的三条：

1. **不要一上来让它写完整页面。**
2. **组件状态一定要表格化描述。**
3. **长期规范放 AGENTS.md，单次需求放 docs/tasks/xxx.md。**


[1]: https://developers.openai.com/codex/cli/features "Features – Codex CLI | OpenAI Developers"
[2]: https://developers.openai.com/codex/learn/best-practices "Best practices – Codex | OpenAI Developers"
