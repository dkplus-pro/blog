---
title: 'uni-app 项目设计完全指南：从目录结构到分包优化'
date: 2026-05-13
tags: ['uni-app', '前端', '架构', 'TypeScript', 'Vue']
description: '中大型 uni-app 项目的完整设计方案，包括目录结构、状态管理、请求封装、分包设计和代码规范'
draft: false
---

我会按 **中大型小程序项目** 来设计，核心目标是：**目录清晰、状态可控、请求统一、类型完整、方便多人协作、后期能拆分包/多小程序复用**。

uni-app 本身是基于 Vue 的跨端框架，一套代码可以发布到 Web、App、多个小程序平台；`pages.json` 负责全局页面路由、导航栏、tabBar 等配置；Vue 官方对 TypeScript 是一等支持，Pinia 也是轻量、类型友好、模块化的状态管理方案。([uni-app][1])

---

## 1. 技术选型

我会这样定：

```txt
uni-app
Vue 3
TypeScript
Pinia
pinia-plugin-persistedstate
scss / less
eslint + prettier
husky + lint-staged
pnpm
```

`pinia-plugin-persistedstate` 负责把 Pinia 里的关键状态持久化，比如 token、用户信息、主题配置等，它支持自定义 storage、序列化、指定持久化字段。([GitHub][2])

---

## 2. 项目目录设计

我会这样拆：

```txt
src
├─ api                  # 业务接口定义
│  ├─ user.ts
│  ├─ auth.ts
│  ├─ chat.ts
│  └─ settings.ts
│
├─ assets               # 本地静态资源，参与构建
│  ├─ images
│  └─ icons
│
├─ components           # 全局通用组件
│  ├─ BaseButton
│  ├─ BaseEmpty
│  ├─ BasePopup
│  └─ NavBar
│
├─ composables          # 组合式逻辑 hooks
│  ├─ useLogin.ts
│  ├─ useUpload.ts
│  ├─ usePageScroll.ts
│  └─ usePermission.ts
│
├─ config               # 环境配置
│  ├─ env.ts
│  ├─ request.ts
│  └─ constant.ts
│
├─ enums                # 枚举
│  ├─ user.ts
│  ├─ order.ts
│  └─ request.ts
│
├─ layouts              # 页面布局
│  ├─ DefaultLayout.vue
│  └─ AuthLayout.vue
│
├─ pages                # 主包页面
│  ├─ index
│  ├─ login
│  ├─ mine
│  └─ webview
│
├─ subpackages          # 分包页面
│  ├─ chat
│  ├─ tools
│  ├─ order
│  └─ settings
│
├─ services             # 基础服务层
│  ├─ request
│  │  ├─ index.ts
│  │  ├─ interceptor.ts
│  │  └─ type.ts
│  ├─ storage.ts
│  ├─ upload.ts
│  └─ router.ts
│
├─ stores               # Pinia 状态
│  ├─ modules
│  │  ├─ app.ts
│  │  ├─ user.ts
│  │  ├─ auth.ts
│  │  ├─ settings.ts
│  │  └─ chat.ts
│  └─ index.ts
│
├─ styles               # 全局样式
│  ├─ index.scss
│  ├─ variables.scss
│  ├─ mixins.scss
│  └─ theme.scss
│
├─ types                # 全局类型
│  ├─ api.d.ts
│  ├─ user.d.ts
│  ├─ global.d.ts
│  └─ business.d.ts
│
├─ utils                # 纯工具函数
│  ├─ date.ts
│  ├─ format.ts
│  ├─ validate.ts
│  └─ auth.ts
│
├─ App.vue
├─ main.ts
├─ manifest.json
├─ pages.json
└─ uni.scss
```

---

## 3. 分包设计

主包只放启动必要内容：

```txt
主包：
首页
登录页
我的页
webview页
全局组件
基础请求
基础 store
```

业务重页面放分包：

```txt
subpackages/chat      对话模块
subpackages/tools     工具模块
subpackages/order     订单模块
subpackages/settings  设置模块
```

`pages.json` 里统一配置主包页面、tabBar、分包页面。uni-app 的页面路由和窗口表现就是通过 `pages.json` 配置的，分包也应该在这里管理。([Uni-App][3])

示例：

```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "首页"
      }
    },
    {
      "path": "pages/mine/index",
      "style": {
        "navigationBarTitleText": "我的"
      }
    }
  ],
  "subPackages": [
    {
      "root": "subpackages/chat",
      "pages": [
        {
          "path": "pages/index/index",
          "style": {
            "navigationBarTitleText": "AI 对话"
          }
        }
      ]
    },
    {
      "root": "subpackages/tools",
      "pages": [
        {
          "path": "pages/index/index",
          "style": {
            "navigationBarTitleText": "工具"
          }
        }
      ]
    }
  ]
}
```

我的原则是：

```txt
首屏必须用到的，进主包
低频业务，进分包
重组件，尽量跟随业务分包
全局组件必须克制
公共 utils 不要大而全
```

---

## 4. 请求层设计

不要在页面里直接写 `uni.request`，统一封装。

```txt
页面 → api模块 → request封装 → uni.request
```

示例：

```ts
// services/request/type.ts
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
  loading?: boolean
}
```

```ts
// services/request/index.ts
import { useUserStore } from '@/stores/modules/user'
import type { ApiResponse, RequestOptions } from './type'
import { BASE_URL } from '@/config/env'

export function request<T = unknown>(options: RequestOptions): Promise<T> {
  const userStore = useUserStore()

  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        Authorization: userStore.token ? `Bearer ${userStore.token}` : '',
        ...options.header
      },
      success: (res) => {
        const result = res.data as ApiResponse<T>

        if (result.code === 200) {
          resolve(result.data)
          return
        }

        if (result.code === 401) {
          userStore.logout()
          uni.navigateTo({ url: '/pages/login/index' })
          reject(result)
          return
        }

        uni.showToast({
          title: result.message || '请求失败',
          icon: 'none'
        })

        reject(result)
      },
      fail: reject
    })
  })
}
```

业务接口这样写：

```ts
// api/user.ts
import { request } from '@/services/request'

export interface UserInfo {
  id: string
  nickname: string
  avatar: string
}

export function getUserInfo() {
  return request<UserInfo>({
    url: '/user/info',
    method: 'GET'
  })
}
```

页面使用：

```ts
const userInfo = await getUserInfo()
```

---

## 5. Pinia 设计

Pinia 只放“真正需要共享的状态”，不要什么都塞 store。

我会分成这些 store：

```txt
appStore        系统信息、胶囊按钮、安全区、平台信息
userStore       token、userInfo、登录状态
settingsStore   租户配置、全局开关、主题配置
chatStore       当前会话、当前 agent、临时对话状态
permissionStore 权限、角色、功能开关
```

### userStore 示例

```ts
// stores/modules/user.ts
import { defineStore } from 'pinia'

interface UserInfo {
  id: string
  nickname: string
  avatar: string
}

interface UserState {
  token: string
  userInfo: UserInfo | null
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
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

    setUserInfo(userInfo: UserInfo) {
      this.userInfo = userInfo
    },

    logout() {
      this.token = ''
      this.userInfo = null
    }
  },

  persist: {
    key: 'USER_STORE',
    paths: ['token', 'userInfo']
  }
})
```

注意：

```txt
token、userInfo 可以持久化
列表数据不建议长期持久化
表单临时状态不建议放全局 store
页面内部状态优先用 ref/reactive
跨页面共享才考虑 Pinia
一次性事件通知才考虑 eventBus
```

---

## 6. Pinia 持久化适配 uniapp

Web 里常见是 `localStorage`，但 uniapp 小程序里更建议封装成 `uni.getStorageSync` / `uni.setStorageSync`。

```ts
// stores/index.ts
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const pinia = createPinia()

pinia.use(
  piniaPluginPersistedstate({
    storage: {
      getItem: (key: string) => uni.getStorageSync(key),
      setItem: (key: string, value: string) => uni.setStorageSync(key, value),
      removeItem: (key: string) => uni.removeStorageSync(key)
    }
  })
)

export default pinia
```

---

## 7. main.ts 入口设计

```ts
import { createSSRApp } from 'vue'
import App from './App.vue'
import pinia from './stores'

import './styles/index.scss'

export function createApp() {
  const app = createSSRApp(App)

  app.use(pinia)

  return {
    app
  }
}
```

---

## 8. 环境配置设计

建议至少分：

```txt
dev
test
pre
prod
```

```ts
// config/env.ts
type Env = 'dev' | 'test' | 'pre' | 'prod'

const ENV = import.meta.env.VITE_APP_ENV as Env

const configMap = {
  dev: {
    baseUrl: 'https://dev-api.xxx.com'
  },
  test: {
    baseUrl: 'https://test-api.xxx.com'
  },
  pre: {
    baseUrl: 'https://pre-api.xxx.com'
  },
  prod: {
    baseUrl: 'https://api.xxx.com'
  }
}

export const BASE_URL = configMap[ENV].baseUrl
```

package.json：

```json
{
  "scripts": {
    "dev:mp-weixin": "uni -p mp-weixin",
    "build:dev": "VITE_APP_ENV=dev uni build -p mp-weixin",
    "build:test": "VITE_APP_ENV=test uni build -p mp-weixin",
    "build:prod": "VITE_APP_ENV=prod uni build -p mp-weixin"
  }
}
```

Windows 团队建议用 `cross-env`：

```json
{
  "scripts": {
    "build:test": "cross-env VITE_APP_ENV=test uni build -p mp-weixin"
  }
}
```

---

## 9. 多端差异处理

uni-app 有条件编译机制，适合处理不同平台差异，不建议在业务里堆一堆 `if else`。官方文档也说明，条件编译是用特殊注释标记，在编译时按平台保留对应代码。([uni-app][4])

例如：

```ts
// #ifdef MP-WEIXIN
console.log('微信小程序逻辑')
// #endif

// #ifdef H5
console.log('H5 逻辑')
// #endif
```

我会把平台差异封装到 service 里：

```txt
services/platform
├─ index.ts
├─ wechat.ts
├─ h5.ts
└─ app.ts
```

页面里不要到处写平台判断。

---

## 10. 类型设计

核心原则：

```txt
接口返回值必须有类型
业务实体必须有类型
组件 props 必须有类型
不要到处 any
```

例如：

```ts
// types/api.d.ts
export interface PageParams {
  pageNum: number
  pageSize: number
}

export interface PageResult<T> {
  list: T[]
  total: number
  pageNum: number
  pageSize: number
}
```

```ts
// api/order.ts
import type { PageParams, PageResult } from '@/types/api'

export interface OrderItem {
  id: string
  title: string
  status: number
  createTime: string
}

export function getOrderList(params: PageParams) {
  return request<PageResult<OrderItem>>({
    url: '/order/list',
    method: 'GET',
    data: params
  })
}
```

---

## 11. 路由跳转封装

uniapp 没有 Vue Router 那种完整路由体系，所以我会封装一个轻量 router service。

```ts
// services/router.ts
export function navigateTo(url: string, params?: Record<string, string | number>) {
  const query = params
    ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    : ''

  return uni.navigateTo({
    url: url + query
  })
}

export function switchTab(url: string) {
  return uni.switchTab({ url })
}

export function redirectTo(url: string) {
  return uni.redirectTo({ url })
}

export function back(delta = 1) {
  return uni.navigateBack({ delta })
}
```

页面里：

```ts
navigateTo('/subpackages/chat/pages/detail/index', {
  id: '123'
})
```

---

## 12. 组件设计

组件分三类：

```txt
基础组件：BaseButton、BaseInput、BasePopup
业务组件：UserCard、OrderCard、ChatBubble
页面组件：只服务某个页面，不放全局 components
```

不要把所有组件都放到全局目录，尤其小程序项目会影响主包体积。

建议：

```txt
components/BaseButton
subpackages/chat/components/ChatBubble
subpackages/order/components/OrderCard
```

原则：

```txt
全局组件少而精
业务组件跟随业务模块
分包里的组件放分包内
不要为了“复用可能性”提前抽太多组件
```

---

## 13. 静态资源设计

```txt
小图标、小背景：assets
无需构建处理的资源：static
大图、视频、音频：走 CDN
```

不要把大量图片塞进主包。

建议：

```txt
tabBar 图标：本地
页面 banner：CDN
业务图片：CDN
视频/音频：CDN
```

---

## 14. 登录权限设计

我会设计成三层：

```txt
1. token 判断
2. 用户信息判断
3. 页面权限/功能权限判断
```

封装：

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

页面里：

```ts
const { requireLogin } = useAuth()

function handleSubmit() {
  if (!requireLogin()) return

  // 继续业务逻辑
}
```

---

## 15. 全局配置接口设计

你之前提到过 `/settings` 这种通用配置接口，这类我会放到 `settingsStore`。

```ts
// stores/modules/settings.ts
import { defineStore } from 'pinia'
import { getSettings } from '@/api/settings'

interface SettingsState {
  config: Record<string, unknown>
  loaded: boolean
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    config: {},
    loaded: false
  }),

  actions: {
    async loadSettings() {
      if (this.loaded) return

      const res = await getSettings()
      this.config = res
      this.loaded = true
    },

    getValue<T = unknown>(key: string, defaultValue?: T): T {
      return (this.config[key] as T) ?? defaultValue as T
    }
  }
})
```

业务里：

```ts
const settingsStore = useSettingsStore()

const enableChat = settingsStore.getValue<boolean>('enable_chat', false)
```

---

## 16. 代码规范

我会强制加：

```txt
eslint
prettier
stylelint
husky
lint-staged
commitlint
```

提交规范：

```txt
feat: 新功能
fix: 修复问题
refactor: 重构
style: 样式调整
docs: 文档
chore: 构建/依赖
test: 测试
```

分支规范：

```txt
main
test
release/x.x.x
feature/xxx
fix/xxx
hotfix/xxx
```

---

## 17. 我的最终设计原则

我会把这个项目定成这样：

```txt
页面只负责展示和交互
api 只负责接口声明
request 只负责请求拦截和错误处理
store 只负责全局状态
composables 负责复用逻辑
services 负责平台能力和业务服务
types 统一管理类型
subpackages 控制主包体积
```

一句话：

**不要把业务都堆在页面里，也不要把状态都塞进 Pinia。页面轻、接口清、状态少、分包稳，这个 uniapp 项目后面才好维护。**

[1]: https://uniapp.dcloud.net.cn/?utm_source=chatgpt.com "uni-app官网"
[2]: https://github.com/prazdevs/pinia-plugin-persistedstate?utm_source=chatgpt.com "prazdevs/pinia-plugin-persistedstate: 💾 Configurable ..."
[3]: https://en.uniapp.dcloud.io/collocation/pages.html?utm_source=chatgpt.com "pages.json 页面路由 - uni-app官网"
[4]: https://uniapp.dcloud.net.cn/tutorial/platform.html?utm_source=chatgpt.com "条件编译处理多端差异| uni-app官网"
