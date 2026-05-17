---
title: 'store应该怎么用'
date: 2026-05-13
tags: ['前端', '后端', '架构', '性能优化']
description: '在前端项目里，store 本质是：'
draft: false
---

在前端项目里，`store` 本质是：

```txt
跨页面、跨组件共享的状态中心
```

它不是用来替代页面里的 `ref/reactive`，也不是所有状态都要放进去。

---

# 1. 公共区域的 store 是做什么的？

比如：

```txt
src/stores/
  user.ts
  app.ts
  chat.ts
  clarify.ts
```

这些 store 主要负责 **全局或跨页面共享状态**。

适合放：

```txt
用户信息
token
登录状态
系统信息
全局配置
当前会话
跨页面共享的数据
需要缓存/持久化的数据
多个页面都会用到的业务状态
```

例如：

```ts
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  const token = ref('')
  const userInfo = ref(null)

  const isLogin = computed(() => Boolean(token.value))

  function setToken(value: string) {
    token.value = value
  }

  function setUserInfo(value) {
    userInfo.value = value
  }

  function logout() {
    token.value = ''
    userInfo.value = null
  }

  return {
    token,
    userInfo,
    isLogin,
    setToken,
    setUserInfo,
    logout
  }
})
```

这种 store 的价值是：

```txt
登录页设置 token
首页能读取 token
个人中心能读取 userInfo
request 能拿 token
退出登录时所有页面状态统一变化
```

---

# 2. page 里的状态是做什么的？

页面里的 `ref/reactive` 适合放 **只属于当前页面的临时状态**。

比如：

```ts
const isPopupVisible = ref(false)
const submitLoading = ref(false)
const activeTab = ref(0)
const formData = reactive({
  name: '',
  phone: ''
})
```

这些状态一般只服务当前页面：

```txt
弹窗是否显示
当前 tab
按钮 loading
表单输入内容
当前页面的筛选条件
当前页面的临时选择项
```

页面销毁后，这些状态通常就不需要保留。

---

# 3. store 和 page 状态的区别

| 对比      | store            | page 内状态          |
| ------- | ---------------- | ----------------- |
| 生命周期    | 通常比页面更长          | 跟页面生命周期走          |
| 作用范围    | 多页面、多组件共享        | 当前页面内部            |
| 适合数据    | 登录态、用户信息、跨页面业务状态 | 表单、弹窗、loading、tab |
| 是否需要持久化 | 可能需要             | 一般不需要             |
| 修改风险    | 影响范围大            | 影响当前页面            |
| 维护要求    | 职责要清晰            | 可以更贴近页面交互         |

一句话：

```txt
store 管“公共状态”，page 管“当前页面状态”。
```

---

# 4. 判断一个状态要不要放 store

你可以用这 5 个问题判断：

```txt
1. 多个页面都要用吗？
2. 页面切换后还要保留吗？
3. 刷新/重启后还要恢复吗？
4. 其他模块需要监听它变化吗？
5. 它是不是业务全局状态？
```

如果多数答案是“是”，放 store。

如果只是：

```txt
这个页面的弹窗
这个页面的表单
这个按钮的 loading
这个组件的展开/收起
```

就放页面或组件里。

---

# 5. 组件是否应该有 store？

一般来说：

```txt
普通组件不应该直接拥有全局 store。
```

组件应该优先通过：

```txt
props 接收数据
emit 抛出事件
```

例如：

```vue
<ClarifyCard
  :question="currentQuestion"
  :selected-options="selectedOptions"
  @select="handleSelect"
  @confirm="handleConfirm"
/>
```

组件内部只关心展示和交互，不直接关心数据从哪里来。

---

# 6. 组件什么时候可以用 store？

组件可以使用 store，但要谨慎。

适合组件直接用 store 的情况：

```txt
1. 这个组件本身就是强业务容器组件
2. 它需要跨很多页面保持同一状态
3. 它是全局组件，比如登录弹窗、全局播放条、全局用户信息入口
4. 组件和某个业务 store 强绑定，并且不会被复用到其他业务
```

比如：

```txt
GlobalLoginModal
GlobalAudioPlayer
UserAvatarMenu
ChatContainer
```

这些组件可以直接使用 store。

但这类基础组件不建议直接用 store：

```txt
BaseButton
BaseInput
BasePopup
BaseCard
BaseEmpty
BaseLoading
ClarifyOptionItem
```

这些应该保持纯净，只通过 props/emit 工作。

---

# 7. 推荐组件分层

## 基础组件

```txt
BaseButton
BaseInput
BasePopup
BaseLoading
BaseEmpty
```

特点：

```txt
不依赖 store
不依赖业务接口
只接收 props
只 emit 事件
```

## 业务展示组件

```txt
ClarifyCard
MessageBubble
OrderCard
UserInfoCard
```

建议：

```txt
尽量不直接依赖 store
优先 props + emit
```

这样组件更容易复用和测试。

## 业务容器组件

```txt
ChatContainer
ClarifyFlowContainer
OrderListContainer
```

可以：

```txt
使用 store
调用 service
组合多个展示组件
处理业务流程
```

---

# 8. 推荐写法

页面负责连接 store 和组件：

```vue
<script setup lang="ts">
const clarifyStore = useClarifyStore()

function handleSelectOption(option) {
  clarifyStore.selectOption(option)
}

function handleConfirm() {
  clarifyStore.confirmCurrentQuestion()
}
</script>

<template>
  <ClarifyCard
    :question="clarifyStore.currentQuestion"
    :selected-options="clarifyStore.selectedOptions"
    @select="handleSelectOption"
    @confirm="handleConfirm"
  />
</template>
```

组件只负责展示：

```vue
<script setup lang="ts">
defineProps<{
  question: ClarifyQuestion
  selectedOptions: string[]
}>()

const emit = defineEmits<{
  select: [option: ClarifyOption]
  confirm: []
}>()
</script>
```

这样结构最清晰：

```txt
store：管理跨页面状态
page：连接 store 和业务流程
component：负责展示和交互
```

---

# 9. 不推荐的写法

不要让基础组件里直接拿 store：

```ts
const userStore = useUserStore()
const clarifyStore = useClarifyStore()
```

然后组件里自己改全局状态：

```ts
clarifyStore.selectedOptions = options
```

这样会导致：

```txt
组件复用性下降
组件变得难测试
状态来源不清晰
页面看不出来组件改了什么
后期排查问题困难
```

---

# 10. 你的团队可以定这个规则

```txt
1. store 只放跨页面、跨组件共享的业务状态。
2. page 里的 ref/reactive 放当前页面临时状态。
3. 组件默认不直接依赖 store。
4. 基础组件禁止使用 store。
5. 业务展示组件优先 props + emit。
6. 业务容器组件可以使用 store。
7. 页面负责连接 store、service 和组件。
8. 不要把弹窗、loading、表单输入值这类页面临时状态放进 store。
```

---

# 11. 一句话总结

```txt
store 是全局/跨页面状态中心；
page 状态是当前页面的临时状态；
组件默认不应该有 store，除非它是明确的业务容器组件或全局组件。
```

最推荐的分工是：

```txt
store 管状态
service 管接口
page 管流程
component 管展示
```

这样后期项目不会乱。
