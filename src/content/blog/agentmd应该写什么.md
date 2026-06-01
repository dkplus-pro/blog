---
title: '前端项目 AI Agent 规则包设计指南'
date: 2026-05-23
tags: ['AI', 'Agent', '前端', '工程化', 'Figma']
description: '设计通用 AGENTS.md 规则包：主入口、按需规则、Figma 还原、代码复用、错误上报与 grill-me 协作机制'
draft: false
---

下面是一版可以直接放进技术文档、团队 Wiki、README 或知识库的中文 Markdown 文章。

# 前端项目如何设计通用 AI Agent 规则包：从 Figma 还原到代码复用

## 一、背景

在前端开发中，AI 已经可以帮助我们完成页面还原、代码生成、组件拆分、逻辑重构等工作。但如果没有项目级规则约束，AI 很容易写出“能跑但不好维护”的代码。

例如在根据 Figma 还原页面时，经常会出现以下问题：

* 机械照抄 Figma 生成的代码；
* 大量使用固定宽高；
* 本来应该自动撑开的容器被写死高度；
* 普通按钮、卡片、列表用了绝对定位；
* Figma 的每一层都被照搬成一个 `view`；
* 没有优先复用项目已有组件、工具函数、hooks、biz、store；
* 没有遵守项目已有的 ESLint、Stylelint、Prettier 规则；
* 不知道什么错误需要上报，什么错误属于正常业务分支；
* 抽象时要么完全不抽，要么过度抽象，导致代码反而更难读。

所以项目需要一套轻量但有效的 AI 规则体系。

这套规则的目标不是让 AI 每次都读取一大段规范，而是：

> 主文件负责路由，细节规则按需读取。

这样既能减少无效上下文，又能让 AI 在关键任务上遵守项目约定。

---

## 二、设计目标

这套方案主要适配：

* Claude Code
* Codex
* Cursor
* Reasonix
* 其他支持项目规则文件的 AI 编码工具

核心目标：

1. **通用**：不为每个 AI 单独维护一套复杂规则。
2. **轻量**：主文件不要太长，避免占用过多上下文。
3. **按需**：Figma、复用、代码风格、错误上报分别放到 reference 文件。
4. **可执行**：不是写空泛原则，而是告诉 AI 什么时候读什么、怎么判断、怎么自检。
5. **可对齐**：重要架构决策使用 `grill-me` 机制，要求 AI 先和开发者确认。

---

## 三、推荐目录结构

建议在项目根目录增加以下文件：

```txt
AGENTS.md
CLAUDE.md
.cursor/
  rules/
    project-entry.mdc
docs/
  ai-rules/
    figma-to-code.md
    code-style.md
    reuse-boundary.md
    error-report.md
    grill-me.md
```

各文件职责如下：

| 文件                                | 作用                                         |
| --------------------------------- | ------------------------------------------ |
| `AGENTS.md`                       | 通用主入口，给 Codex、Cursor、其他 Agent 使用           |
| `CLAUDE.md`                       | Claude Code 入口，只引用 `AGENTS.md`             |
| `.cursor/rules/project-entry.mdc` | Cursor 兼容入口                                |
| `figma-to-code.md`                | Figma 还原、UnoCSS、rpx、布局规则                   |
| `code-style.md`                   | 函数拆分、类型、注释、格式化规则                           |
| `reuse-boundary.md`               | components、utils、hooks、biz、consts、store 边界 |
| `error-report.md`                 | 错误上报判断标准                                   |
| `grill-me.md`                     | 重要决策前和开发者对齐                                |

这套结构的关键是：

> `AGENTS.md` 不写所有细节，只告诉 AI：遇到什么任务，应该读取哪个 reference。

---

## 四、主入口：AGENTS.md

`AGENTS.md` 是整个规则体系的主入口。

它不应该写成几十页规范，而应该写成一个“任务路由文件”。

````md
# AGENTS.md

## 项目背景

这是一个前端项目，主要使用 Vue 3、TypeScript、uni-app、Pinia、UnoCSS、ESLint、Stylelint、Prettier 开发。

AI 在本项目中生成、修改、重构代码时，必须优先保证：

- 布局自适应；
- 代码可维护；
- 复用现有能力；
- 符合现有 lint / format 规则；
- 不机械照抄 Figma 生成代码。

## 最高优先级规则

- Figma 是视觉参考，不是代码结构参考。
- 优先使用 flex 和自适应布局，不要大量写死宽高。
- 普通布局不要优先使用 absolute。
- 样式优先使用 UnoCSS。
- 写代码前必须先搜索项目中是否已有可复用能力。
- 不要重复造轮子。
- 不要过度抽象，代码可读性优先。
- 除非存在跨页面共享状态，否则不要使用 store。
- 如果 hooks / composable 能解决，不要强行放进 store。
- uni-app callback 风格 API 如果进入 async 流程，优先封装成 Promise。
- 不要修改和当前任务无关的文件。
- 不要为了省事使用 `any`。
- 不要编造不存在的命令、路径、组件或工具函数。

## 按需读取 reference

根据当前任务类型，只读取相关规则文件，不要一次性读取所有规则。

### 涉及 Figma / UI / 布局 / UnoCSS

必须读取：

- `docs/ai-rules/figma-to-code.md`

适用场景：

- 根据 Figma 还原页面；
- 调整页面布局；
- 处理 UnoCSS class；
- 处理 rpx 换算；
- 判断是否需要固定宽高；
- 判断应该使用 flex 还是 absolute。

### 涉及代码风格 / 函数拆分 / 格式化

必须读取：

- `docs/ai-rules/code-style.md`

适用场景：

- 新增函数；
- 重构函数；
- 拆分复杂逻辑；
- 修改 TypeScript 类型；
- 处理 ESLint、Stylelint、Prettier 问题。

### 涉及复用 / 抽公共 / 目录边界

必须读取：

- `docs/ai-rules/reuse-boundary.md`

适用场景：

- 新增 components；
- 新增 utils；
- 新增 hooks / composables；
- 新增 biz；
- 新增 consts / constants；
- 修改 store；
- 判断逻辑应该放在哪里；
- 判断是否应该抽公共能力。

### 涉及错误上报

必须读取：

- `docs/ai-rules/error-report.md`

适用场景：

- try / catch；
- async 请求；
- 登录、支付、上传、分享、跳转等关键流程；
- 静默失败；
- 用户可感知失败；
- 项目 report / 错误监控。

### 涉及架构决策 / 不确定业务边界

必须读取：

- `docs/ai-rules/grill-me.md`

适用场景：

- 新增公共组件；
- 新增 biz 模块；
- 新增或修改 store；
- 增加错误上报；
- 在 hooks 和 store 之间做选择；
- 大幅调整 Figma 结构；
- 引入新的抽象模式。

## 编码前检查

开始写代码前，先检查：

- 是否已有相似页面？
- 是否已有相似组件？
- 是否已有 hooks / composables？
- 是否已有 utils？
- 是否已有 biz？
- 是否已有 consts / enums / types？
- 是否已有 store 状态或 action？

如果已有，优先复用或扩展，不要重新写一套。

## 编码后检查

修改代码后，优先查看 `package.json`，使用项目真实存在的命令。

常见命令可能包括：

```bash
pnpm lint
pnpm type-check
pnpm format
````

如果命令不存在，不能编造，需要说明未执行原因。

## 完成后回复要求

完成任务后需要说明：

* 修改了哪些文件；
* 复用了哪些已有能力；
* 是否新增 components / utils / hooks / biz / consts / store；
* 为什么这样抽象；
* 是否考虑了错误上报；
* 是否运行了 lint / type-check / format；
* 存在哪些假设或风险。

````

---

## 五、Claude Code 入口：CLAUDE.md

`CLAUDE.md` 不建议重复写大量规则。

它只需要做一件事：

> 告诉 Claude Code 去读 `AGENTS.md`。

```md
# CLAUDE.md

请先阅读并遵守根目录 `AGENTS.md`。

根据当前任务类型，只按需读取 `docs/ai-rules/` 下的 reference 文件。

不要一次性读取所有规则文件。
````

这样可以避免 `AGENTS.md` 和 `CLAUDE.md` 两边规则不一致。

---

## 六、Cursor 兼容入口

如果项目使用 Cursor，可以增加：

```txt
.cursor/rules/project-entry.mdc
```

内容保持简短：

```md
请遵守根目录 `AGENTS.md`。

根据任务类型，按需读取 `docs/ai-rules/` 下的 reference 文件：

- Figma / UI / 布局：读取 `figma-to-code.md`
- 代码风格 / 函数拆分：读取 `code-style.md`
- 复用 / 抽公共 / 目录边界：读取 `reuse-boundary.md`
- 错误上报：读取 `error-report.md`
- 架构对齐 / grill-me：读取 `grill-me.md`

不要一次性读取所有规则。
```

---

## 七、Figma 还原规则：figma-to-code.md

````md
# Figma to Code 规则

## 目标

将 Figma 设计稿转成可维护的 Vue / uni-app / UnoCSS 代码。

Figma 是视觉参考，不是代码结构参考。

AI 不能机械照抄 Figma 生成的图层、宽高和定位方式。

## 核心原则

- 不要直接复制 Figma 生成的 absolute 布局。
- 不要把 Figma 每一层都照搬成一个 `view`。
- 优先使用 flex 布局。
- 优先使用自适应宽高。
- 优先使用 UnoCSS class。
- 固定宽高必须有明确理由。
- 文本容器通常应该自然撑开。
- 按钮通常应该根据内容自适应，除非设计系统明确要求固定宽度。

## 单位换算

设计稿基于 375px。

换算规则：

- 设计稿 `1px` = 代码 `2rpx`
- 设计稿 `4px` = `8rpx` = UnoCSS `mt-1` / `mb-1` / `p-1`
- 设计稿 `8px` = `16rpx` = UnoCSS `mt-2` / `mb-2` / `p-2`
- 设计稿 `12px` = `24rpx` = UnoCSS `mt-3` / `mb-3` / `p-3`
- 设计稿 `16px` = `32rpx` = UnoCSS `mt-4` / `mb-4` / `p-4`

优先使用 UnoCSS 间距类，不要直接写大量 rpx。

## 布局优先级

布局实现优先级：

1. flex；
2. 自适应宽高；
3. padding / margin / gap；
4. 必要时使用固定尺寸；
5. 最后才考虑 absolute。

## 优先使用 flex 的场景

以下场景优先使用 flex：

- 按钮横向或纵向排列；
- 卡片中包含文本和操作按钮；
- 列表项包含图标、标题、操作区；
- 表单行包含 label 和 input；
- 内容会随着文案长度变化。

## 允许使用 absolute 的场景

以下场景可以使用 absolute：

- 角标；
- 浮层关闭按钮；
- 装饰图片；
- 图片叠加；
- 特殊视觉层级；
- 弹窗内部装饰元素。

以下场景不要使用 absolute：

- 普通按钮排列；
- 普通卡片布局；
- 普通文本排版；
- 列表布局；
- 表单布局。

## 固定尺寸规则

可以固定尺寸：

- icon；
- avatar；
- 图片容器；
- navbar；
- tabbar；
- banner；
- 固定比例的媒体区域；
- 设计系统明确要求固定高度的按钮。

不建议固定尺寸：

- 普通文本容器；
- 普通卡片高度；
- 普通列表 item 高度；
- 普通按钮宽度；
- 表单内容区域；
- 内容长度不确定的模块。

## Figma 图层清理

编码前先判断：

- 这一层是真实语义容器，还是视觉分组？
- 是否可以用 padding 或 gap 表达？
- 是否可以删除无意义 wrapper？
- 是否已有组件可以复用？
- 文案变长后布局是否仍然正常？
- 这个元素是否真的需要固定尺寸？

## 推荐写法

```vue
<view class="flex items-center justify-between rounded-3 bg-white px-4 py-3">
  <view class="min-w-0 flex flex-col gap-1">
    <text class="truncate text-4 font-600 text-#222">标题</text>
    <text class="text-3 text-#666">描述内容</text>
  </view>

  <button class="shrink-0 rounded-full px-3 py-1 text-3">
    操作
  </button>
</view>
````

## 不推荐写法

```vue
<view style="position: relative; width: 686rpx; height: 160rpx;">
  <text style="position: absolute; left: 32rpx; top: 24rpx;">标题</text>
  <button style="position: absolute; right: 32rpx; top: 52rpx; width: 120rpx;">
    操作
  </button>
</view>
```

## 自检清单

完成 UI 代码后检查：

* 是否有不必要的固定宽度？
* 是否有不必要的固定高度？
* 是否有不必要的 absolute？
* 是否有无意义多层嵌套？
* 文案变长后是否会破坏布局？
* UnoCSS 间距换算是否符合 375px 设计稿？
* 是否复用了已有组件？

````

---

## 八、复用边界规则：reuse-boundary.md

```md
# 复用与目录边界规则

## 目标

帮助 AI 判断：

- 什么代码应该复用；
- 什么代码应该抽公共；
- 什么代码应该放到 components、utils、hooks、biz、consts、store。

原则：

> 优先复用，其次扩展，最后新增。

## 新增代码前的搜索顺序

新增代码前，必须优先检查：

1. `src/components`
2. `src/hooks` / `src/composables`
3. `src/utils`
4. `src/biz`
5. `src/consts` / `src/constants`
6. `src/enums`
7. `src/types`
8. `src/stores`
9. `src/services`
10. `src/api`

如果已有类似能力，优先复用或扩展。

## components

`components` 用于放公共 UI 组件。

适合放入 components：

- 通用按钮；
- 通用弹窗；
- 通用卡片；
- 空状态；
- 列表项；
- 表单控件；
- 上传组件；
- 多页面复用的业务展示组件。

不适合放入 components：

- 单页面私有结构；
- 强绑定某一个页面接口的组件；
- 内部包含复杂业务流程的组件；
- 只使用一次且没有复用价值的 UI。

组件要求：

- props 明确；
- emits 明确；
- 默认自适应布局；
- 不写死不必要的宽高；
- 不直接修改页面私有状态；
- 不偷偷请求页面专属接口。

## utils

`utils` 只放纯工具函数。

适合放入 utils：

- 日期格式化；
- 金额格式化；
- 字符串处理；
- 数组转换；
- URL 参数处理；
- 数字计算；
- 无副作用的数据转换。

不适合放入 utils：

- toast；
- modal；
- 页面跳转；
- 接口请求；
- store 依赖；
- Vue 响应式状态；
- 生命周期逻辑。

判断标准：

> 如果一个函数相同输入一定得到相同输出，并且没有副作用，才适合放 utils。

## hooks / composables

`hooks` / `composables` 用于放 Vue 组合式逻辑。

适合放入 hooks：

- 分页加载；
- 下拉刷新；
- 弹窗状态；
- 表单状态；
- 倒计时；
- 上传流程；
- 选择器状态；
- 页面或组件可复用的响应式逻辑。

以下场景优先使用 hooks / composables，而不是 store：

- 状态不是全局状态；
- 状态不需要跨页面共享；
- 状态可以随页面或组件创建和销毁；
- 逻辑可复用，但没有全局共享诉求。

不适合放入 hooks：

- 纯工具函数；
- 全局状态；
- 大型跨页面业务流程；
- 只服务一个页面且很短的简单逻辑。

## biz

`biz` 用于放跨页面、跨模块复用的业务规则或业务流程。

适合放入 biz：

- 分享路径构建；
- 权限判断；
- 订单状态转换；
- 支付流程编排；
- 登录流程；
- 多接口组合业务；
- 多页面共用业务规则。

不应该创建 biz 的场景：

- 逻辑只使用一次；
- 只是一个纯格式化函数；
- 只是 UI 状态；
- 抽象命名不清晰；
- 抽出来后页面反而更难读。

判断标准：

> 如果它表达的是业务含义，并且多个页面可能复用，可以考虑放 biz。

## consts / constants

`consts` / `constants` 用于放稳定常量。

适合放入 consts：

- 页面路径；
- tab key；
- storage key；
- query 参数 key；
- 固定文案；
- 默认配置；
- 多处复用的魔法数字；
- 业务状态映射。

可以不抽常量：

- 数组索引；
- 简单长度判断；
- 分页递增；
- 非业务含义的 `0`、`1`、`-1`。

必须抽常量：

- 业务状态码；
- 权限码；
- 页面路径；
- storage key；
- 多处复用的业务文案；
- 多处复用的接口固定参数。

## store

store 只用于全局或跨页面共享状态。

适合放入 store：

- 用户信息；
- token；
- 登录态；
- 全局配置；
- 跨页面共享数据；
- 多页面共同读写的状态。

不适合放入 store：

- 单页面表单状态；
- 单页面弹窗状态；
- 页面专属接口流程；
- toast / modal；
- 页面跳转；
- 临时 UI 状态。

store 可以承载跨页面共享数据的加载、刷新和基础状态更新。

页面专属接口流程、表单校验、跳转、toast、弹窗等 UI 副作用，不应该放入 store。

## uni-app callback API

uni-app 中很多 API 是 callback 风格。

如果 callback API 进入 async 流程，优先封装成 Promise，再使用 async / await。

适合封装的 API：

- login；
- upload；
- getSetting；
- chooseImage；
- requestPayment；
- clipboard；
- storage；
- navigation 结果流。

封装位置判断：

| 场景 | 放置位置 |
|---|---|
| 通用平台能力包装 | `utils` 或 `utils/uni` |
| 可复用响应式流程 | `hooks` / `composables` |
| 业务专属流程 | `biz` |

示例：

```ts
export const chooseImageAsync = (
  options: UniApp.ChooseImageOptions = {},
) => {
  return new Promise<UniApp.ChooseImageSuccessCallbackResult>((resolve, reject) => {
    uni.chooseImage({
      ...options,
      success: resolve,
      fail: reject,
    })
  })
}
````

## 什么时候抽公共

可以考虑抽公共的情况：

* 相同逻辑第二次出现；
* 多个页面使用同一规则；
* 多个组件使用同一 UI 结构；
* 逻辑可以被清晰命名；
* 未来变化时需要统一修改；
* 主流程因为细节太多变得难读。

不要过度抽象的情况：

* 逻辑只出现一次且很短；
* 抽象命名很模糊；
* 抽出来隐藏了重要业务上下文；
* 抽出来后参数过多；
* 抽出来后比原来更难读。

## 判断表

| 情况                       | 优先选择                |
| ------------------------ | ------------------- |
| 可复用 UI                   | components          |
| 纯数据转换                    | utils               |
| Vue 响应式复用逻辑              | hooks / composables |
| 跨页面业务规则或流程               | biz                 |
| 稳定复用值                    | consts              |
| 全局共享状态                   | store               |
| 页面临时状态                   | 页面局部 state          |
| callback API 进入 async 流程 | Promise wrapper     |

````

---

## 九、代码风格规则：code-style.md

```md
# 代码风格规则

## 目标

遵守项目已有 ESLint、Stylelint、Prettier 规则。

不要手写和格式化工具冲突的代码风格。

## 函数规则

单个函数只做一件事。

出现以下情况时应该拆分：

- 函数包含多个业务阶段；
- 同时包含校验、请求、数据转换、toast、跳转；
- if / else 嵌套过深；
- 主流程阅读困难；
- 重复逻辑出现多次。

不应该拆分的情况：

- 抽出来的函数名很模糊；
- 只有一两行简单逻辑；
- 拆分后调用链更难理解；
- 拆分后需要传入过多参数。

## 推荐结构

```ts
const handleSubmit = async () => {
  if (!validateForm()) return

  const payload = buildSubmitPayload()
  const result = await submitForm(payload)

  handleSubmitResult(result)
}
````

## 不推荐结构

```ts
const handleSubmit = async () => {
  // 在一个函数里混合：
  // 表单校验
  // 参数组装
  // 接口请求
  // 错误上报
  // toast
  // 页面跳转
  // store 更新
  // 埋点
}
```

## TypeScript 规则

* 不要随意使用 `any`。
* props / emits 必须定义类型。
* API 返回值尽量定义类型。
* 新增类型前先搜索是否已有类型。
* 业务状态优先使用 enum、const map 或已有常量。
* 类型定义应该靠近所属业务域。

## 注释规则

* Vue 模板和函数内部逻辑优先使用 `//` 单行注释。
* TypeScript 类型字段说明可以使用 `/** */`。
* 注释应该解释业务意图，不要复述代码本身。

示例：

```ts
interface CourseItem {
  /** 课程是否已经解锁，影响是否允许直接进入学习页 */
  hasAccess: boolean
}
```

## 格式化规则

项目已经配置 ESLint、Stylelint、Prettier。

AI 生成代码时应主动符合这些规则。

修改后优先查看 `package.json`，使用项目真实存在的命令。

常见命令可能包括：

```bash
pnpm lint
pnpm type-check
pnpm format
```

如果命令不存在，不能编造。

````

---

## 十、错误上报规则：error-report.md

```md
# 错误上报规则

## 目标

项目已经有 report 错误上报能力。

AI 需要判断哪些错误值得上报，哪些属于正常业务分支，不要滥用 report。

## 必须考虑上报的场景

以下场景失败时，必须考虑 report：

- 登录失败；
- 支付失败；
- 订单关键流程失败；
- 上传失败；
- 分享关键流程失败；
- 关键页面跳转失败；
- 阻塞核心流程的接口请求失败；
- 数据解析失败，可能说明后端结构异常；
- 关键 uni-app callback API 执行失败；
- 用户无法继续操作的异常。

## 通常不需要上报的场景

以下场景通常不需要 report：

- 用户主动取消；
- 表单校验失败；
- 预期内的空数据；
- 权限不足但已有明确 UI 引导；
- 正常业务分支；
- 已知的可恢复状态；
- 本地乐观更新回滚，并且已有明确处理。

## 上报内容

上报信息应该方便排查问题。

可以包含：

- scene / module；
- action；
- error message；
- 关键业务 id；
- 去敏后的请求参数；
- 响应 code；
- 平台信息；
- 当前页面路径；
- 项目已有的 traceId / logId。

不能包含：

- token；
- 密码；
- 手机号完整值；
- 身份证；
- 用户隐私内容；
- 未脱敏的完整请求体。

## 上报规则

- 使用项目已有 report helper，不要新建一套上报系统。
- 不要在循环中频繁 report。
- report 后不要静默吞掉错误。
- 用户可感知失败时，仍然需要 toast、fallback 或重试入口。
- 用户取消类行为默认不 report。
- 不确定是否上报时，按 `grill-me.md` 规则向开发者确认。

## 示例

```ts
try {
  await requestPaymentAsync(paymentParams)
} catch (error) {
  if (isUserCancel(error)) {
    return
  }

  reportError({
    scene: 'payment',
    action: 'requestPayment',
    error,
    orderId,
  })

  uni.showToast({
    title: '支付失败，请稍后重试',
    icon: 'none',
  })
}
````

````

---

## 十一、Grill-me 对齐规则：grill-me.md

```md
# Grill-me 规则

## 目标

在重要设计决策前，AI 需要主动挑战假设，并和开发者对齐。

不要什么小事都问。

只在答案会影响架构、复用边界、数据流、错误上报、用户体验时提问。

## 需要先问开发者的场景

以下情况需要先对齐：

- 新增公共组件；
- 新增 biz 模块；
- 新增或修改 store；
- 给新流程增加错误上报；
- 在 hooks 和 store 之间做选择；
- 大幅调整 Figma 原有结构；
- 引入新的抽象模式；
- 改变已有目录边界；
- 修改公共工具函数行为；
- 影响多个页面的改动。

## 提问方式

最多问 3 个高价值问题。

不要一次性抛出十几个问题。

好问题示例：

- 这个状态是否需要跨页面共享，还是只在当前页面使用？
- 这个流程后续是否会被其他页面复用？
- 用户主动取消是否需要上报，还是视为正常行为？
- 这个组件是准备沉淀为设计系统组件，还是页面局部组件？
- 这个 uni-app callback API 应该封装成通用 Promise 工具，还是只服务当前业务流程？
- 当前逻辑更适合 hooks，还是确实需要 store？

## 开发者没有回答时的默认策略

如果开发者没有明确回答，使用最安全的默认策略：

- 页面私有状态优先放页面局部；
- hooks / composables 优先于 store；
- utils 只放纯函数；
- biz 只放跨页面业务规则；
- 用户主动取消默认不 report；
- 关键流程的非预期失败需要 report；
- 避免过度抽象；
- 优先保证主流程可读。
````

---

## 十二、为什么不把所有规则都写进 AGENTS.md

不建议把所有内容都塞进 `AGENTS.md`，原因有三个。

第一，太长的主文件会消耗上下文。

AI 每次执行任务都读取一大堆无关规则，会降低有效上下文比例。

第二，规则太多反而不容易执行。

比如一个简单的样式调整，不需要读取完整的错误上报、store、biz 规则。

第三，维护成本高。

主文件越长，越容易出现重复、冲突、过时。

所以更推荐：

```txt
AGENTS.md               # 任务路由
docs/ai-rules/*.md      # 细节规则
lint / test / CI        # 强制底线
```

一句话：

> AGENTS.md 管方向，reference 管细节，lint 管底线，grill-me 管对齐。

---

## 十三、AI 规则和工程工具的边界

AI 规则不是万能的。

真正能强制执行的，仍然应该交给工程工具。

| 能力         | 推荐工具          |
| ---------- | ------------- |
| 格式化        | Prettier      |
| JS / TS 规范 | ESLint        |
| 样式规范       | Stylelint     |
| 类型安全       | TypeScript    |
| 提交前检查      | lint-staged   |
| 最终质量门禁     | CI            |
| AI 行为倾向    | AGENTS.md     |
| 任务细节规则     | docs/ai-rules |
| 架构对齐       | grill-me      |

AI 规则负责让 AI “尽量按正确方向写”。

工程工具负责保证“不符合底线的代码不能进仓库”。

---

## 十四、落地步骤

建议分三步落地。

### 第一步：增加规则文件

先提交以下文件：

```txt
AGENTS.md
CLAUDE.md
.cursor/rules/project-entry.mdc
docs/ai-rules/figma-to-code.md
docs/ai-rules/code-style.md
docs/ai-rules/reuse-boundary.md
docs/ai-rules/error-report.md
docs/ai-rules/grill-me.md
```

### 第二步：让 AI 先按规则跑几次

不要一开始就追求完美。

先观察 AI 在以下任务中的表现：

* 根据 Figma 写页面；
* 修改已有组件；
* 抽 hooks；
* 判断是否要 store；
* 封装 uni-app Promise API；
* 给关键流程加错误上报。

看它是否：

* 仍然写死宽高；
* 是否还滥用 absolute；
* 是否会重复造轮子；
* 是否会滥用 store；
* 是否会过度抽象；
* 是否知道关键错误要 report。

### 第三步：把高频问题补进 reference

如果 AI 多次犯同一个错误，不要只在聊天里纠正。

应该把规则沉淀到对应 reference 中。

例如：

* Figma 还原问题，补到 `figma-to-code.md`；
* store 滥用问题，补到 `reuse-boundary.md`；
* 错误上报问题，补到 `error-report.md`；
* 函数太长问题，补到 `code-style.md`；
* 需要先问开发者的问题，补到 `grill-me.md`。

---

## 十五、总结

这套项目级 AI Skill 的核心不是“写一堆规范给 AI 看”，而是建立一套轻量的规则路由机制：

```txt
AGENTS.md
  ↓
按任务类型读取 reference
  ↓
根据规则生成代码
  ↓
通过 lint / type-check / format 检查
  ↓
重要决策用 grill-me 和开发者对齐
```

对于前端项目来说，最关键的几条规则是：

* Figma 是视觉参考，不是代码结构参考；
* 优先 flex、自适应布局，不要机械照抄固定宽高；
* UnoCSS 换算要统一，375px 设计稿下 `4px = 8rpx = mt-1`；
* 写代码前先找已有 components、utils、hooks、biz、consts、store；
* store 只放跨页面共享状态；
* hooks / composables 能解决的，不要强行上 store；
* callback 风格 API 进入 async 流程时，优先 Promise 化；
* 错误上报要有判断，不要滥报，也不要漏报关键流程；
* 抽象要克制，优先保证代码可读性；
* 架构不确定时，用 grill-me 和开发者对齐。

最终目标是：

> 让 AI 不只是“能写代码”，而是能按项目习惯写出可维护、可复用、可检查的代码。
