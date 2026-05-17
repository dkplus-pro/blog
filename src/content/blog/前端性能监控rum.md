---
title: '前端性能监控RUM'
date: 2026-05-13
tags: ['前端', '后端', '运维', '工程化', '性能优化', '全栈']
description: '可以，用腾讯云的话，对标 Sentry 的产品主要是：'
draft: false
---

可以，用腾讯云的话，对标 Sentry 的产品主要是：

```txt
腾讯云前端性能监控 RUM
```

它的 SDK 以前/内部常叫 **Aegis**，小程序端用：

```bash
aegis-mp-sdk
```

它能覆盖你要的这些能力：

| 你的需求                 | 腾讯云对应能力                  |
| -------------------- | ------------------------ |
| 前端初始化错误监控            | RUM SDK / Aegis SDK      |
| JS 错误率               | RUM 错误监控、异常分析            |
| 数据看板                 | 数据总览、日志查询、异常分析           |
| 手动 `reportError` 上报  | 封装 `aegis.error()`       |
| 接口错误 / 接口耗时          | `reportApiSpeed: true`   |
| 静态资源测速               | `reportAssetSpeed: true` |
| SourceMap 还原代码       | RUM SourceMap 上传         |
| CI/CD 自动上传 SourceMap | GitLab CI 调腾讯云 API 上传    |

腾讯云 RUM 官方定义就是面向 Web 和小程序的一站式前端监控方案，关注页面测速、接口测速、CDN 测速、JS 错误、Ajax 错误等，并且支持 SourceMap 还原线上报错位置。([腾讯云][1])

---

## 1. 控制台先开 RUM 应用

大概流程：

```txt
腾讯云控制台
前端性能监控 RUM
创建业务系统
创建应用
选择小程序
拿到上报 key，也就是 SDK 里的 id
```

腾讯云小程序接入文档里说明，小程序端需要安装 `aegis-mp-sdk`，然后用 RUM 申请的上报 key 初始化 SDK；正式环境还要把上报域名加到小程序安全域名中。([腾讯云][2])

---

## 2. uni-app 小程序安装 SDK

在 monorepo 根目录装到对应 app，或者 workspace 根装都可以。

比如只给 `mp-a` 装：

```bash
pnpm --filter mp-a add aegis-mp-sdk
```

或者如果你们公共监控封装放在 `packages/monitor`：

```bash
pnpm --filter @ai-mind-clone/monitor add aegis-mp-sdk
```

---

## 3. 封装一个监控模块

建议不要在业务代码里直接到处写 `aegis.error()`，而是封装成你自己的：

```txt
initMonitor()
reportError()
reportEvent()
setUser()
```

例如：

```ts
// src/utils/monitor.ts
import Aegis from 'aegis-mp-sdk'

type ReportErrorOptions = {
  msg?: string
  error?: unknown
  scene?: string
  page?: string
  traceId?: string
  extra?: Record<string, unknown>
}

let aegis: any = null

export function initMonitor(options?: { uin?: string }) {
  if (aegis) return aegis

  aegis = new Aegis({
    id: import.meta.env.VITE_RUM_ID,
    uin: options?.uin,
    reportApiSpeed: true,
    reportAssetSpeed: true,
    spa: true,
    hostUrl: 'https://rumt-zh.com'
  })

  return aegis
}

export function setMonitorUser(uin: string) {
  if (!aegis) return

  aegis.setConfig({
    uin
  })
}

export function reportError(options: ReportErrorOptions | unknown) {
  if (!aegis) return

  if (options instanceof Error) {
    aegis.error(options)
    return
  }

  const payload = options as ReportErrorOptions

  const msg =
    payload?.msg ||
    (payload?.error instanceof Error ? payload.error.message : 'unknown error')

  aegis.error({
    msg,
    ext1: payload?.scene || '',
    ext2: payload?.page || '',
    ext3: payload?.traceId || '',
    trace: payload?.traceId || '',
    extra: JSON.stringify(payload?.extra || {})
  })
}

export function reportEvent(name: string, extra?: Record<string, unknown>) {
  if (!aegis) return

  aegis.reportEvent({
    name,
    ext1: extra ? JSON.stringify(extra) : ''
  })
}
```

腾讯云 RUM 的实例方法里，`aegis.error()` 就是用于主动上报 JS 错误日志，并且支持直接传 `new Error()`；`reportEvent()` 可以上报自定义事件。([腾讯云][3])

---

## 4. 在 uni-app 入口尽早初始化

比如 `main.ts`：

```ts
import { createSSRApp } from 'vue'
import App from './App.vue'
import { initMonitor } from './utils/monitor'

initMonitor()

export function createApp() {
  const app = createSSRApp(App)
  return {
    app
  }
}
```

腾讯云文档特别提醒：为了不遗漏数据，SDK 要尽早初始化；如果你用了封装 `wx.request` 的库，需要在这些库之前初始化，因为 SDK 会通过重写 `wx.request` 采集接口监控。([腾讯云][2])

---

## 5. 手动上报错误怎么用

业务代码里：

```ts
import { reportError } from '@/utils/monitor'

try {
  await submitForm()
} catch (error) {
  reportError({
    msg: '提交表单失败',
    error,
    scene: 'submit_form',
    page: 'pages/order/index',
    extra: {
      orderId: currentOrderId
    }
  })
}
```

或者简单点：

```ts
reportError(new Error('主动上报一个错误'))
```

这就相当于你说的 `reportError`。

---

## 6. 小程序安全域名要加

腾讯云小程序 SDK 默认上报域名是：

```txt
https://aegis.qq.com
```

你也可以通过 `hostUrl` 改成：

```txt
https://rumt-zh.com
```

正式环境需要把实际上报域名加入微信小程序后台的合法请求域名。腾讯云文档也明确说，开发者需要根据 network 里 Aegis SDK 上报接口实际使用的域名判断要添加哪个安全域名。([腾讯云][2])

---

## 7. 数据看板能看到什么

接入后，你主要看这几个页面：

```txt
数据总览
日志查询
异常分析
告警管理
```

腾讯云小程序优化文档里提到，RUM 默认会全量上报错误异常，可以通过日志查询分钟级定位异常；JS / Ajax 问题可以通过异常分析查看，并支持按网络类型、地域、机型等维度分析。([腾讯云][4])

所以你要的：

```txt
JS 错误率
Ajax 错误
资源错误
页面访问
性能数据
异常分布
```

RUM 控制台基本都有。

---

## 8. SourceMap 怎么做

SourceMap 这块要注意两件事：

```txt
1. 构建时生成 SourceMap
2. CI/CD 上传 SourceMap 到腾讯云 RUM
```

腾讯云 RUM 支持通过 API 自动上传 SourceMap，官方示例是：用 `tencentcloud-sdk-nodejs` 调 RUM API 获取上传签名，再用 `cos-nodejs-sdk-v5` 上传文件到固定桶，最后调用 `CreateReleaseFile` 绑定版本和 SourceMap 文件。([腾讯云][5])

### 安装上传脚本依赖

```bash
pnpm add -Dw tencentcloud-sdk-nodejs cos-nodejs-sdk-v5 fast-glob
```

### GitLab Variables 配置

在 GitLab 里放：

```txt
TENCENT_SECRET_ID
TENCENT_SECRET_KEY
RUM_PROJECT_ID
RUM_VERSION
```

其中：

```txt
RUM_PROJECT_ID 是 RUM 的数字项目 ID，不是 SDK 里的上报 key
RUM_VERSION 建议用 CI_COMMIT_SHORT_SHA 或正式版本号
```

腾讯云官方 SourceMap 示例里也特别标注：`projectID` 是 RUM 的项目数字 ID，不是上报 key；`version` 是线上 JS 对应的版本。([腾讯云][5])

---

## 9. GitLab CI 示例

```yaml
stages:
  - build
  - upload_sourcemap

variables:
  MP_DIST_DIR: "apps/mp-a/unpackage/dist/build/mp-weixin"
  RUM_VERSION: "$CI_COMMIT_SHORT_SHA"

build_mp:
  stage: build
  image: node:20
  script:
    - corepack enable
    - corepack prepare pnpm@9.15.0 --activate
    - pnpm install --frozen-lockfile
    - pnpm --filter mp-a build:mp-weixin
  artifacts:
    paths:
      - apps/mp-a/unpackage/dist/build/mp-weixin
    expire_in: 7 days

upload_rum_sourcemap:
  stage: upload_sourcemap
  image: node:20
  needs:
    - job: build_mp
      artifacts: true
  script:
    - node scripts/upload-rum-sourcemap.mjs "$MP_DIST_DIR" "$RUM_VERSION"
  rules:
    - if: '$CI_COMMIT_BRANCH =~ /^(release|hotfix|main|master)\/?.*$/'
```

---

## 10. 上传 SourceMap 脚本骨架

```js
// scripts/upload-rum-sourcemap.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import fg from 'fast-glob'
import tencentcloud from 'tencentcloud-sdk-nodejs'
import COS from 'cos-nodejs-sdk-v5'

const distDir = process.argv[2]
const version = process.argv[3]

if (!distDir || !version) {
  console.error('Usage: node scripts/upload-rum-sourcemap.mjs <distDir> <version>')
  process.exit(1)
}

const {
  TENCENT_SECRET_ID,
  TENCENT_SECRET_KEY,
  RUM_PROJECT_ID
} = process.env

if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY || !RUM_PROJECT_ID) {
  console.error('Missing env: TENCENT_SECRET_ID / TENCENT_SECRET_KEY / RUM_PROJECT_ID')
  process.exit(1)
}

const RumClient = tencentcloud.rum.v20210622.Client

const client = new RumClient({
  credential: {
    secretId: TENCENT_SECRET_ID,
    secretKey: TENCENT_SECRET_KEY
  },
  region: '',
  profile: {
    httpProfile: {
      endpoint: 'rum.tencentcloudapi.com'
    }
  }
})

const cos = new COS({
  getAuthorization: async (_options, callback) => {
    const data = await client.DescribeReleaseFileSign({})
    callback({
      TmpSecretId: data.SecretID,
      TmpSecretKey: data.SecretKey,
      SecurityToken: data.SessionToken,
      ExpiredTime: data.ExpiredTime
    })
  }
})

const mapFiles = await fg('**/*.map', {
  cwd: distDir,
  absolute: true,
  onlyFiles: true
})

if (mapFiles.length === 0) {
  console.log('No sourcemap files found')
  process.exit(0)
}

const projectID = Number(RUM_PROJECT_ID)
const files = []

for (const file of mapFiles) {
  const content = fs.readFileSync(file)
  const fileName = path.relative(distDir, file).replaceAll(path.sep, '/')
  const fileHash = crypto.createHash('md5').update(content.toString()).digest('hex')
  const timestamp = Date.now()
  const fileKey = `${projectID}-${version}-${timestamp}-${path.basename(fileName)}`

  await cos.putObject({
    Bucket: 'rumprod-1258344699',
    Region: 'ap-guangzhou',
    Key: fileKey,
    Body: content.toString()
  })

  files.push({
    Version: version,
    FileKey: fileKey,
    FileName: fileName,
    FileHash: fileHash
  })

  console.log(`Uploaded sourcemap: ${fileName}`)
}

await client.CreateReleaseFile({
  ProjectID: projectID,
  Files: files
})

console.log(`RUM sourcemap upload success, version=${version}, files=${files.length}`)
```

这个脚本是按腾讯云官方上传流程改的：先 `DescribeReleaseFileSign` 获取临时密钥，再上传到固定 COS 桶 `rumprod-1258344699`，最后 `CreateReleaseFile` 注册 SourceMap。([腾讯云][5])

---

## 11. 版本号一定要统一

这一点很关键。

你 SDK 初始化、构建产物、SourceMap 上传，最好都用同一个版本：

```txt
RUM_VERSION = CI_COMMIT_SHORT_SHA
```

例如：

```ts
const aegis = new Aegis({
  id: import.meta.env.VITE_RUM_ID,
  version: import.meta.env.VITE_APP_VERSION,
  reportApiSpeed: true,
  reportAssetSpeed: true,
  spa: true,
  hostUrl: 'https://rumt-zh.com'
})
```

然后 GitLab：

```yaml
variables:
  VITE_APP_VERSION: "$CI_COMMIT_SHORT_SHA"
  RUM_VERSION: "$CI_COMMIT_SHORT_SHA"
```

这样线上错误和上传的 SourceMap 才能匹配。

---

## 12. 我建议你们的最终方案

你们可以这样搭：

```txt
腾讯云 RUM：
  负责错误采集、性能指标、日志查询、异常分析、告警

前端项目：
  packages/monitor 封装 initMonitor / reportError / reportEvent

GitLab CI：
  build 小程序
  上传静态资源到 TOS/COS
  上传 SourceMap 到腾讯云 RUM
  删除产物里的 .map 文件，避免泄露源码
  通知飞书
```

构建后记得：

```bash
find apps/mp-a/unpackage/dist/build/mp-weixin -name "*.map" -delete
```

SourceMap 只上传到 RUM，不要跟小程序产物一起发布出去。

---

## 一句话结论

用腾讯云替代 Sentry，最直接就是：

```txt
腾讯云 RUM + aegis-mp-sdk + GitLab CI 上传 SourceMap
```

你前端代码里封装：

```ts
reportError()
```

底层调用：

```ts
aegis.error()
```

就能实现基础的错误监控、错误率看板、手动上报、SourceMap 还原和告警能力。

[1]: https://cloud.tencent.com/document/product/1464/59467 "前端性能监控 简介_腾讯云"
[2]: https://cloud.tencent.com/document/product/1464/58566 "前端性能监控 安装和初始化_腾讯云"
[3]: https://cloud.tencent.com/document/product/1464/58563 "前端性能监控 实例方法_腾讯云"
[4]: https://cloud.tencent.com/document/practice/1464/73128 "前端性能监控 如何优化小程序用户体验_腾讯云"
[5]: https://cloud.tencent.com/document/practice/1464/97715 "前端性能监控 RUM 自动上传 sourcemap 文件_腾讯云"
