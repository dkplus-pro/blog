---
title: 'React Native Fabric 架构到底是什么？'
date: 2026-07-04
tags: ['React Native', 'Fabric', '新架构', '移动端', '前端']
description: '理解 React Native 新架构中的 Fabric 渲染系统，梳理它与 JSI、TurboModules、Codegen 的关系，以及它解决的旧架构渲染与通信问题'
draft: false
---

# React Native Fabric 架构到底是什么？

在 React Native 里，**Fabric** 指的是新架构中的新一代 UI 渲染系统。它不是一个新的 UI 组件库，也不是一个新的框架，而是 React Native 底层渲染链路的一次重构。

一句话理解：

> **Fabric 是 React Native 新架构里的 UI Renderer，用来替代旧的渲染系统，并让 React Native 的 UI 渲染更接近现代 React 的模型。**

React Native 官方文档对 Fabric 的定义是：Fabric 是 React Native 的新渲染系统，是旧渲染系统的概念演进，核心原则包括把更多渲染逻辑统一到 C++、增强与宿主平台的互操作能力，并解锁 React Native 的新能力。

---

## 一、为什么需要 Fabric？

要理解 Fabric，先要理解 React Native 旧架构的问题。

早期 React Native 的整体链路可以粗略理解为：

```text
JavaScript 线程
  ↓
Bridge
  ↓
Native 线程
  ↓
原生 View
```

JS 侧的 React 代码负责描述 UI，Native 侧负责真正渲染 iOS 和 Android 的原生控件。二者之间通过 Bridge 通信。

旧架构的问题主要在于：

```text
1. JS 与 Native 通信依赖异步 Bridge
2. 通信数据通常需要序列化和反序列化
3. 大量 UI 更新、动画、手势等场景容易出现性能瓶颈
4. JS 侧难以同步访问某些 Native 能力
5. 渲染逻辑在 iOS、Android 和 JS 之间分散，统一性不够
```

React Native 新架构的一个重要变化，就是移除旧的异步 Bridge，并引入 JSI。JSI 允许 JavaScript 持有 C++ 对象引用，反过来也成立，从而减少传统 Bridge 模式下的序列化成本。

Fabric 正是在这个新架构背景下出现的：它负责重建 React Native 的 UI 渲染链路。

---

## 二、Fabric 在新架构中的位置

React Native 新架构大致可以拆成四个核心部分：

```text
React Native New Architecture
├── JSI
├── TurboModules
├── Fabric
└── Codegen
```

它们的职责分别是：

```text
JSI：JS 与 C++ / Native 之间的底层通信机制
TurboModules：新的 Native Module 系统
Fabric：新的 UI 渲染系统
Codegen：根据类型声明生成 JS 与 Native 之间的胶水代码
```

简单说：

> **Fabric 管 UI，TurboModules 管原生能力，JSI 管通信，Codegen 管类型和桥接代码生成。**

例如：

```text
<View />
<Text />
<Image />
自定义 Native UI 组件
```

这些更偏 Fabric 关注的范围。

而：

```text
Camera
Storage
Location
FileSystem
Bluetooth
```

这些更偏 TurboModules 的范围。

Codegen 则用于根据 TypeScript 或 Flow 声明生成平台相关代码，减少手写重复胶水代码的成本。官方文档也说明，Codegen 用于为自定义模块或组件生成 glue-code。

---

## 三、Fabric 的核心思想

Fabric 的核心不是“换一套组件写法”，而是重构 UI 渲染的底层机制。

它主要有几个关键思想。

### 1. 更多渲染逻辑统一到 C++

旧架构中，不同平台的渲染实现相对分散。Fabric 希望将更多通用的渲染逻辑放到 C++ 层。

这样做的好处是：

```text
1. iOS 和 Android 可以复用更多底层逻辑
2. 渲染行为更一致
3. 更容易接入新的 React 能力
4. Native 组件体系更标准化
```

这也是官方文档中提到的 Fabric 核心原则之一。

---

### 2. 不再强依赖旧 Bridge

旧 Bridge 的问题不只是“慢”，更关键的是它的通信模型限制了很多能力。

例如，JS 和 Native 之间如果每次都要通过异步消息通信，那么同步布局、复杂动画、高频数据交互都会比较麻烦。

新架构通过 JSI 让 JS 和 Native/C++ 能够更直接地交互。官方文档明确说明，新架构移除了 JavaScript 和 Native 之间的异步 Bridge，并用 JSI 取代。

Fabric 不是 JSI 本身，但它建立在新架构的基础之上，可以受益于更直接的底层通信方式。

---

### 3. 更贴近现代 React 渲染模型

React 本身已经进入并发渲染、优先级调度、可中断渲染等现代模型。

旧版 React Native 渲染系统和现代 React 的能力并不完全匹配。Fabric 的目标之一，就是让 React Native 更好地承接这些能力。

这意味着 React Native 可以更自然地支持：

```text
并发特性
同步布局能力
更细粒度的优先级调度
更好的事件响应
更一致的跨平台渲染行为
```

从业务开发视角看，你可能还是写普通的 JSX；但从底层看，UI 的计算、提交和挂载链路已经发生变化。

---

## 四、Fabric 的渲染流程

React Native 官方把渲染管线分为三个阶段：

```text
Render
Commit
Mount
```

这个渲染流程既会发生在首次渲染，也会发生在 UI 状态更新时。

---

### 1. Render 阶段

Render 阶段主要负责执行 React 组件逻辑，生成 React Element Tree。

例如我们写：

```tsx
function App() {
  return (
    <View>
      <Text>Hello Fabric</Text>
    </View>
  )
}
```

React 会根据组件返回结果生成一棵 React Element Tree。

然后 React Native Renderer 会根据这棵树创建对应的 Shadow Tree。

可以粗略理解为：

```text
React Component
  ↓
React Element Tree
  ↓
Shadow Tree
```

Shadow Tree 不是真正显示在屏幕上的原生 View，而是 React Native 用来描述 UI 结构、样式、布局信息的一棵中间树。

---

### 2. Commit 阶段

Commit 阶段负责提交新的 Shadow Tree，并进行布局计算。

React Native 的布局计算依赖 Yoga。Yoga 会根据样式、父容器约束、Flex 布局规则等信息，计算每个节点的位置和尺寸。

这个阶段可以理解为：

```text
Shadow Tree
  ↓
布局计算
  ↓
生成可挂载的 UI 变更
```

React Native 官方的渲染管线文档也将 Commit 作为 Render 和 Mount 之间的关键阶段。

---

### 3. Mount 阶段

Mount 阶段负责把已经计算完成的 Shadow Tree 变更应用到真正的原生视图上。

也就是：

```text
Shadow Tree
  ↓
Native View Tree
  ↓
屏幕上的 UI
```

最终用户看到的不是 Shadow Tree，而是 iOS / Android 上真实的原生 View。

所以 Fabric 的整个链路可以概括为：

```text
React 组件
  ↓
React Element Tree
  ↓
Fabric Renderer
  ↓
C++ Shadow Tree
  ↓
Yoga 布局计算
  ↓
Native View Tree
  ↓
屏幕渲染
```

---

## 五、Fabric 和旧架构的区别

可以从几个角度对比。

### 1. 通信方式不同

旧架构：

```text
JS
  ↓ 异步 Bridge
Native
```

新架构：

```text
JS
  ↓ JSI
C++ / Native
```

旧架构下，很多 JS 与 Native 之间的数据交互需要经过 Bridge。新架构下，JSI 允许两侧通过对象引用进行更直接的交互，从而减少传统序列化成本。

---

### 2. 渲染核心位置不同

旧架构中，渲染相关逻辑更多分散在不同平台侧。

Fabric 中，更多通用渲染逻辑进入 C++ 层。

这带来的变化是：

```text
跨平台一致性更好
底层复用度更高
更利于未来扩展
更利于和现代 React 能力对齐
```

---

### 3. 原生组件接入方式不同

旧架构中，自定义 Native UI 组件通常依赖 ViewManager、Bridge、手写映射代码等机制。

新架构中，Fabric Native Component 往往会结合 Codegen 使用。开发者通过类型声明描述组件属性、事件等信息，然后由 Codegen 生成部分平台胶水代码。官方文档也说明，Codegen 会根据规范生成 Android 和 iOS 的平台相关代码。

这让 Native 组件接入更类型化，也更容易维护。

---

### 4. 对并发能力支持不同

Fabric 更适合承接现代 React 的并发能力。

这对复杂交互场景很重要，例如：

```text
高优先级手势响应
低优先级 UI 更新
复杂列表渲染
动画与布局协同
多线程调度
```

React Native Renderer 的线程模型文档也提到，渲染管线的工作会分布在多个线程中，并且渲染器被设计为线程安全。

---

## 六、Fabric 对业务开发有什么影响？

对普通业务开发来说，Fabric 不一定会直接改变写法。

你仍然会写：

```tsx
<View>
  <Text>Hello</Text>
</View>
```

你仍然会使用：

```text
useState
useEffect
StyleSheet
FlatList
Pressable
```

但是底层执行方式变了。

Fabric 对业务开发的影响主要体现在这些方面：

```text
1. 部分复杂 UI 场景性能可能更好
2. 某些布局和事件行为会更接近现代 React 模型
3. 老库可能存在新架构兼容问题
4. 自定义 Native 组件需要适配 Fabric
5. 升级 React Native 版本时，需要关注第三方库是否支持新架构
```

也就是说，如果你只写普通页面，Fabric 可能不是每天都能感知到的概念。

但如果你维护的是：

```text
React Native 基建
组件库
动画库
手势库
Native Module
自定义 Native UI 组件
跨端容器
```

那么 Fabric 就是必须理解的底层架构。

---

## 七、Fabric 和 TurboModules 的关系

Fabric 和 TurboModules 经常一起出现，但它们不是同一个东西。

可以这样区分：

```text
Fabric：负责 UI 渲染
TurboModules：负责 Native 能力调用
JSI：提供底层通信基础
Codegen：生成类型安全的桥接代码
```

举个例子。

如果你开发一个原生地图组件：

```tsx
<MapView
  latitude={31.2}
  longitude={121.5}
  onRegionChange={handleChange}
/>
```

这个 `MapView` 作为 UI 组件，主要和 Fabric 有关。

但如果你还提供一个 JS API：

```ts
MapModule.getCurrentLocation()
```

这个原生能力模块就更偏 TurboModules。

如果你用 TypeScript 或 Flow 定义它们的接口，然后生成原生代码，则会涉及 Codegen。

---

## 八、Fabric 是否一定带来性能提升？

不一定。

这是一个很容易误解的点。

React Native 官方文档也提醒，启用新架构并不意味着应用性能或用户体验一定会立刻提升。代码可能需要重构才能真正利用同步布局、并发能力等新特性；同时，如果你的应用瓶颈本来就不在 JS 和 Native 通信上，那么收益也不会特别明显。

所以 Fabric 更准确的价值不是“打开就变快”，而是：

```text
1. 移除旧架构限制
2. 提供更现代的渲染基础
3. 为未来 React Native 能力演进铺路
4. 让 Native 组件和模块体系更标准化
5. 改善复杂场景下的调度和互操作能力
```

---

## 九、什么时候需要重点关注 Fabric？

以下几类场景需要重点关注 Fabric：

### 1. 升级 React Native 大版本

从旧架构升级到新架构时，需要确认：

```text
第三方库是否支持新架构
Native Module 是否需要迁移到 TurboModules
Native UI 组件是否支持 Fabric
Codegen 配置是否正确
iOS / Android 编译链路是否正常
```

React Native 0.76 起，新架构在新项目中默认开启。官方新架构文档也提到，从 0.76 开始，新架构在所有 React Native 项目中默认启用。

---

### 2. 开发 React Native 组件库

如果你的组件只是纯 JS 组件，影响相对较小。

但如果组件内部包含原生 UI，例如：

```text
地图
视频播放器
相机预览
自定义输入框
复杂图表
高性能列表
```

那就需要关注 Fabric Native Component 的写法和兼容性。

---

### 3. 开发高性能交互能力

例如：

```text
实时相机帧处理
复杂手势
高频动画
大型列表滚动
富文本编辑器
白板
音视频编辑
```

这类场景通常涉及 JS、C++、Native、UI Thread 之间的协作，Fabric 和 JSI 的价值会更明显。

---

## 十、如何用一句话总结 Fabric？

可以这样总结：

> **Fabric 是 React Native 新架构中的新 UI 渲染器，它用更现代的渲染管线、更直接的 JS-Native 通信基础，以及更多 C++ 层统一逻辑，替代旧架构下依赖 Bridge 的 UI 渲染方式。**

再简化一点：

```text
Fabric = React Native 新架构里的 UI 渲染系统
TurboModules = React Native 新架构里的 Native 模块系统
JSI = JS 与 Native/C++ 通信的基础
Codegen = 类型驱动的桥接代码生成工具
```

普通业务同学可以先记住：

```text
写法不一定变，但底层变了。
页面仍然用 React 写，渲染链路由 Fabric 接管。
```

基础架构同学需要进一步关注：

```text
Fabric Native Component
TurboModules
Codegen
JSI
线程模型
第三方库兼容
升级迁移成本
```

Fabric 的意义，不是让 React Native 变成另一套框架，而是让 React Native 的底层架构更接近现代 React、更贴近原生平台，也更适合未来复杂跨端应用的发展。
