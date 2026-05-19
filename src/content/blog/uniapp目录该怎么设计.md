---
title: 'uni-app 项目目录设计：主包轻、分包清、公共能力独立'
date: 2026-05-19
tags: ['uni-app', '前端', '架构', 'TypeScript', 'Vue']
description: 'uniapp + Vue3 + TS + Pinia 项目的推荐目录结构、分层职责与分包组织原则'
draft: false
---

我建议你这个 **uniapp + Vue3 + TS + Pinia** 项目，目录按“主包轻、分包清、公共能力独立、业务跟随模块”来设计。

## 推荐目录结构

```txt
src
├─ api                         # 接口层：只封装后端接口
│  ├─ user.ts
│  ├─ auth.ts
│  ├─ settings.ts
│  └─ chat.ts
│
├─ services                    # 服务层：业务流程、平台能力、请求封装
│  ├─ request                  # 请求封装
│  │  ├─ index.ts
│  │  ├─ type.ts
│  │  └─ interceptor.ts
│  ├─ auth.ts                  # 登录/退出/刷新用户信息
│  ├─ storage.ts               # 本地缓存封装
│  ├─ upload.ts                # 上传封装
│  └─ router.ts                # 跳转封装
│
├─ stores                      # Pinia 全局状态
│  ├─ index.ts
│  └─ modules
│     ├─ app.ts                # 系统信息、平台信息
│     ├─ user.ts               # token、userInfo
│     ├─ settings.ts           # 全局配置
│     └─ permission.ts         # 权限、功能开关
│
├─ composables                 # 可复用页面逻辑
│  ├─ useLogin.ts
│  ├─ usePageList.ts
│  ├─ useUpload.ts
│  ├─ useAuth.ts
│  └─ useKeyboard.ts
│
├─ components                  # 全局基础组件
│  ├─ BaseButton
│  ├─ BasePopup
│  ├─ BaseEmpty
│  ├─ BaseLoading
│  └─ NavBar
│
├─ pages                       # 主包页面
│  ├─ index
│  │  └─ index.vue
│  ├─ login
│  │  └─ index.vue
│  ├─ mine
│  │  └─ index.vue
│  └─ webview
│     └─ index.vue
│
├─ subpackages                 # 分包页面
│  ├─ chat
│  │  ├─ pages
│  │  │  ├─ index
│  │  │  │  └─ index.vue
│  │  │  └─ detail
│  │  │     └─ index.vue
│  │  ├─ components
│  │  │  ├─ ChatBubble
│  │  │  └─ AgentCard
│  │  ├─ composables
│  │  │  └─ useChat.ts
│  │  └─ static
│  │
│  ├─ tools
│  │  ├─ pages
│  │  ├─ components
│  │  ├─ composables
│  │  └─ static
│  │
│  └─ order
│     ├─ pages
│     ├─ components
│     ├─ composables
│     └─ static
│
├─ utils                       # 纯工具函数
│  ├─ date.ts
│  ├─ format.ts
│  ├─ validate.ts
│  └─ common.ts
│
├─ enums                       # 枚举、固定业务值
│  ├─ user.ts
│  ├─ order.ts
│  ├─ request.ts
│  └─ storage.ts
│
├─ types                       # 类型定义
│  ├─ api.ts
│  ├─ user.ts
│  ├─ order.ts
│  ├─ settings.ts
│  └─ global.d.ts
│
├─ constants                   # 常量配置
│  ├─ app.ts
│  ├─ route.ts
│  └─ storage.ts
│
├─ styles                      # 全局样式
│  ├─ index.scss
│  ├─ variables.scss
│  ├─ mixins.scss
│  └─ theme.scss
│
├─ config                      # 环境配置
│  ├─ env.ts
│  └─ app.ts
│
├─ static                      # 主包公共静态资源，小图标/logo
│
├─ App.vue
├─ main.ts
├─ pages.json
├─ manifest.json
└─ uni.scss
```

---

## 核心设计原则

### 1. 主包只放必要页面

`pages` 里只放启动必须用到的页面：

```txt
首页
登录页
我的页
webview页
tabBar页面
```

不要把重业务页面都放主包。

比如这些建议进分包：

```txt
AI对话
工具模块
订单模块
支付模块
详情页
创作页
设置深层页面
```

---

### 2. 分包内部可以有自己的组件和逻辑

比如 `chat` 分包：

```txt
subpackages/chat
├─ pages
├─ components
├─ composables
└─ static
```

这样 `ChatBubble`、`AgentCard` 这类只服务对话模块的组件，不会污染全局 `components`。

不要所有组件都放到：

```txt
src/components
```

否则项目后面会越来越乱，也容易影响主包体积。

---

### 3. `api` 只管接口

```txt
api = 后端接口映射
```

比如：

```ts
// api/user.ts
export function getUserInfoApi() {}

export function loginApi() {}
```

不要在 `api` 里写跳转、toast、store 操作。

---

### 4. `services` 管业务流程

```txt
service = 把多个接口、store、缓存、跳转串成完整业务动作
```

比如登录流程：

```txt
调用登录接口
保存 token
获取用户信息
写入 userStore
加载全局配置
跳转首页
```

这些适合放：

```txt
services/auth.ts
```

---

### 5. `composables` 管复用逻辑

```txt
composable = 可复用页面逻辑
```

适合放：

```txt
分页
上传
登录弹窗
权限判断
倒计时
下拉刷新
键盘处理
录音逻辑
```

比如：

```txt
usePageList.ts
useUpload.ts
useAuth.ts
```

如果只是某个页面自己用，不复用，就直接写在页面里；如果页面太复杂，可以放在当前页面目录下：

```txt
pages/order/list
├─ index.vue
└─ useOrderList.ts
```

---

### 6. `store` 只放全局共享状态

适合放 Pinia 的数据：

```txt
token
userInfo
settings
theme
permission
currentTenant
globalConfig
```

不建议放：

```txt
页面 loading
当前 tab
搜索 keyword
临时表单
当前页面列表
弹窗开关
```

这些优先放页面内部或 composable。

---

## `pages.json` 示例

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
      "path": "pages/login/index",
      "style": {
        "navigationBarTitleText": "登录"
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
            "navigationBarTitleText": "AI对话"
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
  ],
  "tabBar": {
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页"
      },
      {
        "pagePath": "pages/mine/index",
        "text": "我的"
      }
    ]
  }
}
```

---

## 哪些东西放公共目录，哪些放分包？

### 放公共目录

```txt
src/api
src/services/request
src/stores/modules/user
src/stores/modules/app
src/stores/modules/settings
src/components/BaseButton
src/components/BasePopup
src/utils
src/types
src/enums
```

这些是多个模块都可能用的基础能力。

---

### 放分包目录

```txt
subpackages/chat/components/ChatBubble
subpackages/chat/composables/useChat
subpackages/chat/static/chat-bg.png

subpackages/tools/components/ToolCard
subpackages/tools/composables/useToolList
```

这些只属于某个业务模块，就跟着业务模块走。

---

## 不推荐的目录设计

### 1. 所有组件都放 components

```txt
components
├─ ChatBubble
├─ OrderCard
├─ ToolPanel
├─ VideoEditor
├─ UserCard
└─ BaseButton
```

这样后期分不清哪些是全局组件，哪些是业务组件。

---

### 2. 所有页面都放 pages

```txt
pages
├─ index
├─ login
├─ mine
├─ chat
├─ order
├─ tools
├─ video
└─ settings
```

这样主包会越来越大。

---

### 3. 所有逻辑都写在页面里

```txt
index.vue 1000 行
```

这种后期很难维护。

---

## 我建议你们团队定这个规范

```txt
1. pages 只放主包页面。
2. subpackages 放重业务页面。
3. 分包专属组件放分包 components。
4. 全局基础组件放 src/components。
5. api 只写接口。
6. service 写业务流程。
7. composables 写可复用页面逻辑。
8. store 只放全局共享状态。
9. utils 只放纯函数。
10. 大图片、视频、音频尽量走 CDN，不放主包 static。
```

最重要的一句话：

```txt
主包要轻，业务要分包，公共能力要克制，全局组件不能乱放。
```
