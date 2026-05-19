---
title: '用户 Token 存储方案：storage 持久化与 store 运行时状态'
date: 2026-05-19
tags: ['前端', 'uni-app', 'Vue', 'Pinia', '安全']
description: '登录态 token 在 uni-app 中如何配合 storage 与 Pinia store，含启动恢复与请求拦截'
draft: false
---

合理，**usertoken 可以放 storage，也可以放 store，但它们承担的职责不一样。**

最推荐的方式是：

> **storage 做持久化保存，store 做运行时状态管理。**

也就是：

```text
登录成功
↓
token 同时写入 storage + store

页面/接口请求时
↓
优先从 store 拿

App 启动/刷新/冷启动时
↓
从 storage 恢复到 store
```

---

## 1. storage 适合放什么？

`storage` 适合放 **需要持久保存** 的东西。

比如：

```ts
uni.setStorageSync('userToken', token)
```

它的特点是：

```text
关闭小程序 / 退出 App / 页面刷新后，数据还在
```

所以 token 放 storage 是合理的。

但是不要理解成 storage 很安全，它只是本地持久化，不能当成绝对安全的地方。

适合放：

```text
userToken
refreshToken
userInfo
tenantId
当前选中的环境
一些登录态缓存
```

---

## 2. store 适合放什么？

`store`，比如 Pinia / Vuex，适合放 **运行时状态**。

比如：

```ts
userStore.token = token
```

它的特点是：

```text
页面之间共享方便
响应式好用
但是刷新 / 冷启动后会丢
```

所以 token 放 store 也是合理的，但不能只放 store。

如果只放 store，会出现：

```text
登录后正常
↓
关闭小程序再进来
↓
store 没了
↓
用户又变成未登录
```

除非你用了 Pinia 持久化插件，本质上也是把 store 同步到了 storage。

---

## 3. 什么时候从 store 拿？

**正常业务运行时，优先从 store 拿。**

比如请求拦截器里：

```ts
const userStore = useUserStore()

const token = userStore.token

if (token) {
  header.Authorization = `Bearer ${token}`
}
```

适合从 store 拿的场景：

```text
接口请求时
判断是否登录时
页面展示用户信息时
权限判断时
路由拦截时
```

因为 store 是内存状态，读取快，而且响应式好。

---

## 4. 什么时候从 storage 拿？

storage 主要在这些时机拿：

### 1）应用启动时

比如 `App.vue` 里：

```ts
onLaunch(() => {
  userStore.initAuth()
})
```

Pinia 里：

```ts
const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    userInfo: null
  }),

  actions: {
    initAuth() {
      const token = uni.getStorageSync('userToken')
      if (token) {
        this.token = token
      }
    }
  }
})
```

这个动作叫：

```text
从 storage 恢复登录态到 store
```

---

### 2）store 里没有 token，但 storage 有 token

比如请求拦截器里可以做一层兜底：

```ts
let token = userStore.token

if (!token) {
  token = uni.getStorageSync('userToken')
  if (token) {
    userStore.setToken(token)
  }
}
```

但是注意：**不要每次请求都直接读 storage。**

不推荐这样：

```ts
// 不推荐每个请求都这样
const token = uni.getStorageSync('userToken')
```

更推荐：

```text
store 有就用 store
store 没有再从 storage 恢复
```

---

## 5. 登录、退出、刷新 token 怎么处理？

### 登录成功

```ts
setToken(token) {
  this.token = token
  uni.setStorageSync('userToken', token)
}
```

也就是：

```text
store + storage 同步写入
```

---

### 退出登录

```ts
logout() {
  this.token = ''
  this.userInfo = null

  uni.removeStorageSync('userToken')
  uni.removeStorageSync('userInfo')
}
```

也就是：

```text
store 清空
storage 也清空
```

---

### token 刷新成功

```ts
refreshTokenSuccess(newToken) {
  this.token = newToken
  uni.setStorageSync('userToken', newToken)
}
```

也就是：

```text
新 token 同步更新 store + storage
```

---

## 6. 推荐结构

可以封装到 `userStore` 里：

```ts
export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    userInfo: null
  }),

  getters: {
    isLogin: (state) => !!state.token
  },

  actions: {
    initAuth() {
      const token = uni.getStorageSync('userToken')
      const userInfo = uni.getStorageSync('userInfo')

      if (token) this.token = token
      if (userInfo) this.userInfo = userInfo
    },

    setToken(token: string) {
      this.token = token
      uni.setStorageSync('userToken', token)
    },

    setUserInfo(userInfo: any) {
      this.userInfo = userInfo
      uni.setStorageSync('userInfo', userInfo)
    },

    logout() {
      this.token = ''
      this.userInfo = null

      uni.removeStorageSync('userToken')
      uni.removeStorageSync('userInfo')
    }
  }
})
```

---

## 7. 最佳实践总结

你可以这样定规则：

| 场景       | 从哪里拿                         |
| -------- | ---------------------------- |
| App 启动   | storage → store              |
| 页面正常使用   | store                        |
| 请求接口     | 优先 store，store 没有再兜底 storage |
| 登录成功     | 写入 store + storage           |
| 退出登录     | 清空 store + storage           |
| token 刷新 | 更新 store + storage           |
| 判断是否登录   | 优先 store                     |
| 冷启动恢复登录态 | storage                      |

---

## 结论

你的项目里可以这样设计：

```text
storage：负责持久化，解决刷新/重启后登录态丢失问题
store：负责运行时状态，解决页面共享、接口请求、权限判断问题
```

一句话：

> **token 可以放 storage，但业务代码尽量从 store 拿；storage 只用于初始化和兜底恢复。**
