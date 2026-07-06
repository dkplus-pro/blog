---
title: 'Schema 驱动的多租户 uni-app 小程序 SaaS 架构设计'
date: 2026-07-06
tags: ['小程序', 'uni-app', 'SaaS', 'Schema', '架构']
description: '基于 schema 驱动设计多租户 uni-app 小程序 SaaS 架构，梳理租户配置、代码生成、app-shell、业务模块、构建发布与主包分包治理思路'
draft: false
---

# Schema 驱动的多租户 uni-app 小程序 SaaS 架构设计

## 一、背景

在传统小程序项目中，页面、路由、TabBar、静态资源、业务模块、请求配置通常都写死在项目代码里。

这种方式在单一小程序场景下问题不大，但当项目开始面向多个租户时，就会逐渐暴露问题。

例如：

```text
App1：
- tab：A、B、C
- 页面 B 使用模块 a、b、c、d

App2：
- tab：A、B、D
- 页面 B 使用模块 a、d、c
- 页面 A 的标题和 App1 不同
- 静态资源、appid、接口域名也不同
```

如果继续用传统方式开发，很容易出现大量硬编码：

```ts
if (tenantId === 'app1') {
  // app1 逻辑
}

if (tenantId === 'app2') {
  // app2 逻辑
}
```

随着租户数量增加，代码会快速失控。

更严重的是，小程序本身还有主包、分包、静态资源体积限制。如果所有租户、所有页面、所有模块、所有资源都混在一个项目里，最终会导致：

```text
主包越来越大
vendor 越来越难优化
未启用的页面也可能进入产物
未使用的模块也可能被打包
静态资源无法按租户隔离
发布流程无法标准化
```

因此，更合理的方式是把小程序项目改造成一个：

> **Schema 驱动的多租户小程序编译平台。**

也就是说：

```text
用 schema 描述租户差异
用 generator 生成配置和胶水代码
用 app-shell 提供统一运行壳
用 biz/base 提供真实业务能力
用 scripts/CI 负责构建、上传、审核、发布
```

---

## 二、整体架构目标

这套架构的核心目标不是做一个简单的小程序模板，而是建立一套可扩展的多租户编译体系。

它需要解决几个问题：

```text
1. 不同租户可以拥有不同 appid、名称、版本、接口配置
2. 不同租户可以拥有不同 tabBar
3. 不同租户可以启用不同页面
4. 不同租户可以在同一页面中配置不同模块和顺序
5. 不同租户可以启用不同业务能力
6. 不同租户可以使用不同静态资源
7. 不同租户可以拥有不同主包/分包结构
8. 构建时只打包当前租户需要的页面、模块和资源
9. CI/CD 可以按租户批量构建、上传、审核、发布
```

最终希望形成这样的链路：

```text
tenant schema
    ↓
schema validate
    ↓
registry resolve
    ↓
generated code
    ↓
uni-app build
    ↓
package analyze
    ↓
upload / audit / release
```

---

## 三、整体分层设计

推荐整体分层如下：

```text
saas-miniapp/
├── schema/              # schema 层：描述租户要什么
├── registry/            # registry 层：描述系统有什么
├── generated/           # generated 层：根据 schema 生成胶水代码
├── app-shell/           # 模板壳层：统一应用入口和配置消费方式
├── biz/                 # 业务层：页面、模块、业务组件、业务 hooks
├── base/                # 基础层：基础组件、请求、store、JSB、工具
├── tenant-assets/       # 租户静态资源层
└── scripts/             # 编译发布脚本层
```

可以理解为：

```text
schema 层：声明当前租户需要什么
registry 层：声明系统里有哪些页面、模块、能力和资源
generated 层：把 schema + registry 转换成静态代码
app-shell 层：统一消费 generated 配置
biz 层：提供真实业务实现
base 层：提供通用基础能力
tenant-assets 层：按租户管理静态资源
scripts 层：完成校验、生成、构建、发布
```

---

## 四、Schema 层：描述租户差异

Schema 层是整个架构的入口。

它的职责是描述一个租户的小程序长什么样，包括：

```text
小程序 meta
tenant 描述
tabs 描述
pages 描述
modules 描述
capabilities 能力描述
statics 静态资源描述
sub-package 分包描述
store 描述
release 发布描述
```

一个简化后的 schema 可以长这样：

```json
{
  "schemaVersion": "1.0.0",
  "tenant": {
    "tenantId": "app2",
    "tenantName": "App2 租户"
  },
  "app": {
    "appKey": "app2",
    "appid": "wx_app2",
    "name": "App2 小程序",
    "version": "0.1.0"
  },
  "packages": {
    "main": {
      "type": "main"
    },
    "business": {
      "type": "sub",
      "root": "pages-sub/business",
      "independent": false
    }
  },
  "tabs": [
    {
      "key": "tab-a",
      "text": "A",
      "page": "page-a",
      "icon": "tab-a.png",
      "selectedIcon": "tab-a-active.png"
    },
    {
      "key": "tab-b",
      "text": "B",
      "page": "page-b",
      "icon": "tab-b.png",
      "selectedIcon": "tab-b-active.png"
    },
    {
      "key": "tab-d",
      "text": "D",
      "page": "page-d",
      "icon": "tab-d.png",
      "selectedIcon": "tab-d-active.png"
    }
  ],
  "pages": {
    "page-a": {
      "route": "pages/page-a/index",
      "title": "App2 首页",
      "enabled": true,
      "package": "main",
      "layout": "normal",
      "modules": []
    },
    "page-b": {
      "route": "pages/page-b/index",
      "title": "App2 页面B",
      "enabled": true,
      "package": "main",
      "layout": "stream",
      "modules": [
        {
          "id": "module-a-1",
          "type": "module-a",
          "enabled": true,
          "props": {}
        },
        {
          "id": "module-d-1",
          "type": "module-d",
          "enabled": true,
          "props": {}
        },
        {
          "id": "module-c-1",
          "type": "module-c",
          "enabled": true,
          "props": {}
        }
      ]
    },
    "page-d": {
      "route": "pages/page-d/index",
      "title": "App2 页面D",
      "enabled": true,
      "package": "main",
      "layout": "normal",
      "modules": []
    }
  },
  "capabilities": {
    "enableAiChat": true,
    "enablePayment": false,
    "enableInvite": true
  },
  "runtime": {
    "theme": {
      "primaryColor": "#52c41a"
    },
    "apiProfile": "app2-prod"
  },
  "release": {
    "channels": {
      "wechat": {
        "uploadEnabled": false,
        "auditEnabled": false,
        "releaseEnabled": false
      }
    }
  }
}
```

Schema 层要注意一个原则：

> **Schema 只描述租户需要什么，不描述代码怎么实现。**

例如 schema 可以写：

```json
{
  "type": "module-a"
}
```

但不建议写：

```json
{
  "componentPath": "@/biz/modules/module-a/index.vue"
}
```

组件路径、store 路径、能力实现路径属于工程实现细节，应该交给 registry 层维护。

---

## 五、Registry 层：描述系统能力

在 schema 和业务代码之间，建议增加一个非常重要的层：

```text
registry 注册层
```

它的作用是描述系统里到底有哪些页面、模块、能力、store 和静态资源。

Schema 说：

```text
我要使用 module-a
```

Registry 负责回答：

```text
module-a 对应哪个组件？
module-a 需要哪些 props？
module-a 依赖哪些 capability？
module-a 依赖哪些 store？
module-a 是否允许出现在 stream 布局里？
module-a 是否需要额外静态资源？
```

例如：

```ts
// registry/module.registry.ts

export const moduleRegistry = {
  'module-a': {
    name: '模块A',
    component: '@/biz/modules/module-a/index.vue',
    capabilities: ['enableAiChat'],
    stores: ['moduleAStore'],
    allowedLayouts: ['stream'],
    assets: ['module-a-banner']
  },

  'module-c': {
    name: '模块C',
    component: '@/biz/modules/module-c/index.vue',
    capabilities: [],
    stores: [],
    allowedLayouts: ['stream'],
    assets: []
  },

  'module-d': {
    name: '模块D',
    component: '@/biz/modules/module-d/index.vue',
    capabilities: [],
    stores: [],
    allowedLayouts: ['stream'],
    assets: []
  }
}
```

页面也可以有自己的 registry：

```ts
// registry/page.registry.ts

export const pageRegistry = {
  'page-a': {
    route: 'pages/page-a/index',
    component: '@/biz/pages/page-a/index.vue',
    defaultPackage: 'main'
  },

  'page-b': {
    route: 'pages/page-b/index',
    component: '@/biz/pages/page-b/index.vue',
    defaultPackage: 'main',
    supportedLayouts: ['stream']
  },

  'page-d': {
    route: 'pages/page-d/index',
    component: '@/biz/pages/page-d/index.vue',
    defaultPackage: 'business'
  }
}
```

这样分层后，职责非常清楚：

```text
schema：租户要什么
registry：系统有什么
generated：生成怎么接入
biz：真实业务实现
```

---

## 六、Generated 层：生成配置和胶水代码

Generated 层是根据 schema 和 registry 生成出来的代码。

它不应该由开发者手写维护。

推荐目录：

```text
src/.generated/
└── app2/
    ├── tenant.config.ts
    ├── app.config.ts
    ├── tabs.config.ts
    ├── pages.config.ts
    ├── modules.config.ts
    ├── page-assets.config.ts
    ├── sub-packages.config.ts
    ├── capabilities.config.ts
    ├── store.config.ts
    └── runtime.config.ts
```

每个生成文件都建议加上注释：

```ts
/**
 * AUTO GENERATED FILE.
 * DO NOT EDIT MANUALLY.
 */
```

Generated 层的核心职责有两个。

### 1. 生成运行时配置

例如：

```ts
export const tenantConfig = {
  tenantId: 'app2',
  tenantName: 'App2 租户'
}

export const appConfig = {
  appKey: 'app2',
  appid: 'wx_app2',
  name: 'App2 小程序',
  version: '0.1.0'
}
```

### 2. 生成静态 import 胶水代码

这一点非常关键。

不要在运行时这样动态加载模块：

```ts
const component = await import(`@/biz/modules/${moduleType}/index.vue`)
```

这种动态路径对小程序分包和构建优化不友好。

更推荐由 generator 根据 schema 生成明确的静态 import：

```ts
import ModuleA from '@/biz/modules/module-a/index.vue'
import ModuleD from '@/biz/modules/module-d/index.vue'
import ModuleC from '@/biz/modules/module-c/index.vue'

export const moduleMap = {
  'module-a': ModuleA,
  'module-d': ModuleD,
  'module-c': ModuleC
}
```

这样 App2 只会引用 `module-a`、`module-d`、`module-c`。

如果 App2 没有启用 `module-b` 和 `module-e`，它们就不应该出现在 generated 的 import 里。

这对分包和主包体积优化非常重要。

---

## 七、App Shell 模板层：统一应用壳

原来可以叫 template 层，但更推荐叫：

```text
app-shell
```

因为它不只是模板文件，而是整个小程序的统一运行壳。

App Shell 的职责是：

```text
提供统一入口
消费 generated 配置
初始化租户运行时
生成 manifest 配置
生成 pages 配置
挂载 store
初始化能力开关
初始化主题、请求、埋点等基础设施
```

例如：

```text
app-shell/
├── App.vue
├── main.ts
├── manifest.config.ts
├── pages.config.ts
├── runtime.ts
└── bootstrap.ts
```

App Shell 不应该关心具体租户是谁。

它不应该写：

```ts
if (tenantId === 'app2') {
  // 特殊逻辑
}
```

它应该只消费 generated 配置：

```ts
import { tenantConfig } from '@/generated/tenant.config'
import { appConfig } from '@/generated/app.config'
import { tabsConfig } from '@/generated/tabs.config'
import { pagesConfig } from '@/generated/pages.config'
import { capabilityConfig } from '@/generated/capabilities.config'
import { runtimeConfig } from '@/generated/runtime.config'
```

也就是说：

```text
App Shell 不关心 App1 / App2 / App3
App Shell 只关心 generated 配置给了什么
```

---

## 八、Biz 业务层：页面、模块和业务组件

Biz 层负责承载真实业务实现。

推荐结构：

```text
biz/
├── pages/
│   ├── page-a/
│   │   ├── index.vue
│   │   ├── service.ts
│   │   └── utils.ts
│   ├── page-b/
│   │   ├── index.vue
│   │   └── layout-stream.vue
│   └── page-d/
│       ├── index.vue
│       └── service.ts
│
├── modules/
│   ├── module-a/
│   │   ├── index.vue
│   │   ├── service.ts
│   │   ├── utils.ts
│   │   └── types.ts
│   ├── module-c/
│   │   ├── index.vue
│   │   └── utils.ts
│   └── module-d/
│       ├── index.vue
│       └── service.ts
│
├── components/
│   ├── UserCard/
│   ├── OrderItem/
│   └── VideoCard/
│
└── hooks/
    ├── useOrderList.ts
    ├── useUserProfile.ts
    └── useVideoDetail.ts
```

Biz 层有一个重要原则：

> **业务私有逻辑应该尽量贴近页面或模块，而不是全部放到全局 utils。**

例如：

```text
只服务 page-a 的工具函数
→ 放 biz/pages/page-a/utils.ts

只服务 module-a 的工具函数
→ 放 biz/modules/module-a/utils.ts

只服务 order 分包多个页面的工具函数
→ 放 pages-sub/order/_shared/order-utils.ts
```

这样做的好处是：

```text
代码归属清楚
删除页面时可以一起删除
模块迁移更容易
分包依赖更清楚
不容易污染主包
vendor 更容易优化
```

---

## 九、Base 基础层：稳定通用能力

Base 层是全局基础设施层。

它应该放真正稳定、全局可复用、没有具体业务语义的能力。

推荐结构：

```text
base/
├── components/
│   ├── BaseButton/
│   ├── BaseImage/
│   ├── BaseEmpty/
│   └── BaseDialog/
│
├── hooks/
│   ├── useRequest.ts
│   ├── usePageLifecycle.ts
│   ├── useAuth.ts
│   └── useDebounce.ts
│
├── store/
│   ├── createStore.ts
│   ├── plugins.ts
│   └── modules/
│
├── request/
│   ├── openapi-request.ts
│   ├── interceptors.ts
│   └── types.ts
│
├── jsb/
│   ├── bridge.ts
│   ├── device.ts
│   └── share.ts
│
├── constants/
├── utils/
├── logger/
└── monitor/
```

Base 和 Biz 的边界可以这样判断：

```text
Base：
- 不带具体业务语义
- 多个页面、多个模块都稳定使用
- 可以作为基础能力长期存在

Biz：
- 带业务语义
- 服务具体页面、模块、业务场景
- 随业务变化而变化
```

例如：

```text
useRequest           → base
useOrderList         → biz

BaseButton           → base
OrderCard            → biz

formatDate           → base
formatOrderStatus    → biz

openapiRequest       → base
getOrderDetail       → biz
```

Base 层不要反向依赖 Biz 层。

这是非常重要的架构约束。

---

## 十、静态资源层：按租户管理，按租户复制

多租户小程序里，静态资源很容易失控。

如果简单这样放：

```text
static/
├── app1/
├── app2/
├── app3/
```

构建时如果整个 static 都被复制进产物，那么 App2 的包里可能会带上 App1、App3 的资源。

这会直接破坏包体积优化。

更推荐源码层这样组织：

```text
tenant-assets/
├── app1/
│   ├── logo.png
│   ├── tab-home.png
│   └── tab-home-active.png
│
├── app2/
│   ├── logo.png
│   ├── tab-a.png
│   ├── tab-a-active.png
│   ├── tab-b.png
│   ├── tab-b-active.png
│   ├── tab-d.png
│   └── tab-d-active.png
│
└── app3/
    ├── logo.png
    └── tab-home.png
```

构建 App2 时，脚本只复制 App2 的资源到产物目录：

```text
dist/static/tenant/
```

同时 generated 层生成资源映射：

```ts
export const assetsConfig = {
  logo: '/static/tenant/logo.png',
  tabA: '/static/tenant/tab-a.png',
  tabAActive: '/static/tenant/tab-a-active.png',
  tabB: '/static/tenant/tab-b.png',
  tabBActive: '/static/tenant/tab-b-active.png',
  tabD: '/static/tenant/tab-d.png',
  tabDActive: '/static/tenant/tab-d-active.png'
}
```

最终原则是：

```text
源码层可以按租户分类管理资源
产物层只保留当前租户资源
```

---

## 十一、Scripts 层：编译和发布流水线

Scripts 层不只是简单执行 build，它应该承担整个编译平台的工作流。

推荐拆成：

```text
scripts/
├── validate-schema.ts
├── normalize-schema.ts
├── resolve-registry.ts
├── check-capabilities.ts
├── check-packages.ts
├── generate-code.ts
├── generate-pages.ts
├── generate-manifest.ts
├── copy-assets.ts
├── build-tenant.ts
├── analyze-size.ts
├── upload-wechat.ts
├── submit-audit.ts
└── release.ts
```

完整流程可以是：

```text
1. 读取 tenant schema
2. 校验 schema 合法性
3. 标准化 schema
4. 解析 registry
5. 校验页面、模块、能力、分包关系
6. 生成 generated 配置和胶水代码
7. 复制当前租户静态资源
8. 生成 pages.json / manifest.config
9. 执行 uni-app 小程序构建
10. 分析主包、分包、vendor 体积
11. 根据 release 配置决定是否上传
12. 根据 release 配置决定是否提交审核
13. 根据 release 配置决定是否发布
```

其中校验非常重要。

至少要校验：

```text
tabs[].page 是否存在
tabs[].page 是否 enabled
tab 页面是否在主包
page.package 是否存在
page.route 是否重复
module.type 是否存在于 moduleRegistry
module.props 是否符合模块定义
module 是否允许出现在当前 layout
module 依赖的 capability 是否已启用
capability 是否存在于 capabilityRegistry
store 是否存在于 storeRegistry
静态资源是否存在
appid 是否与 tenant 匹配
release 配置是否允许当前操作
```

不要让错误进入构建阶段才暴露。

越早失败，越容易定位。

---

## 十二、依赖方向设计

这个架构能不能长期稳定，关键不是目录名字，而是依赖方向。

推荐依赖方向：

```text
schema
  ↓
scripts / compiler
  ↓
generated
  ↓
app-shell
  ↓
runtime app
```

业务依赖方向：

```text
biz
  ↓
base
```

资源依赖方向：

```text
schema + generated
  ↓
tenant-assets copy
```

需要明确禁止的反向依赖：

```text
base 引用 biz             ❌
schema 写代码路径          ❌
app-shell 写死租户逻辑      ❌
module 直接判断 tenantId   ❌
page 直接判断 appKey       ❌
biz 大量引用 generated     尽量避免
```

尤其要避免这种代码：

```ts
if (tenantId === 'app2') {
  // App2 特殊逻辑
}
```

这种写法短期很快，长期会让整个 schema 架构失效。

租户差异应该通过这些方式表达：

```text
schema 配置
module props
capabilities
runtime config
assets config
store config
```

而不是写死在业务代码里。

---

## 十三、Capabilities 与 Modules 的边界

在多租户架构里，`modules` 和 `capabilities` 很容易混淆。

建议这样区分：

```text
module：
- 页面上看得见的功能块
- 有 UI
- 有顺序
- 有布局位置
- 可以配置 props

capability：
- 业务能力开关
- 不一定有 UI
- 可能被多个页面或模块依赖
- 影响接口、权限、流程、逻辑
```

例如：

```text
module-video-card      → module
module-user-profile    → module
module-order-list      → module

enableVideoReplica     → capability
enablePayment          → capability
enableInvite           → capability
enableAiChat           → capability
```

一个模块可以依赖一个或多个 capability。

例如：

```ts
export const moduleRegistry = {
  'module-video-card': {
    component: '@/biz/modules/module-video-card/index.vue',
    capabilities: ['enableVideoReplica']
  }
}
```

如果 schema 启用了 `module-video-card`，但没有启用 `enableVideoReplica`，编译阶段就应该报错。

---

## 十四、Store 描述与按需引入

Store 也不应该无脑全局注册。

在多租户场景里，不同租户启用的页面和模块不同，所需 store 也不同。

Schema 可以声明当前租户需要的 store：

```json
{
  "store": {
    "modules": ["user", "order", "moduleA"]
  }
}
```

Registry 也可以声明模块依赖的 store：

```ts
export const moduleRegistry = {
  'module-a': {
    component: '@/biz/modules/module-a/index.vue',
    stores: ['moduleA']
  }
}
```

Generator 根据页面和模块依赖生成当前租户的 store 配置：

```ts
import { userStore } from '@/base/store/modules/user'
import { orderStore } from '@/biz/store/order'
import { moduleAStore } from '@/biz/modules/module-a/store'

export const storeModules = {
  user: userStore,
  order: orderStore,
  moduleA: moduleAStore
}
```

这样 App2 没用到的 store，就不会被 generated 引入。

---

## 十五、推荐目录结构

综合来看，可以整理成如下目录：

```text
src/
├── app-shell/
│   ├── App.vue
│   ├── main.ts
│   ├── bootstrap.ts
│   ├── manifest.config.ts
│   └── pages.config.ts
│
├── .generated/
│   ├── tenant.config.ts
│   ├── app.config.ts
│   ├── tabs.config.ts
│   ├── pages.config.ts
│   ├── modules.config.ts
│   ├── capabilities.config.ts
│   ├── store.config.ts
│   ├── assets.config.ts
│   └── sub-packages.config.ts
│
├── base/
│   ├── components/
│   ├── hooks/
│   ├── request/
│   ├── store/
│   ├── utils/
│   ├── constants/
│   ├── jsb/
│   ├── logger/
│   └── monitor/
│
├── biz/
│   ├── pages/
│   ├── modules/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── store/
│
├── registry/
│   ├── page.registry.ts
│   ├── module.registry.ts
│   ├── capability.registry.ts
│   ├── store.registry.ts
│   └── asset.registry.ts
│
└── static/
    └── tenant/
```

项目根目录：

```text
project-root/
├── schemas/
│   ├── app1.schema.json
│   ├── app2.schema.json
│   └── app3.schema.json
│
├── tenant-assets/
│   ├── app1/
│   ├── app2/
│   └── app3/
│
├── scripts/
│   ├── validate-schema.ts
│   ├── generate-code.ts
│   ├── copy-assets.ts
│   ├── build-tenant.ts
│   ├── analyze-size.ts
│   ├── upload-wechat.ts
│   └── release.ts
│
├── src/
├── package.json
├── pages.json
└── manifest.config.ts
```

---

## 十六、最容易踩的坑

### 1. Generated 层被人工修改

Generated 文件必须只由脚本生成。

建议：

```text
1. 文件头加 AUTO GENERATED 注释
2. eslint 禁止人工引用某些内部生成文件
3. CI 中检测 generated 是否由脚本生成
```

---

### 2. Schema 和 Registry 边界不清

错误做法：

```json
{
  "componentPath": "@/biz/modules/module-a/index.vue"
}
```

正确做法：

```json
{
  "type": "module-a"
}
```

组件路径交给 registry 维护。

---

### 3. 全局 utils 变成垃圾桶

不要把所有工具函数都放到：

```text
src/utils/
```

更好的方式是：

```text
页面私有 utils     → 页面目录
模块私有 utils     → 模块目录
分包私有 utils     → 分包 _shared
全局稳定 utils     → base/utils
```

---

### 4. 静态资源全部进包

构建时必须只复制当前租户资源。

否则租户越多，包体积越不可控。

---

### 5. Capability 和 Module 混用

不要用 capability 描述页面上看得见的模块。

也不要用 module 代替业务能力开关。

推荐边界：

```text
module：UI 模块
capability：业务能力
```

---

### 6. 业务代码直接判断租户

不要在业务代码里大量写：

```ts
if (tenantId === 'app2') {}
```

租户差异应该由 schema 和 generated 配置表达。

---

### 7. 分包边界被全局依赖破坏

如果某个分包页面引用了全局 barrel export：

```ts
import { formatOrder, formatVideo, formatChat } from '@/utils'
```

很容易把不需要的依赖带进主包或公共 chunk。

更推荐明确引用：

```ts
import { formatOrder } from './order-format'
```

或者：

```ts
import { formatOrder } from '../_shared/order-format'
```

---

## 十七、最终总结

这套架构的核心不是“把配置写成 JSON”，而是建立一套完整的多租户编译体系。

它的本质是：

```text
schema 负责声明租户差异
registry 负责声明系统能力
generated 负责生成静态胶水代码
app-shell 负责统一启动和配置消费
biz 负责业务实现
base 负责基础能力
tenant-assets 负责租户资源隔离
scripts 负责校验、生成、构建、发布
```

最终链路是：

```text
tenant schema
  ↓
validate / normalize
  ↓
resolve registry
  ↓
generate config & glue code
  ↓
copy tenant assets
  ↓
build uni-app mini program
  ↓
analyze package size
  ↓
upload / audit / release
```

这套模式适合逐步演进成：

> **Schema 驱动的多租户 uni-app 小程序 SaaS 编译平台。**

它相比普通小程序项目最大的优势是：

```text
租户差异可配置
页面模块可编排
构建产物可裁剪
主包分包更可控
静态资源可隔离
发布流程可自动化
业务代码更少硬编码
```

真正落地时，最重要的不是一次性把所有能力都做完，而是先守住几个关键原则：

```text
1. Schema 只描述租户差异，不写工程路径
2. Registry 统一维护系统能力映射
3. Generated 只由脚本生成，不允许人工修改
4. App Shell 只消费 generated 配置，不写死租户
5. Biz 依赖 Base，Base 不反向依赖 Biz
6. 页面、模块、分包私有逻辑就近放置
7. 静态资源按租户复制，产物只保留当前租户资源
8. CI/CD 必须先校验，再生成，再构建，再发布
```

如果这些边界控制得住，这套架构就可以支撑从几个租户扩展到几十个甚至上百个租户，而不会让代码和构建产物失控。
