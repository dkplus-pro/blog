---
title: 'enums 与 constants 职责划分：固定值该怎么放'
date: 2026-05-03
tags: ['前端', 'TypeScript', '架构']
description: '区分业务枚举 enums 与普通配置常量 constants 的适用场景、命名与目录组织'
draft: false
---

`enums` 和 `constants` 都是放“固定值”的，但侧重点不一样。

一句话：

```txt
enums：放“业务状态/类型枚举”
constants：放“普通常量/配置常量”
```

---

## 1. `enums` 放什么？

`enums` 更适合放 **有明确业务含义的一组选项值**。

比如：

```txt
订单状态
用户状态
支付方式
消息类型
登录方式
平台类型
接口状态码
```

示例：

```ts
// enums/order.ts
export enum OrderStatus {
  PendingPay = 1,
  Paid = 2,
  Canceled = 3,
  Refunded = 4
}
```

使用：

```ts
if (order.status === OrderStatus.Paid) {
  console.log('订单已支付')
}
```

它的作用是避免魔法值：

```ts
if (order.status === 2) {
  // 2 是什么？
}
```

改成：

```ts
if (order.status === OrderStatus.Paid) {
  // 一眼知道是已支付
}
```

---

## 2. `constants` 放什么？

`constants` 更适合放 **不会变的普通配置值**。

比如：

```txt
应用名称
默认头像
客服电话
分页默认值
缓存 key
路由路径
接口超时时间
默认分页大小
CDN 地址
协议地址
业务固定配置
```

示例：

```ts
// constants/app.ts
export const APP_NAME = '周子AI'

export const DEFAULT_AVATAR = '/static/images/default-avatar.png'

export const CUSTOMER_SERVICE_URL = 'https://xxx.com'
```

分页常量：

```ts
// constants/page.ts
export const DEFAULT_PAGE_NUM = 1

export const DEFAULT_PAGE_SIZE = 10
```

路由常量：

```ts
// constants/route.ts
export const ROUTES = {
  HOME: '/pages/index/index',
  LOGIN: '/pages/login/index',
  MINE: '/pages/mine/index',
  CHAT: '/subpackages/chat/pages/index/index'
} as const
```

---

## 3. 对比表

| 对比        | `enums`            | `constants`         |
| --------- | ------------------ | ------------------- |
| 主要作用      | 表达业务枚举             | 表达普通常量              |
| 典型内容      | 状态、类型、模式           | 配置、路径、默认值           |
| 是否是一组业务选项 | 是                  | 不一定                 |
| 示例        | `OrderStatus.Paid` | `DEFAULT_PAGE_SIZE` |
| 关注点       | “有哪些状态/类型”         | “某个固定值是多少”          |

---

## 4. 实际例子：订单模块

### `enums/order.ts`

```ts
export enum OrderStatus {
  PendingPay = 1,
  Paid = 2,
  Canceled = 3,
  Refunded = 4
}

export const OrderStatusTextMap: Record<OrderStatus, string> = {
  [OrderStatus.PendingPay]: '待支付',
  [OrderStatus.Paid]: '已支付',
  [OrderStatus.Canceled]: '已取消',
  [OrderStatus.Refunded]: '已退款'
}
```

这里属于 `enums`，因为它描述的是订单状态有哪些。

---

### `constants/order.ts`

```ts
export const ORDER_PAGE_SIZE = 10

export const ORDER_AUTO_CANCEL_MINUTES = 15

export const ORDER_DETAIL_REFRESH_INTERVAL = 3000
```

这里属于 `constants`，因为它们是订单模块里的固定配置。

---

## 5. 实际例子：缓存 key 放哪？

这个看团队习惯。

如果你把缓存 key 当成一组固定 key 管理，可以放 `constants`：

```ts
// constants/storage.ts
export const STORAGE_KEYS = {
  TOKEN: 'TOKEN',
  USER_INFO: 'USER_INFO',
  SETTINGS: 'SETTINGS'
} as const
```

也可以放 `enums`：

```ts
// enums/storage.ts
export enum StorageKey {
  Token = 'TOKEN',
  UserInfo = 'USER_INFO',
  Settings = 'SETTINGS'
}
```

我更建议放 `constants/storage.ts`，因为缓存 key 本质更像配置常量，不是业务状态枚举。

---

## 6. 实际例子：请求状态码放哪？

可以放 `enums`：

```ts
// enums/request.ts
export enum HttpStatus {
  Success = 200,
  Unauthorized = 401,
  Forbidden = 403,
  ServerError = 500
}
```

因为状态码是一组固定状态，放 `enums` 更合适。

---

## 7. 我的建议

你的 uniapp 项目可以这样分：

```txt
src/enums
├─ user.ts        用户状态、登录方式
├─ order.ts       订单状态、支付状态
├─ chat.ts        消息类型、角色类型
├─ request.ts     请求状态码、业务 code
└─ platform.ts    平台类型

src/constants
├─ app.ts         应用名称、客服电话、默认头像
├─ route.ts       页面路径
├─ storage.ts     缓存 key
├─ page.ts        默认分页参数
├─ config.ts      默认配置
└─ regexp.ts      正则表达式
```

---

## 8. 判断标准

你可以这样判断：

```txt
这是“业务状态/类型”吗？
是 → 放 enums

这是“普通固定配置/默认值/路径/key”吗？
是 → 放 constants
```

比如：

```txt
OrderStatus       → enums
UserStatus        → enums
MessageType       → enums
PaymentType       → enums

APP_NAME          → constants
DEFAULT_PAGE_SIZE → constants
ROUTES            → constants
STORAGE_KEYS      → constants
REGEXP_PHONE      → constants
```

一句话总结：

**`enums` 管“这个业务值有哪些类型/状态”，`constants` 管“项目里固定不变的配置值”。**
