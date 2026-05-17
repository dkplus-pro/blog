---
title: 'Cursor AI 代码审查实战指南'
date: 2026-05-13
tags: ['AI', '前端', '工程化', '代码质量']
description: '使用 Cursor 进行项目架构审查的完整方法论，包括全局状态、全局变量、环境变量和页面变量等维度的审查技巧'
draft: false
---

可以把 Cursor 当成一个 **项目体检助手**，但不要直接让它“随便帮我看看有什么问题”。要给它明确的审查维度、输出格式和边界。

Cursor 会给代码库建立可搜索索引，方便它在项目范围内做语义搜索和跨文件理解；大仓库里索引质量会直接影响它发现问题的能力，所以先确认项目已经完成索引，再做全局审查。([Cursor][1])

---

# 1. 先准备好审查方式

建议你用 Cursor 的 Chat / Agent，分 5 轮问，不要一次性全问。

审查顺序：

```txt
1. 项目架构设计
2. 全局状态管理
3. 全局变量与全局挂载
4. 环境变量
5. 页面变量引用与命名混乱
```

每一轮只聚焦一个主题，这样结果更准。

---

# 2. 第一轮：让 Cursor 梳理架构

直接在 Cursor 里问：

```txt
请你基于当前代码库，分析这个 uni-app 小程序项目的整体架构。

重点看：
1. apps / packages / src 的目录职责是否清晰
2. 页面、组件、store、api、utils、types 是否分层合理
3. 是否存在业务代码和公共能力混杂的问题
4. 是否存在跨模块引用混乱的问题
5. 是否存在某些目录职责不明确的问题

请按以下格式输出：
- 现状概览
- 发现的问题
- 具体文件路径
- 风险等级：高 / 中 / 低
- 修改建议
- 是否建议立即修复
```

你要让它输出 **具体文件路径**，否则它容易说空话。

---

# 3. 第二轮：检查全局状态

适合查 Pinia / Vuex / 全局 reactive / app.globalData 乱用。

Prompt：

```txt
请你审查当前项目的全局状态管理设计。

重点检查：
1. Pinia store 是否按业务模块拆分
2. 是否存在一个 store 里塞太多业务状态
3. 是否存在页面直接互相依赖状态
4. 是否存在状态来源不唯一的问题
5. 是否存在同一个数据既存在 store，又存在页面 data/ref，又存在 storage 的情况
6. 是否存在 store 里写页面 UI 临时状态的问题
7. 是否存在异步请求、缓存、状态更新混在一起导致职责不清的问题

请输出：
- store 文件列表
- 每个 store 的职责
- 发现的设计问题
- 涉及文件路径
- 具体风险
- 推荐拆分方案
```

重点看它有没有发现这些问题：

```txt
用户信息到处存
token 来源不唯一
页面状态放进全局 store
store 既请求接口又处理复杂 UI
多个 store 互相 import
```

---

# 4. 第三轮：检查全局变量 / 全局挂载

uni-app 项目常见问题是：

```txt
getApp().globalData 到处用
uni.setStorageSync 到处写
全局 config 到处 import
全局变量命名混乱
```

Prompt：

```txt
请你审查当前项目中全局变量、全局挂载和全局缓存的使用情况。

重点搜索和分析：
1. getApp().globalData
2. uni.setStorageSync / uni.getStorageSync
3. window / globalThis / global
4. app.config.globalProperties
5. 全局 config、constants、enum 的引用
6. 是否存在页面直接读写全局变量
7. 是否存在全局变量命名不清晰、来源不统一的问题

请输出：
- 所有全局变量使用点
- 具体文件路径
- 当前用途
- 是否合理
- 风险等级
- 建议替代方案

替代方案优先考虑：
- Pinia store
- packages/config
- packages/constants
- request 上下文
- monitor 上下文
```

你要重点关注它输出的这类问题：

```txt
页面直接操作 globalData
登录态既存在 globalData 又存在 storage 又存在 store
环境配置写死在页面里
多个地方重复定义 appId / baseUrl / env
```

---

# 5. 第四轮：检查环境变量

Prompt：

```txt
请你审查当前项目的环境变量和环境配置设计。

重点检查：
1. .env 文件是否按环境区分清楚
2. dev / test / prod 配置是否隔离
3. baseURL、appid、RUM ID、CDN 域名是否有硬编码
4. 是否存在业务代码直接判断 process.env / import.meta.env 过多的问题
5. 是否存在环境变量命名不统一的问题
6. 是否存在敏感信息写入前端代码的问题
7. 是否存在多个 app 共用环境变量但没有 app 维度隔离的问题

请输出：
- 当前环境变量列表
- 使用位置
- 硬编码位置
- 风险点
- 推荐环境变量命名规范
- 推荐配置目录结构
```

你可以要求它给你整理成这种结构：

```txt
packages/config/
  src/
    env.ts
    app.ts
    cdn.ts
    monitor.ts
```

以后业务代码不要直接到处写：

```ts
import.meta.env.VITE_API_BASE_URL
```

而是统一从配置模块拿：

```ts
import { appConfig } from '@/config'
```

---

# 6. 第五轮：检查页面引用变量混乱

这是最适合 Cursor 做的，因为它能跨文件看页面。

Prompt：

```txt
请你审查当前项目中页面代码的变量定义和引用是否混乱。

重点检查：
1. 页面里是否存在过多 ref / reactive / computed
2. 变量命名是否语义化
3. 是否存在 data、item、list、temp、obj 这类含义不清的命名
4. 是否存在同一个概念多个变量名
5. 是否存在变量定义离使用位置太远
6. 是否存在未使用变量
7. 是否存在页面里混合了请求、状态、渲染、格式化、业务判断
8. 是否可以抽成 composable、utils、components 或 store

请输出：
- 问题页面路径
- 混乱变量列表
- 为什么混乱
- 推荐命名
- 推荐抽离方式
- 优先级排序
```

让它重点扫：

```txt
apps/*/src/pages
apps/*/src/subpackages
apps/*/src/components
```

---

# 7. 再让 Cursor 生成一份问题清单

前面几轮完成后，再让它汇总：

```txt
请基于刚才的分析，整理一份当前项目现存问题清单。

按下面表格输出：
1. 问题类型
2. 问题描述
3. 涉及文件
4. 风险等级
5. 影响范围
6. 修复建议
7. 修复成本
8. 是否建议本期处理

问题类型包括：
- 架构分层
- 全局状态
- 全局变量
- 环境变量
- 页面变量混乱
- 公共包设计
- 组件边界
- 请求封装
- 错误监控
```

这样你就能得到一份可评审的“项目体检报告”。

---

# 8. 最好让 Cursor 只先分析，不要直接改

你第一次用 Cursor 查项目问题时，建议加一句：

```txt
本轮只做分析，不要修改代码。
```

否则它可能直接开始重构，容易越改越乱。

推荐完整开头：

```txt
本轮只做代码审查和架构分析，不要修改任何代码。请给出具体文件路径、问题原因和修改建议。
```

---

# 9. 可以加一条 Cursor 规则

你可以在 `.cursor/rules/project-audit.mdc` 放一条项目审查规则：

```mdc
---
description: 项目审查规则：发现架构、状态、变量和环境配置问题
alwaysApply: false
---

# 项目审查规则

当我要求你审查项目现存问题时，请重点关注以下方向：

- 架构分层是否清晰，页面、组件、store、api、utils、types 是否职责明确。
- 是否存在业务代码和公共能力混杂的问题。
- 是否存在跨模块引用混乱、循环依赖、越级引用的问题。
- 全局状态是否来源唯一，避免同一数据同时存在 store、页面状态、storage、globalData。
- 避免页面直接读写 getApp().globalData、uni storage、globalThis 等全局变量。
- 环境变量必须统一管理，避免 baseURL、appid、CDN、RUM ID 等配置散落在业务代码中。
- 页面变量命名必须语义化，避免 data、item、temp、obj、list 等含义不清的命名。
- 页面中如果混合请求、状态、渲染、格式化、业务判断，应建议拆成 composable、utils、store 或组件。
- 输出时必须包含具体文件路径、问题原因、风险等级、影响范围和修复建议。
- 默认只做分析，不要直接修改代码，除非我明确要求你修改。
```

以后你直接说：

```txt
按项目审查规则，帮我检查全局状态和环境变量问题。
```

就可以。

---

# 10. 最推荐的实操流程

你可以这样用 Cursor：

```txt
第一步：让它分析目录架构
第二步：让它分析 store 和全局状态
第三步：让它搜索 globalData / storage / globalThis
第四步：让它分析 env 和硬编码配置
第五步：让它分析 pages 里的变量命名和职责混杂
第六步：让它输出问题清单
第七步：你人工确认优先级
第八步：再让它一个问题一个问题改
```

不要一次性让它：

```txt
帮我重构整个项目
```

更好的方式是：

```txt
先发现问题
再分级
再小步修复
每次只改一类问题
```

一句话：

```txt
Cursor 最适合做“定向体检”，不适合无边界地全项目重构。
```

你给它明确审查维度、输出格式和“不直接改代码”的约束，才能真正发现项目里的架构问题。

[1]: https://cursor.com/blog/secure-codebase-indexing "Securely indexing large codebases · Cursor"
