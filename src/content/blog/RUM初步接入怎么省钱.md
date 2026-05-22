---
title: '腾讯云 RUM 接入省钱指南：上报量估算与开关配置'
date: 2026-05-08
tags: ['前端', '监控', '腾讯云', 'RUM', 'DevOps']
description: '按 PV × 单次上报条数估算免费额度，梳理接口/资源测速等烧钱项，给出 MVP 阶段最省钱的 aegis 配置'
draft: false
---

会不会超，**不是看 UV，而是看“每个 PV 平均产生多少条上报”**。

腾讯 RUM 计费口径是：存储一条数据算一次上报，包括 **PV、API 统计次数、静态资源统计次数、错误日志次数、自定义上报次数**；单个主账号每天共享 **50 万条免费上报额度**，超出部分计费。官方预估公式也是：`PV + API 统计次数 + 静态资源统计次数 + 错误日志次数 + 自定义上报次数 - 50万`。([腾讯云][1])

## 1. 大概多少 PV 会超？

用这个公式估：

```text
每日上报量 = PV × 单次页面平均上报条数
```

常见情况：

| 监控配置             | 每 PV 估算上报 | 约多少 PV/天会超过 50 万 |
| ---------------- | --------: | ---------------: |
| 只开 PV + 错误       |   1 ~ 2 条 |   25 万 ~ 50 万 PV |
| PV + 页面性能 + 少量接口 |   3 ~ 5 条 |   10 万 ~ 16 万 PV |
| PV + 接口测速 + 资源测速 |  8 ~ 15 条 | 3.3 万 ~ 6.2 万 PV |
| 页面资源很多、接口很多      |     20+ 条 |  2.5 万 PV 以下也可能超 |

所以结论是：

```text
如果你只做错误监控：50 万额度很耐用。
如果你打开接口测速、资源测速、页面性能、自定义日志：几万 PV 就可能超。
```

UV 只是辅助指标。比如：

```text
1 万 UV × 人均 5 PV × 每 PV 10 条上报 = 50 万条
```

这就刚好打满免费额度。

---

## 2. 最容易烧钱的是哪些？

优先级从高到低：

```text
1. 接口测速 reportApiSpeed
2. 静态资源测速 reportAssetSpeed
3. 页面性能 pagePerformance / webVitals
4. 自定义日志 info / infoAll / reportEvent
5. PV
6. 错误日志 onError
```

真正应该保留的是 **错误监控**，因为它的量通常不大，但排查价值最高。

---

## 3. 想省钱，建议关哪些？

### 第一优先：关闭静态资源测速

```ts
reportAssetSpeed: false
```

静态资源测速最容易膨胀，特别是页面里有很多图片、icon、字体、视频封面、CDN 资源时。腾讯配置文档里 `reportAssetSpeed` 就是静态资源测速开关，默认 false。([腾讯云][2])

MVP 阶段建议直接关。

---

### 第二优先：接口测速不要全开

如果你打开：

```ts
reportApiSpeed: true
```

每个接口都可能产生统计。小程序里一个页面如果请求 5 个接口，PV 一多，上报量会很快上去。

建议 MVP 阶段：

```ts
reportApiSpeed: false
```

或者只在灰度/排查时打开。

如果确实要开，要配 `urlHandler` 把 RESTful URL 聚合，比如 `/user/123` 聚合成 `/user/:id`，官方文档也提供了 `reportApiSpeed.urlHandler` 的用法。([腾讯云][2])

---

### 第三优先：不要开全量请求日志

这个一定小心：

```ts
api: {
  reportRequest: true
}
```

不建议开。

官方配置说明里 `reportRequest` 默认是 `false`，开启后 `aegis.info` 会变成全量上报，并且会上报所有接口信息，还要求开启 `reportApiSpeed`。([腾讯云][2])

MVP 建议保持：

```ts
api: {
  reportRequest: false,
  apiDetail: false
}
```

`apiDetail` 也不要开，它会上报失败 API 的请求参数和返回值，除了量的问题，还有隐私风险。官方文档也说明 `apiDetail` 默认 false，用于 API 失败时上报请求参数和返回值。([腾讯云][2])

---

### 第四优先：不要开 console 日志和点击日志

这些也不要开：

```ts
consoleLog: false,
clickElementLog: false
```

官方配置里这两个默认也是 false，分别表示是否上报 console 日志、点击事件日志。([腾讯云][2])

点击日志非常容易爆量，不适合 MVP。

---

### 第五优先：自定义日志要节制

少用：

```ts
aegis.infoAll()
aegis.reportEvent()
```

建议只在关键异常、关键链路失败时上报，例如：

```text
登录失败
支付失败
AI任务创建失败
AI任务轮询失败
视频播放失败
```

不要在这些地方上报：

```text
进入页面
点击按钮
接口成功
普通列表加载成功
普通组件 mounted
```

这些会把免费额度很快打满。

---

## 4. 推荐你们 MVP 省钱配置

如果你们现在目标是“线上错误监控先可用”，我建议：

```ts
import Aegis from 'aegis-mp-sdk'

const aegis = new Aegis({
  id: '你的 RUM 应用 ID',
  uin: userId,

  // 保留错误监控
  onError: true,

  // 省钱：先关闭测速类
  reportApiSpeed: false,
  reportAssetSpeed: false,

  // 小程序一般不需要 spa；H5 单页应用才考虑
  spa: false,

  // 自定义版本，方便查哪个版本出错
  version: '1.0.0',

  // 抽样率，1 = 全量；0.2 = 20%
  random: 1,

  // 同一个错误最多上报次数，默认 5，可以调低
  repeat: 2,

  api: {
    // 不上报请求参数和返回体
    apiDetail: false,

    // 不开启全量请求日志
    reportRequest: false,
  },
})
```

如果量开始接近 50 万，就改成：

```ts
random: 0.2
```

也就是只采样 20%。腾讯配置文档里 `random` 是 0 到 1 的抽样率，0 表示全部不上报。([腾讯云][2])

---

## 5. 更推荐做成后端动态配置

不要把这些写死在前端。做一个接口：

```http
GET /settings/monitor
```

返回：

```json
{
  "enabled": true,
  "sampleRate": 0.3,
  "reportApiSpeed": false,
  "reportAssetSpeed": false,
  "reportRequest": false,
  "apiDetail": false,
  "repeat": 2
}
```

前端初始化：

```ts
const config = await getMonitorConfig()

const aegis = new Aegis({
  id: config.aegisId,
  uin: userId,
  onError: true,
  random: config.sampleRate,
  repeat: config.repeat,
  reportApiSpeed: config.reportApiSpeed,
  reportAssetSpeed: config.reportAssetSpeed,
  api: {
    reportRequest: config.reportRequest,
    apiDetail: config.apiDetail,
  },
})
```

这样线上发现费用快超了，你不用重新发版，后端直接把采样率从 `1` 调到 `0.2`。

---

## 6. 我给你的省钱策略

### MVP 初始配置

```text
只保留：
JS 错误
Promise 错误
业务关键异常
releaseId / userId / page / scene

关闭：
接口测速
静态资源测速
console 日志
点击日志
全量请求日志
API 参数和返回体上报
页面正常加载日志
资源正常加载日志
```

### 等线上稳定后再逐步打开

```text
第一阶段：只开错误，全量采样 random = 1
第二阶段：如果上报量低，再开接口测速 reportApiSpeed
第三阶段：只在排查性能问题时临时开资源测速 reportAssetSpeed
第四阶段：PV 大了以后，改 random = 0.2 ~ 0.5
```

---

## 7. 粗略判断标准

你可以按这个估：

```text
日 PV < 5 万：
可以全量错误监控，谨慎开接口测速。

日 PV 5 万 ~ 10 万：
不要开资源测速；接口测速最好采样。

日 PV 10 万以上：
只开错误监控 + 关键业务日志；测速类默认关闭或低采样。

日 PV 30 万以上：
必须采样，否则只 PV + 少量日志都可能接近额度。
```

最省钱、最实用的配置是：

```ts
{
  onError: true,
  reportApiSpeed: false,
  reportAssetSpeed: false,
  consoleLog: false,
  clickElementLog: false,
  random: 0.3,
  repeat: 2,
  api: {
    apiDetail: false,
    reportRequest: false
  }
}
```

一句话：**MVP 先做错误监控，不做全量性能监控；真正烧钱的是接口测速、资源测速、自定义日志和点击/console 日志。**

[1]: https://www.tencentcloud.com/zh/document/product/248/63312 "计费概述"
[2]: https://cloud.tencent.com/document/product/1464/58560 "腾讯云可观测平台 配置文档_腾讯云"
