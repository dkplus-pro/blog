---
title: 'UnoCSS 入门：按需生成的原子化 CSS 引擎'
date: 2026-05-19
tags: ['前端', 'CSS', 'UnoCSS', 'Vue']
description: '理解 UnoCSS 是什么、与 Tailwind 的关系、原子化 CSS 优势及在 Vue/uni-app 中的用法'
draft: false
---

**UnoCSS 是一个“按需生成的原子化 CSS 引擎”。**

你可以把它理解成：

```txt
类似 Tailwind CSS 的写法
但是更轻、更快、更灵活
```

比如你在页面里写：

```vue
<view class="p-4 text-center bg-white rounded-xl">
  内容
</view>
```

UnoCSS 会根据你实际用到的 class，生成对应 CSS：

```css
.p-4 {
  padding: 1rem;
}

.text-center {
  text-align: center;
}

.bg-white {
  background-color: white;
}
```

它不会提前生成一大堆用不到的样式，而是你用什么，它生成什么。UnoCSS 官方把它定义为 “instant on-demand Atomic CSS engine”，也就是即时、按需的原子 CSS 引擎。([UnoCSS][1])

---

## 1. 什么是原子化 CSS？

传统写法是你先写 class 名：

```vue
<view class="user-card">
  用户卡片
</view>
```

然后再写 CSS：

```scss
.user-card {
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  text-align: center;
}
```

原子化 CSS 是直接在模板里组合小 class：

```vue
<view class="p-4 bg-white rounded-xl text-center">
  用户卡片
</view>
```

每个 class 只负责一个小功能：

```txt
p-4          padding
bg-white     白色背景
rounded-xl   大圆角
text-center  居中
```

好处是少写很多重复 CSS。

---

## 2. UnoCSS 的核心优点

### 优点一：按需生成，体积小

你写了什么 class，它才生成什么 CSS。

比如你项目里只用了：

```txt
p-4
text-center
bg-white
```

它就只生成这些样式，不会把完整 CSS 框架都打进包里。

这对小程序项目很重要，因为小程序主包体积比较敏感。

---

### 优点二：开发速度快

以前你写一个卡片：

```vue
<view class="card">
  <text class="title">标题</text>
</view>
```

还要写：

```scss
.card {
  padding: 24rpx;
  border-radius: 16rpx;
  background: #fff;
}

.title {
  font-size: 32rpx;
  font-weight: bold;
}
```

用了 UnoCSS 可以直接：

```vue
<view class="p-24rpx rounded-16rpx bg-white">
  <text class="text-32rpx font-bold">标题</text>
</view>
```

页面搭建速度会明显变快。

---

### 优点三：非常灵活

UnoCSS 不是一个固定 CSS 框架，而是一个引擎。它的核心是不带强默认规则的，很多能力通过 preset，也就是预设来提供。官方文档也说明，UnoCSS 的 core 是 un-opinionated，工具类主要由 presets 提供。([UnoCSS][2])

比如你可以配置：

```ts
// uno.config.ts
import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  presets: [
    presetUno()
  ],
  rules: [
    ['safe-bottom', { paddingBottom: 'env(safe-area-inset-bottom)' }]
  ]
})
```

然后页面里直接用：

```vue
<view class="safe-bottom">
  底部内容
</view>
```

这对 uniapp 小程序很实用，可以自定义很多项目级 class。

---

### 优点四：支持很多高级写法

UnoCSS 有 presets、transformers、extractors 等能力。presets 负责提供工具类能力，transformers 可以转换源码以支持特定写法，extractors 用来从源码里提取 utility class。([UnoCSS][3])

常见能力比如：

```txt
属性化写法
图标预设
快捷规则 shortcuts
自定义 rules
rem 转 px/rpx
class 分组
```

例如 shortcuts：

```ts
// uno.config.ts
export default defineConfig({
  shortcuts: {
    'card': 'p-4 bg-white rounded-xl shadow',
    'center': 'flex items-center justify-center'
  }
})
```

页面里：

```vue
<view class="card">
  内容
</view>
```

等价于：

```vue
<view class="p-4 bg-white rounded-xl shadow">
  内容
</view>
```

---

## 3. 和 Tailwind CSS 有什么区别？

简单理解：

| 对比    | Tailwind CSS | UnoCSS         |
| ----- | ------------ | -------------- |
| 定位    | CSS 框架       | 原子 CSS 引擎      |
| 默认规则  | 比较完整         | 更灵活，靠 preset   |
| 性能    | 已经不错         | 通常更快           |
| 自定义能力 | 强            | 更强             |
| 生态    | 最大、更成熟       | 小一些，但 Vue 圈很常用 |
| 学习成本  | 文档多，资料多      | 更灵活，但配置理解成本高一点 |

如果团队没有原子化 CSS 经验，Tailwind 更容易招人和查资料。

如果你是 Vue / Vite / uniapp 项目，想要更灵活、更轻，UnoCSS 很适合。

---

## 4. 在 uniapp 里有什么价值？

对 uniapp 项目来说，UnoCSS 最大的价值是：

```txt
快速写样式
减少重复 CSS
控制样式体积
统一设计规范
适合组件化开发
```

比如你可以统一设计间距、颜色、字号：

```vue
<view class="px-32rpx py-24rpx bg-#F7F8FA">
  <view class="text-32rpx font-600 text-#1F2937">
    标题
  </view>
  <view class="mt-12rpx text-26rpx text-#6B7280">
    描述内容
  </view>
</view>
```

这种对小程序页面开发非常高效。

---

## 5. 适合什么项目？

适合：

```txt
中大型 uniapp 小程序
页面多、样式重复多
需要统一设计规范
团队愿意接受原子化 CSS
需要快速搭页面
想减少 scss 文件体积
```

不太适合：

```txt
团队完全不熟原子化 CSS
项目很小，只有几个页面
设计稿样式高度定制且变化很少
团队更喜欢传统 BEM / SCSS 写法
```

---

## 6. 我的建议

如果你现在做的是 **uniapp + Vue3 + TS + Pinia**，我会建议：

```txt
可以引入 UnoCSS，但要定规范。
```

比如：

```txt
1. 页面布局、间距、字号、颜色，用 UnoCSS
2. 复杂组件样式，仍然可以写 scoped scss
3. 项目级样式抽 shortcuts
4. 不要在 class 里写得太长太乱
5. 统一使用 rpx 规则，适配小程序
```

一句话总结：

**UnoCSS 就是帮你少写 CSS、按需生成样式、快速搭页面的原子化 CSS 引擎；在 uniapp 小程序里，它的优势是开发快、体积可控、样式规范更容易统一。**

[1]: https://unocss.dev/?utm_source=chatgpt.com "UnoCSS: The instant on-demand Atomic CSS engine"
[2]: https://unocss.dev/guide/?utm_source=chatgpt.com "Guide"
[3]: https://unocss.dev/presets/?utm_source=chatgpt.com "Official Packages"
