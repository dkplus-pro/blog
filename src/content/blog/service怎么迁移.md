---
title: '前端 services 层迁移指南：从接口层到业务流程层'
date: 2026-05-19
tags: ['前端', 'Vue', '架构', 'TypeScript', 'uni-app']
description: '如何将现有 services 逐步拆分为 api 接口层与真正的 services 业务流程层，含目录与迁移步骤'
draft: false
---

可以做，而且我建议你**把现在的 `services` 逐步改名成 `api`，再重新建立真正的 `services`**。

你现在的问题本质是：

```txt
当前 services = 后端接口层
你想新增 services = 业务流程层
```

所以最终应该变成：

```txt
页面 / composables
   ↓
services        # 业务流程层
   ↓
api             # 接口层
   ↓
request         # 请求封装
   ↓
后端
```

---

## 一、最终推荐目录

建议改成这样：

```txt
src
├─ api                         # 接口层，原来的 services 迁移到这里
│  ├─ auth.ts
│  ├─ user.ts
│  ├─ order.ts
│  ├─ chat.ts
│  └─ settings.ts
│
├─ services                    # 真正的业务服务层
│  ├─ auth.ts
│  ├─ user.ts
│  ├─ order.ts
│  ├─ chat.ts
│  └─ app.ts
│
├─ request                     # 请求底层封装
│  ├─ index.ts
│  ├─ type.ts
│  └─ interceptor.ts
│
├─ composables                 # 页面复用逻辑
│  ├─ useLogin.ts
│  ├─ usePageList.ts
│  └─ useUpload.ts
│
├─ stores
│  └─ modules
│     ├─ user.ts
│     ├─ app.ts
│     └─ settings.ts
```

也就是：

```txt
api：只调接口
services：串业务流程
request：封装 uni.request
```

---

## 二、第一步：把现在的 services 当 api 迁移

假设你现在有：

```txt
src/services
├─ user.ts
├─ auth.ts
├─ chat.ts
└─ settings.ts
```

里面是这种代码：

```ts
// services/user.ts
export function getUserInfo() {
  return request({
    url: '/user/info',
    method: 'GET'
  })
}
```

那它其实应该改到：

```txt
src/api/user.ts
```

然后函数命名建议加 `Api` 后缀：

```ts
// api/user.ts
import { request } from '@/request'

export function getUserInfoApi() {
  return request<UserInfo>({
    url: '/user/info',
    method: 'GET'
  })
}

export function updateUserInfoApi(data: UpdateUserInfoParams) {
  return request({
    url: '/user/update',
    method: 'POST',
    data
  })
}
```

这样以后别人一看就知道：

```txt
xxxApi = 调后端接口
```

---

## 三、第二步：新建真正的 services

真正的 `services` 不应该只是调一个接口，而是负责完整业务动作。

比如登录流程：

```txt
调用登录接口
↓
保存 token
↓
拉用户信息
↓
写入 userStore
↓
加载全局配置
↓
返回页面需要的数据
```

这就放到：

```txt
src/services/auth.ts
```

示例：

```ts
// services/auth.ts
import { loginApi, getUserInfoApi } from '@/api/auth'
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

export function logoutService() {
  const userStore = useUserStore()

  userStore.logout()

  uni.reLaunch({
    url: '/pages/login/index'
  })
}
```

这个才是真正的 service。

---

## 四、第三步：request 单独拿出来

如果你现在的请求封装也在 `services/request.ts`，建议迁出来。

从：

```txt
src/services/request.ts
```

改成：

```txt
src/request/index.ts
```

例如：

```ts
// request/index.ts
import { useUserStore } from '@/stores/modules/user'

export function request<T = unknown>(options: RequestOptions): Promise<T> {
  const userStore = useUserStore()

  return new Promise((resolve, reject) => {
    uni.request({
      url: import.meta.env.VITE_BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        Authorization: userStore.token ? `Bearer ${userStore.token}` : '',
        ...options.header
      },
      success(res) {
        const result = res.data as ApiResponse<T>

        if (result.code === 200) {
          resolve(result.data)
          return
        }

        if (result.code === 401) {
          userStore.logout()
          uni.navigateTo({
            url: '/pages/login/index'
          })
        }

        reject(result)
      },
      fail: reject
    })
  })
}
```

这样职责更清楚：

```txt
request：底层请求能力
api：某个接口怎么调
services：业务流程怎么完成
```

---

## 五、页面应该怎么调用？

简单页面可以直接调 `api`。

比如只是获取 banner：

```ts
import { getBannerListApi } from '@/api/home'

const banners = await getBannerListApi()
```

复杂流程调用 `service`。

比如登录：

```ts
import { loginService } from '@/services/auth'

await loginService(form.value)
```

如果页面还需要 loading、表单、错误提示，可以再包一层 `composable`：

```ts
// composables/useLogin.ts
import { ref } from 'vue'
import { loginService } from '@/services/auth'

export function useLogin() {
  const loading = ref(false)
  const phone = ref('')
  const code = ref('')

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

页面里：

```ts
const { phone, code, loading, submit } = useLogin()
```

---

## 六、命名规范建议

为了避免以后又混乱，我建议直接定死命名。

### `api` 里的函数

统一加 `Api` 后缀：

```ts
loginApi()
getUserInfoApi()
getOrderListApi()
sendMessageApi()
getSettingsApi()
```

### `services` 里的函数

统一加 `Service` 后缀：

```ts
loginService()
logoutService()
refreshUserInfoService()
createOrderService()
sendChatMessageService()
initAppService()
```

### `composables` 里的函数

统一 `useXxx`：

```ts
useLogin()
usePageList()
useUpload()
useChat()
useAuth()
```

这样从名字就能看出层级。

---

## 七、迁移不要一次性全改

推荐分三步迁移。

### 第一步：先创建 `api` 目录

把新的接口都写到 `src/api`。

旧的 `src/services` 先不动。

```txt
src/api      # 新接口放这里
src/services # 旧接口暂时保留
```

---

### 第二步：按模块迁移旧 services

比如先迁移 user：

```txt
src/services/user.ts  →  src/api/user.ts
```

同时把引用改掉：

```ts
// 原来
import { getUserInfo } from '@/services/user'

// 改成
import { getUserInfoApi } from '@/api/user'
```

一个模块一个模块迁移，不要一口气全改。

---

### 第三步：等旧 services 清空后，重新启用 services

当旧的接口函数都迁到 `api` 后，`services` 就只放真正业务流程。

```txt
src/services/auth.ts
src/services/order.ts
src/services/chat.ts
```

---

## 八、你可以直接定这个团队规则

```txt
1. api 目录只允许写接口函数。
2. api 函数统一以 Api 结尾。
3. api 里不能操作页面跳转，不能直接改 store。
4. services 目录只允许写业务流程。
5. services 可以调用 api、store、storage、router。
6. 页面简单请求可以直接调用 api。
7. 页面复杂业务必须调用 service。
8. composables 只负责页面可复用状态逻辑。
```

---

## 九、最推荐的分层示例

以登录为例：

```txt
api/auth.ts
  loginApi()
  getUserInfoApi()

services/auth.ts
  loginService()
  logoutService()

composables/useLogin.ts
  phone
  code
  loading
  submit()

stores/modules/user.ts
  token
  userInfo
  setToken()
  setUserInfo()

pages/login/index.vue
  只负责页面展示
```

这样职责就非常清楚。

---

## 最终结论

你现在应该做的是：

```txt
把现有 services 迁移为 api
重新建立 services 作为业务服务层
request 独立出来
通过命名后缀区分 Api 和 Service
按模块逐步迁移，不要一次性大改
```

最核心一句话：

```txt
api 负责“这个接口怎么调”，services 负责“这个业务怎么完成”。
```
