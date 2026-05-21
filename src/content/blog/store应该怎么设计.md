---
title: 'Pinia Store 设计规范：uni-app 全局状态分层与拆分'
date: 2026-05-21
tags: ['前端', 'Vue', 'Pinia', '架构', 'TypeScript', 'uni-app']
description: '从放什么、目录结构、Setup/Option 写法到与 service/hooks/storage 分工，给出拆分规则、健壮性约定与可落地的代码模板'
draft: false
---

下面按 **uniapp + Vue3 + TypeScript + Pinia** 的项目规范讲。

Pinia 官方把 store 分成三类核心概念：`state` 类似组件里的 `data`，`getters` 类似 `computed`，`actions` 类似 `methods`；`actions` 适合放业务逻辑，并且可以是异步的。([Pinia][1])

---

# 1. Pinia store 到底放什么？

一句话：

```text
store 只放“跨页面共享的状态”和“修改这些状态的方法”
```

适合放 store 的：

```text
token
用户信息 userInfo
会员状态 vipInfo
全局配置 appConfig
当前租户 tenant
当前会话 currentConversationId
全局未读数 unreadCount
全局播放状态 playingAudio
全局弹窗状态 globalPopup
```

不适合放 store 的：

```text
某个页面自己的 loading
某个页面自己的表单 form
某个列表自己的 page/pageSize
某个组件自己的展开/收起
一次性临时变量
复杂接口参数组装
大量 UI 交互细节
```

判断标准：

```text
多个页面都要用，而且一个地方改了，其他地方要同步变化 → 放 store
只在当前页面用 → 放页面 ref/reactive
只是复用一段逻辑 → 放 hooks/composables
只是调接口 → 放 services
只是纯计算 → 放 utils/helpers
```

---

# 2. 推荐目录结构

```text
src/
  stores/
    modules/
      user.store.ts
      auth.store.ts
      app.store.ts
      vip.store.ts
      chat.store.ts
      player.store.ts
    index.ts

  services/
    user.service.ts
    auth.service.ts
    vip.service.ts
    chat.service.ts

  hooks/
    useLoginFlow.ts
    useTaskPolling.ts
    useCustomerServicePopup.ts

  constants/
    storageKeys.ts

  types/
    user.types.ts
    vip.types.ts
```

不要把所有状态都塞进一个 `main.store.ts`。
一个 store 对应一个业务域，比如：

```text
user.store.ts：用户资料
auth.store.ts：登录态/token
vip.store.ts：会员状态
chat.store.ts：对话全局状态
app.store.ts：全局配置、系统状态
```

Pinia 官方也建议可以定义多个 store，并且每个 store 放在不同文件里，这样更利于类型推导和构建拆分。([Pinia][1])

---

# 3. 用 Setup Store 还是 Option Store？

在 Vue3 / uniapp 项目里，我更推荐 **Setup Store**：

```ts
export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null)

  const isLogin = computed(() => !!userInfo.value)

  function setUserInfo(value: UserInfo | null) {
    userInfo.value = value
  }

  return {
    userInfo,
    isLogin,
    setUserInfo,
  }
})
```

原因：

```text
1. 和 Vue3 Composition API 风格一致
2. TS 类型推导更自然
3. 可以拆函数、组合其他 composable
4. computed / ref / action 边界更清晰
```

Pinia 的 Setup Store 规则是：`ref()` 会成为 state，`computed()` 会成为 getter，`function()` 会成为 action；并且必须 return 需要暴露的状态，否则 devtools、插件等能力会受影响。([Pinia][1])

---

# 4. Store 写法规范

## 推荐模板

```ts
// src/stores/modules/user.store.ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getUserInfoApi } from '@/services/user.service'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import type { UserInfo } from '@/types/user.types'

export const useUserStore = defineStore('user', () => {
  /**
   * state
   */
  const token = ref<string>(uni.getStorageSync(STORAGE_KEYS.TOKEN) || '')
  const userInfo = ref<UserInfo | null>(null)
  const loading = ref(false)

  /**
   * getters
   */
  const isLogin = computed(() => !!token.value)
  const userId = computed(() => userInfo.value?.id || '')
  const nickname = computed(() => userInfo.value?.nickname || '')

  /**
   * actions
   */
  function setToken(value: string) {
    token.value = value
    uni.setStorageSync(STORAGE_KEYS.TOKEN, value)
  }

  function clearToken() {
    token.value = ''
    uni.removeStorageSync(STORAGE_KEYS.TOKEN)
  }

  function setUserInfo(value: UserInfo | null) {
    userInfo.value = value
  }

  async function fetchUserInfo() {
    if (!token.value || loading.value) return

    loading.value = true

    try {
      const res = await getUserInfoApi()
      userInfo.value = res
    } finally {
      loading.value = false
    }
  }

  function reset() {
    clearToken()
    userInfo.value = null
    loading.value = false
  }

  return {
    token,
    userInfo,
    loading,

    isLogin,
    userId,
    nickname,

    setToken,
    clearToken,
    setUserInfo,
    fetchUserInfo,
    reset,
  }
})
```

结构固定为：

```text
1. state
2. getters
3. actions
4. return
```

不要一会儿 state，一会儿 action，一会儿 computed，代码会很快乱掉。

---

# 5. 页面里怎么读 store？

## 读法一：直接读 store，适合简单场景

```ts
const userStore = useUserStore()

console.log(userStore.userInfo)
console.log(userStore.isLogin)
```

模板里：

```vue
<view v-if="userStore.isLogin">
  {{ userStore.nickname }}
</view>
```

这是最简单、最安全的方式。

---

## 读法二：需要解构时，必须用 storeToRefs

错误写法：

```ts
const userStore = useUserStore()

const { userInfo, isLogin } = userStore
```

这样可能破坏响应式。

正确写法：

```ts
import { storeToRefs } from 'pinia'

const userStore = useUserStore()
const { userInfo, isLogin, nickname } = storeToRefs(userStore)
const { fetchUserInfo, reset } = userStore
```

Pinia 官方说明，store 本身是 reactive 包装对象，不能像普通对象那样直接解构；如果需要解构 state/getters，要用 `storeToRefs()`，actions 可以直接解构。([Pinia][1])

推荐规则：

```text
读少量字段：直接 userStore.xxx
字段很多、模板里频繁用：storeToRefs(userStore)
action：可以直接解构
```

---

# 6. 页面里怎么写 store？

## 推荐：通过 action 修改

```ts
const userStore = useUserStore()

userStore.setToken(token)
userStore.setUserInfo(userInfo)
await userStore.fetchUserInfo()
userStore.reset()
```

不推荐在页面里到处直接改：

```ts
userStore.userInfo = data
userStore.token = token
```

虽然 Pinia 支持直接赋值，但项目规范上建议：

```text
简单内部状态可以直接改
关键业务状态必须通过 action 改
```

例如 `token`、`userInfo`、`vipInfo`、`currentConversationId` 这类状态，最好都用 action，方便统一处理：

```text
1. storage 同步
2. 日志上报
3. 状态重置
4. 关联 store 清理
5. 后续排查谁改了状态
```

---

# 7. Store 和 storage 怎么配合？

store 是内存状态，`uni.setStorageSync` 是本地持久化。

推荐规则：

```text
token：store + storage
userInfo：优先 store，可按需 storage
会员状态：store，必要时缓存
页面临时状态：不要 storage
```

示例：

```ts
function setToken(value: string) {
  token.value = value
  uni.setStorageSync(STORAGE_KEYS.TOKEN, value)
}

function initTokenFromStorage() {
  token.value = uni.getStorageSync(STORAGE_KEYS.TOKEN) || ''
}

function logout() {
  token.value = ''
  userInfo.value = null
  uni.removeStorageSync(STORAGE_KEYS.TOKEN)
}
```

规范：

```text
storage 读写集中在 store action 或 storage service 里
页面不要到处 uni.getStorageSync('token')
key 必须常量化
```

例如：

```ts
export const STORAGE_KEYS = {
  TOKEN: 'TOKEN',
  USER_INFO: 'USER_INFO',
} as const
```

---

# 8. Store 和 service 怎么分工？

不要在 store 里写底层请求细节。

不推荐：

```ts
async function fetchUserInfo() {
  const res = await uni.request({
    url: '/user/info',
    method: 'GET',
  })

  userInfo.value = res.data
}
```

推荐：

```ts
// services/user.service.ts
export function getUserInfoApi() {
  return request<UserInfo>({
    url: '/user/info',
    method: 'GET',
  })
}
```

store 里：

```ts
async function fetchUserInfo() {
  const res = await getUserInfoApi()
  userInfo.value = res
}
```

分工：

```text
request.ts：封装 uni.request
service.ts：封装接口语义
store.ts：保存全局状态
hooks.ts：封装业务流程
page.vue：展示和交互
```

---

# 9. Store 和 hooks 怎么分工？

这是最容易乱的地方。

## store 放状态

```ts
const vipInfo = ref<VipInfo | null>(null)
const hasReceivedTrial = computed(() => !!vipInfo.value?.trialReceived)
```

## hook 放流程

```ts
export function useCustomerServicePopup() {
  const vipStore = useVipStore()
  const popupStore = usePopupStore()

  function checkAndShow() {
    if (vipStore.shouldShowTrialPopup) {
      popupStore.showCustomerServicePopup()
    }
  }

  return {
    checkAndShow,
  }
}
```

判断标准：

```text
这是不是全局状态？是 → store
这是不是一段可复用流程？是 → hook
这是不是接口请求？是 → service
这是不是纯函数？是 → utils/helper
```

---

# 10. Store 文件保持多大合适？

没有官方硬性行数，但工程上建议：

```text
理想：100 ~ 200 行
可接受：200 ~ 300 行
超过 300 行：需要评估拆分
超过 500 行：基本已经失控
单个 action 超过 50 ~ 80 行：应该拆
```

更重要的是职责数量：

```text
一个 store 最多负责一个业务域
一个 action 只做一个明确动作
一个 computed 只表达一个派生状态
```

如果一个 store 同时出现这些东西：

```text
登录
用户信息
会员
聊天
音频播放
弹窗
分享
支付
轮询
```

就一定要拆。

---

# 11. Store 拆分规则

## 按业务域拆

```text
auth.store.ts      登录态、token、登录/退出
user.store.ts      用户资料
vip.store.ts       会员、权益、过期状态
chat.store.ts      对话全局状态
player.store.ts    音频/视频播放全局状态
app.store.ts       app配置、系统信息、环境
popup.store.ts     全局弹窗状态
```

## 不要按页面拆

不推荐：

```text
home.store.ts
detail.store.ts
mine.store.ts
```

除非这个页面非常复杂，并且状态确实需要跨组件共享。

更推荐按业务：

```text
book.store.ts
chat.store.ts
vip.store.ts
```

---

# 12. Store 之间怎么互相调用？

可以互相调用，但要避免循环依赖。

Pinia 官方支持 store 组合使用，但如果两个 store 互相依赖，不能在 setup 顶层互相直接读取对方 state，否则会形成循环；应在 computed 或 action 中读取。([Pinia][2])

不推荐：

```ts
export const useAStore = defineStore('a', () => {
  const bStore = useBStore()
  const bName = bStore.name // 顶层直接读，容易循环

  return {
    bName,
  }
})
```

推荐：

```ts
export const useAStore = defineStore('a', () => {
  const bStore = useBStore()

  const bName = computed(() => bStore.name)

  function syncFromB() {
    console.log(bStore.name)
  }

  return {
    bName,
    syncFromB,
  }
})
```

规则：

```text
可以在 action 里调用其他 store
可以在 computed 里读取其他 store
不要两个 store 顶层互相读取 state
不要让 store A reset 时隐式重置一堆无关 store
```

如果需要跨多个 store 的复杂流程，优先放 hook：

```ts
export function useLogoutFlow() {
  const authStore = useAuthStore()
  const userStore = useUserStore()
  const chatStore = useChatStore()

  function logout() {
    authStore.reset()
    userStore.reset()
    chatStore.reset()
  }

  return {
    logout,
  }
}
```

---

# 13. 健壮性规范

## 13.1 所有异步 action 要有 loading / error / finally

```ts
const loading = ref(false)
const error = ref<string | null>(null)

async function fetchVipInfo() {
  if (loading.value) return

  loading.value = true
  error.value = null

  try {
    vipInfo.value = await getVipInfoApi()
  } catch (err) {
    error.value = normalizeErrorMessage(err)
    throw err
  } finally {
    loading.value = false
  }
}
```

不要写：

```ts
async function fetchVipInfo() {
  loading.value = true
  vipInfo.value = await getVipInfoApi()
  loading.value = false
}
```

一旦接口报错，`loading` 就永远是 true。

---

## 13.2 必须提供 reset

每个重要 store 都应该有：

```ts
function reset() {
  xxx.value = defaultValue
}
```

尤其是：

```text
auth.store.ts
user.store.ts
vip.store.ts
chat.store.ts
```

用户退出、切换账号、token 失效时需要清空状态。

---

## 13.3 状态初始值要明确

推荐：

```ts
const userInfo = ref<UserInfo | null>(null)
const loading = ref(false)
const list = ref<MessageItem[]>([])
```

不推荐：

```ts
const userInfo = ref()
const list = ref([])
```

这样类型容易变成 `any[]` 或 `undefined`，后面会失控。

---

## 13.4 不要在 store 里塞大对象

比如：

```text
完整视频文件
大图片 base64
巨大消息历史
复杂 DOM 实例
大量临时表单数据
```

store 是全局状态，不要变成缓存垃圾桶。大对象应该放：

```text
文件路径
任务 id
分页结果
局部页面状态
本地缓存
```

---

## 13.5 action 命名要统一

建议：

```text
setXxx        设置状态
clearXxx      清除某个状态
fetchXxx      从接口拉取
updateXxx     更新远端或本地状态
reset         重置整个 store
init          初始化
```

示例：

```ts
setToken()
clearToken()
fetchUserInfo()
updateUserProfile()
reset()
initFromStorage()
```

不要各种混用：

```text
getUser
loadUser
queryUser
requestUser
doUser
handleUser
```

---

# 14. 推荐代码模板

```ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { XxxInfo } from '@/types/xxx.types'
import { getXxxApi } from '@/services/xxx.service'

export const useXxxStore = defineStore('xxx', () => {
  /**
   * state
   */
  const xxxInfo = ref<XxxInfo | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * getters
   */
  const hasXxx = computed(() => !!xxxInfo.value)

  /**
   * actions
   */
  function setXxxInfo(value: XxxInfo | null) {
    xxxInfo.value = value
  }

  async function fetchXxxInfo() {
    if (loading.value) return

    loading.value = true
    error.value = null

    try {
      xxxInfo.value = await getXxxApi()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '请求失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  function reset() {
    xxxInfo.value = null
    loading.value = false
    error.value = null
  }

  return {
    xxxInfo,
    loading,
    error,

    hasXxx,

    setXxxInfo,
    fetchXxxInfo,
    reset,
  }
})
```

---

# 15. 页面使用模板

```vue
<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/modules/user.store'

const userStore = useUserStore()
const { userInfo, isLogin, loading } = storeToRefs(userStore)
const { fetchUserInfo } = userStore

onShow(() => {
  if (isLogin.value && !userInfo.value) {
    fetchUserInfo()
  }
})
</script>

<template>
  <view>
    <view v-if="loading">加载中...</view>
    <view v-else-if="isLogin">
      {{ userInfo?.nickname }}
    </view>
    <view v-else>
      未登录
    </view>
  </view>
</template>
```

---

# 16. 团队规范总结

可以直接定成团队约定：

```text
1. 一个 store 只负责一个业务域
2. store 文件建议控制在 100~300 行
3. 超过 300 行必须评估拆分
4. 单个 action 超过 80 行必须拆
5. 页面读取多个 state/getter 时用 storeToRefs
6. actions 可以直接从 store 解构
7. 关键状态必须通过 action 修改
8. 接口请求放 services，不直接写在 store 里
9. 复杂业务流程放 hooks，不塞进 store
10. store 必须有明确初始值和 reset 方法
11. storage key 必须常量化
12. token、用户、会员、全局配置才适合放 store
13. 页面级 loading/form/pageSize 不放 store
14. store 之间不要顶层互相读取 state，避免循环依赖
15. 所有异步 action 必须 try/finally，避免 loading 卡死
```

最重要的一句话：

```text
store 不是公共代码收纳箱，它只负责全局状态；流程放 hooks，接口放 services，纯计算放 utils。
```

[1]: https://pinia.vuejs.org/core-concepts/ "Defining a Store | Pinia"
[2]: https://pinia.vuejs.org/cookbook/composing-stores.html "Composing Stores | Pinia"
