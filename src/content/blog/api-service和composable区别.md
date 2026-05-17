---
title: 'api、service和composable区别'
date: 2026-05-13
tags: ['前端', '后端']
description: 'service：负责“串业务流程”'
draft: false
---

可以按**层级从低到高**理解：

```txt
api：负责“调接口”
service：负责“串业务流程”
composable：负责“给页面复用一段响应式逻辑”
```

在 uniapp + Vue3 + TS 项目里，我一般这么分。

---

## 1. `api`：接口层

`api` 只负责和后端接口对应。

比如后端有：

```txt
POST /login
GET /user/info
GET /order/list
POST /chat/send
```

那你就写：

```ts
// api/user.ts
import { request } from '@/services/request'

export function loginApi(data: LoginParams) {
  return request<LoginResult>({
    url: '/login',
    method: 'POST',
    data
  })
}

export function getUserInfoApi() {
  return request<UserInfo>({
    url: '/user/info',
    method: 'GET'
  })
}
```

`api` 层不要写太多业务逻辑。

它主要做：

```txt
封装接口地址
封装请求方法
定义入参类型
定义返回类型
返回接口结果
```

不要在 `api` 里做这些：

```txt
不要跳转页面
不要操作 Pinia
不要处理复杂业务流程
不要直接 showToast 一堆业务提示
```

一句话：

**api = 后端接口的前端映射。**

---

## 2. `service`：业务服务层

`service` 负责把多个动作串起来，形成一个完整业务流程。

比如“登录”不是单纯调 `/login`，它可能包括：

```txt
1. 调登录接口
2. 保存 token
3. 拉用户信息
4. 存 Pinia
5. 初始化配置
6. 返回页面需要的数据
```

这就应该放 `service`。

```ts
// services/auth.ts
import { loginApi, getUserInfoApi } from '@/api/user'
import { useUserStore } from '@/stores/modules/user'
import { useSettingsStore } from '@/stores/modules/settings'

export async function loginService(params: LoginParams) {
  const userStore = useUserStore()
  const settingsStore = useSettingsStore()

  const loginResult = await loginApi(params)

  userStore.setToken(loginResult.token)

  const userInfo = await getUserInfoApi()
  userStore.setUserInfo(userInfo)

  await settingsStore.loadSettings()

  return userInfo
}
```

页面里就很简单：

```ts
await loginService(form.value)

uni.switchTab({
  url: '/pages/index/index'
})
```

`service` 适合放：

```txt
登录流程
退出流程
支付流程
上传流程
下单流程
发送消息流程
初始化应用流程
刷新用户信息流程
```

一句话：

**service = 业务动作的组织者。**

---

## 3. `composable`：页面逻辑复用层

`composable` 是 Vue3 里的组合式函数，一般叫 `useXxx`。

它主要解决：

```txt
多个页面/组件都需要同一套响应式逻辑
```

比如列表分页。

```ts
// composables/usePageList.ts
import { ref } from 'vue'

export function usePageList<T>(fetcher: (params: { pageNum: number; pageSize: number }) => Promise<{ list: T[]; total: number }>) {
  const list = ref<T[]>([])
  const pageNum = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const loading = ref(false)
  const finished = ref(false)

  async function loadData(reset = false) {
    if (loading.value) return

    loading.value = true

    if (reset) {
      pageNum.value = 1
      list.value = []
      finished.value = false
    }

    try {
      const res = await fetcher({
        pageNum: pageNum.value,
        pageSize: pageSize.value
      })

      list.value.push(...res.list)
      total.value = res.total

      if (list.value.length >= total.value) {
        finished.value = true
      } else {
        pageNum.value++
      }
    } finally {
      loading.value = false
    }
  }

  return {
    list,
    pageNum,
    pageSize,
    total,
    loading,
    finished,
    loadData
  }
}
```

页面里用：

```ts
const {
  list,
  loading,
  finished,
  loadData
} = usePageList(getOrderListApi)
```

`composable` 适合放：

```txt
分页列表
上传选择逻辑
登录弹窗控制
倒计时
表单校验
权限判断
页面滚动
下拉刷新
录音逻辑
输入框键盘处理
```

一句话：

**composable = 可复用的页面/组件状态逻辑。**

---

## 4. 三者关系

可以理解成这样：

```txt
页面 / 组件
   ↓
composable
   ↓
service
   ↓
api
   ↓
request
   ↓
后端接口
```

但不是每次都必须全部经过。

### 简单页面可以直接调 `api`

比如只是获取一个 banner：

```ts
const banners = await getBannerListApi()
```

这种没必要专门写 service。

---

### 复杂流程用 `service`

比如登录：

```ts
await loginService(form.value)
```

不要在页面里连续写一堆：

```ts
const loginResult = await loginApi()
userStore.setToken()
const userInfo = await getUserInfoApi()
userStore.setUserInfo()
await settingsStore.loadSettings()
```

否则页面会越来越脏。

---

### 复用页面状态用 `composable`

比如多个页面都需要分页：

```ts
const pageList = usePageList(getOrderListApi)
```

不要每个页面都复制一遍分页逻辑。

---

## 5. 一个实际例子：订单列表

### `api/order.ts`

只调接口：

```ts
export function getOrderListApi(params: OrderListParams) {
  return request<PageResult<OrderItem>>({
    url: '/order/list',
    method: 'GET',
    data: params
  })
}
```

### `service/order.ts`

处理业务规则：

```ts
export async function getOrderListService(params: OrderListParams) {
  const res = await getOrderListApi(params)

  return {
    ...res,
    list: res.list.map(item => ({
      ...item,
      statusText: getOrderStatusText(item.status)
    }))
  }
}
```

### `composables/useOrderList.ts`

处理页面复用状态：

```ts
export function useOrderList() {
  const keyword = ref('')
  const status = ref<number | undefined>()

  const pageList = usePageList((params) => {
    return getOrderListService({
      ...params,
      keyword: keyword.value,
      status: status.value
    })
  })

  function search() {
    pageList.loadData(true)
  }

  return {
    keyword,
    status,
    ...pageList,
    search
  }
}
```

### 页面

```ts
const {
  list,
  keyword,
  status,
  loading,
  finished,
  loadData,
  search
} = useOrderList()
```

页面只负责展示和交互。

---

## 6. 对比表

| 层            | 主要职责    | 示例                           | 是否操作后端     | 是否操作状态             |
| ------------ | ------- | ---------------------------- | ---------- | ------------------ |
| `api`        | 调接口     | `loginApi`、`getUserInfoApi`  | 是          | 尽量不操作              |
| `service`    | 组织业务流程  | `loginService`、`payService`  | 间接操作       | 可以操作 store         |
| `composable` | 复用响应式逻辑 | `usePageList`、`useUpload`    | 可间接操作      | 可以有 `ref/reactive` |
| `store`      | 全局状态    | `userStore`、`settingsStore`  | 不建议直接调太多接口 | 是                  |
| `utils`      | 纯工具函数   | `formatDate`、`validatePhone` | 否          | 否                  |

---

## 7. 我的使用规则

我会定成这样：

```txt
1. 后端接口函数，放 api
2. 多个接口组合成一个业务动作，放 service
3. 页面/组件可复用的响应式逻辑，放 composable
4. 全局共享数据，放 store
5. 纯函数工具，放 utils
```

再简单一点：

```txt
api：我去请求什么接口
service：我要完成什么业务
composable：页面怎么复用这套逻辑
```

比如登录：

```txt
api/loginApi              调登录接口
service/loginService      完整登录流程
composable/useLogin       登录页表单、loading、错误提示、提交方法
store/userStore           保存 token 和 userInfo
```

这几个各干各的，项目就不会乱。
