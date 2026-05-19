---
title: 'Store 与 Composable 职责划分：全局状态 vs 页面逻辑复用'
date: 2026-05-19
tags: ['前端', 'Vue', 'Pinia', '架构', 'TypeScript']
description: '对比 Pinia store 与 Vue composable 的适用场景、协作方式与常见反模式'
draft: false
---

`composable` 和 `store` 都能放逻辑，但它们的核心区别是：

```txt
composable：复用“页面/组件逻辑”
store：保存“全局共享状态”
```

## 1. Store 是全局状态

Pinia store 适合放多个页面都要共享的数据。

比如：

```ts
// stores/modules/user.ts
export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    userInfo: null
  }),

  actions: {
    setToken(token: string) {
      this.token = token
    }
  }
})
```

适合放：

```txt
token
userInfo
登录状态
租户配置
全局主题
当前选中的 agent
购物车
全局权限
```

这些数据有一个特点：

```txt
它们有明确的“当前值”，并且很多页面都需要用。
```

比如：

```ts
const userStore = useUserStore()

console.log(userStore.token)
console.log(userStore.userInfo)
```

---

## 2. Composable 是复用逻辑

`composable` 一般是 `useXxx` 函数，用来复用一段页面逻辑。

比如分页列表：

```ts
// composables/usePageList.ts
import { ref } from 'vue'

export function usePageList<T>(fetcher: Function) {
  const list = ref<T[]>([])
  const loading = ref(false)
  const pageNum = ref(1)

  async function loadData() {
    loading.value = true

    try {
      const res = await fetcher({
        pageNum: pageNum.value,
        pageSize: 10
      })

      list.value.push(...res.list)
      pageNum.value++
    } finally {
      loading.value = false
    }
  }

  return {
    list,
    loading,
    pageNum,
    loadData
  }
}
```

页面里用：

```ts
const {
  list,
  loading,
  loadData
} = usePageList(getOrderListApi)
```

适合放：

```txt
分页逻辑
表单逻辑
上传逻辑
倒计时
弹窗开关
录音逻辑
输入框键盘处理
下拉刷新
页面滚动
权限判断逻辑
```

这些逻辑的特点是：

```txt
它不一定要全局共享，只是多个页面可能都会用到这套写法。
```

---

## 3. 最大区别：数据是不是全局共享

比如订单列表页面有这些状态：

```ts
const list = ref([])
const loading = ref(false)
const pageNum = ref(1)
const keyword = ref('')
```

这些通常不应该放 store。

因为它们只是当前页面自己的状态。

更适合放到：

```txt
useOrderList composable
```

但是用户信息：

```ts
token
userInfo
isLogin
```

这些就应该放 store。

因为首页、我的页、订单页、设置页都可能要用。

---

## 4. 对比表

| 对比            | composable                | store                        |
| ------------- | ------------------------- | ---------------------------- |
| 核心作用          | 复用逻辑                      | 共享状态                         |
| 是否全局          | 不一定                       | 是                            |
| 是否持久化         | 一般不持久化                    | 可以持久化                        |
| 生命周期          | 跟调用它的页面/组件走               | 整个应用级别                       |
| 典型命名          | `usePageList`、`useUpload` | `useUserStore`、`useAppStore` |
| 适合内容          | 分页、表单、上传、倒计时              | token、用户信息、配置、权限             |
| 是否多个页面共享同一份数据 | 通常不是                      | 是                            |

---

## 5. 一个实际例子：登录

### store 保存登录状态

```ts
// stores/modules/user.ts
export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    userInfo: null
  }),

  getters: {
    isLogin: (state) => Boolean(state.token)
  },

  actions: {
    setToken(token: string) {
      this.token = token
    },

    setUserInfo(userInfo: any) {
      this.userInfo = userInfo
    },

    logout() {
      this.token = ''
      this.userInfo = null
    }
  },

  persist: true
})
```

这里的 `token` 和 `userInfo` 是全局数据，适合放 store。

---

### composable 管登录页逻辑

```ts
// composables/useLogin.ts
import { ref } from 'vue'
import { loginService } from '@/services/auth'

export function useLogin() {
  const phone = ref('')
  const code = ref('')
  const loading = ref(false)

  async function submit() {
    if (loading.value) return

    loading.value = true

    try {
      await loginService({
        phone: phone.value,
        code: code.value
      })

      uni.switchTab({
        url: '/pages/index/index'
      })
    } finally {
      loading.value = false
    }
  }

  return {
    phone,
    code,
    loading,
    submit
  }
}
```

这里的 `phone`、`code`、`loading` 只是登录页自己的状态，不需要全局共享，所以适合放 composable。

---

## 6. 一个实际例子：列表页

### 不建议放 store

```ts
const list = ref([])
const pageNum = ref(1)
const loading = ref(false)
const keyword = ref('')
```

这些只是当前页面的列表状态。

如果放到 store，可能会出现：

```txt
A 页面进来加载了一批数据
退出页面后数据还留在 store
再次进入页面看到旧数据
多个列表页面互相污染
还要手动清理状态
```

所以不建议所有页面数据都放 store。

---

### 更适合放 composable

```ts
export function useOrderList() {
  const list = ref([])
  const pageNum = ref(1)
  const loading = ref(false)
  const keyword = ref('')

  async function loadData(reset = false) {
    // 分页请求逻辑
  }

  function search() {
    loadData(true)
  }

  return {
    list,
    pageNum,
    loading,
    keyword,
    loadData,
    search
  }
}
```

页面使用：

```ts
const {
  list,
  keyword,
  loading,
  loadData,
  search
} = useOrderList()
```

这样页面清爽，而且不同页面调用 `useOrderList()`，默认是各自独立的一份状态。

---

## 7. 什么时候 composable 里可以用 store？

可以，而且很常见。

比如权限判断：

```ts
// composables/useAuth.ts
import { useUserStore } from '@/stores/modules/user'

export function useAuth() {
  const userStore = useUserStore()

  function requireLogin() {
    if (!userStore.isLogin) {
      uni.navigateTo({
        url: '/pages/login/index'
      })
      return false
    }

    return true
  }

  return {
    requireLogin
  }
}
```

这里：

```txt
userStore 负责保存登录状态
useAuth 负责封装页面使用的登录判断逻辑
```

两者是配合关系，不是替代关系。

---

## 8. 判断标准

你可以这样判断：

### 放 store

```txt
这个数据多个页面都要用？
刷新后还要保留？
它代表应用当前状态？
别的页面改了，我这里也要同步变化？
```

比如：

```txt
token
userInfo
settings
theme
permission
currentTenant
```

这些放 store。

---

### 放 composable

```txt
这是一段页面逻辑？
只是为了多个页面复用？
每个页面都应该有自己独立的一份状态？
不需要长期保存？
```

比如：

```txt
分页
搜索
上传
倒计时
表单
弹窗
录音
键盘处理
```

这些放 composable。

---

## 9. 最容易犯的错误

### 错误一：把页面状态全塞 store

比如：

```txt
列表数据
loading
弹窗开关
当前 tab
搜索 keyword
临时表单
```

这些都放 store，会导致 store 越来越乱。

---

### 错误二：把全局状态放 composable

比如：

```ts
export function useUser() {
  const token = ref('')
  const userInfo = ref(null)

  return {
    token,
    userInfo
  }
}
```

这样每个页面调用 `useUser()` 都可能创建一份新的状态，数据不一定共享。

全局用户信息应该放 Pinia。

---

## 10. 一句话总结

```txt
store 管“全局状态”
composable 管“可复用逻辑”
```

在你的 uniapp 项目里，我建议这样定规范：

```txt
token、userInfo、settings、permission → store

分页、搜索、上传、倒计时、弹窗、表单、键盘处理 → composable

composable 可以调用 store，但不要用 composable 代替 store
store 可以写 actions，但不要把页面交互细节都塞进 store
```
