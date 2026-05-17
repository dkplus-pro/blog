---
title: 'kv接口设计'
date: 2026-05-13
tags: ['前端', '后端', '架构', '性能优化']
description: '设计一个简单的租户级 KV 配置能力，用于支持不同租户、不同小程序、不同环境的全局配置。'
draft: false
---

# 租户级通用配置接口技术方案

## 1. 目标

设计一个简单的租户级 KV 配置能力，用于支持不同租户、不同小程序、不同环境的全局配置。

目标：

```txt
1. 后端新增配置不需要改代码
2. 数据库不需要频繁加字段
3. 小程序端只读配置
4. 后台端只需要查询和保存
5. 接口数量尽量少
6. 支持租户、应用、环境隔离
7. 支持配置启用/禁用
8. 支持 public/private 隔离
```

---

# 2. 接口设计

接口只保留 3 个：

```txt
小程序端：
GET  /settings

后台端：
GET  /admin/settings
POST /admin/settings
```

说明：

| 接口                     | 用途                   |
| ---------------------- | -------------------- |
| `GET /settings`        | 小程序读取公开配置            |
| `GET /admin/settings`  | 后台查询配置列表             |
| `POST /admin/settings` | 后台新建、修改、批量保存、启用、禁用配置 |

不设计：

```txt
PUT /admin/settings/{id}
DELETE /admin/settings/{id}
PATCH /admin/settings/{id}
```

所有后台写操作统一走：

```txt
POST /admin/settings
```

---

# 3. 数据库设计

推荐第一版用：

```txt
TEXT + value_type
```

兼容性最好，也方便后端做动态配置。

```sql
CREATE TABLE tenant_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,

  tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
  app_id VARCHAR(64) NOT NULL COMMENT '应用ID，如 zhouzi-mp',
  env VARCHAR(32) NOT NULL COMMENT '环境：dev/test/prod',

  setting_key VARCHAR(128) NOT NULL COMMENT '配置key',
  setting_value TEXT NOT NULL COMMENT '配置值',
  value_type VARCHAR(32) NOT NULL DEFAULT 'string' COMMENT 'string/number/boolean/json/array',

  name VARCHAR(128) DEFAULT NULL COMMENT '配置名称',
  group_name VARCHAR(64) DEFAULT NULL COMMENT '配置分组',
  description VARCHAR(255) DEFAULT NULL COMMENT '配置说明',

  is_public TINYINT NOT NULL DEFAULT 1 COMMENT '是否允许小程序读取',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用，0禁用',

  version INT NOT NULL DEFAULT 1 COMMENT '配置版本',
  created_by VARCHAR(64) DEFAULT NULL,
  updated_by VARCHAR(64) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,

  UNIQUE KEY uk_tenant_app_env_key (
    tenant_id,
    app_id,
    env,
    setting_key
  ),

  INDEX idx_tenant_app_env (
    tenant_id,
    app_id,
    env,
    status,
    is_public
  )
);
```

核心唯一约束：

```txt
tenant_id + app_id + env + setting_key
```

这样同一个租户、同一个应用、同一个环境下，同一个配置 key 只能有一条。

---

# 4. 配置 key 规范

统一使用点分层命名：

```txt
模块.功能.字段
```

推荐：

```txt
app.name
app.logo
theme.primaryColor
feature.clarify.enabled
feature.voiceMessage.enabled
monitor.rum.enabled
monitor.rum.id
cdn.staticBaseUrl
customerService.wechatQr
```

不推荐：

```txt
flag1
open
switch
test
config
abc
```

建议 key 校验规则：

```regex
^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$
```

---

# 5. value_type 设计

配置值统一存在 `setting_value` 中，返回时根据 `value_type` 转换。

| value_type | 数据库存储              | 返回给前端                 |
| ---------- | ------------------ | --------------------- |
| `string`   | `周子AI`             | `"周子AI"`              |
| `boolean`  | `true`             | `true`                |
| `number`   | `0.5`              | `0.5`                 |
| `json`     | `{"enabled":true}` | `{ "enabled": true }` |
| `array`    | `["a","b"]`        | `[ "a", "b" ]`        |

---

# 6. 小程序端接口

## 6.1 获取公开配置

```http
GET /settings?tenantId=zhouzi&appId=zhouzi-mp&env=prod
```

也可以通过 Header 传：

```http
x-tenant-id: zhouzi
x-app-id: zhouzi-mp
x-env: prod
```

如果用户已登录，也可以从 token 中解析 `tenantId`。

---

## 6.2 查询逻辑

小程序端只返回：

```sql
WHERE tenant_id = ?
  AND app_id = ?
  AND env = ?
  AND status = 1
  AND is_public = 1
```

也就是说：

```txt
禁用配置不返回
私有配置不返回
其他租户配置不返回
其他环境配置不返回
```

---

## 6.3 返回示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tenantId": "zhouzi",
    "appId": "zhouzi-mp",
    "env": "prod",
    "version": "20260512-001",
    "updatedAt": "2026-05-12T10:00:00Z",
    "settings": {
      "app.name": "周子AI",
      "app.logo": "https://cdn.xxx.com/logo.png",
      "theme.primaryColor": "#1677ff",
      "feature.clarify.enabled": true,
      "feature.voiceMessage.enabled": true,
      "monitor.rum.enabled": true,
      "monitor.rum.id": "rum_xxx",
      "cdn.staticBaseUrl": "https://cdn.xxx.com/static/zhouzi-mp/prod",
      "customerService.wechatQr": "https://cdn.xxx.com/qrcode.png"
    }
  }
}
```

---

# 7. 后台查询接口

## 7.1 查询配置列表

```http
GET /admin/settings?tenantId=zhouzi&appId=zhouzi-mp&env=prod
```

可选查询参数：

```txt
tenantId
appId
env
groupName
key
status
isPublic
page
pageSize
```

---

## 7.2 返回示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "tenantId": "zhouzi",
        "appId": "zhouzi-mp",
        "env": "prod",
        "key": "feature.clarify.enabled",
        "value": true,
        "valueType": "boolean",
        "name": "需求澄清开关",
        "groupName": "feature",
        "description": "是否开启需求澄清功能",
        "isPublic": true,
        "status": 1,
        "version": 3,
        "updatedBy": "admin",
        "updatedAt": "2026-05-12T10:00:00Z"
      }
    ],
    "total": 1
  }
}
```

后台可以看到：

```txt
公开配置
私有配置
启用配置
禁用配置
配置说明
操作人
更新时间
```

---

# 8. 后台保存接口

## 8.1 新建 / 修改 / 禁用统一接口

```http
POST /admin/settings
```

这个接口采用 **upsert** 逻辑：

```txt
如果 tenantId + appId + env + key 不存在，则新增
如果已存在，则更新
```

---

## 8.2 单条保存请求

```json
{
  "tenantId": "zhouzi",
  "appId": "zhouzi-mp",
  "env": "prod",
  "key": "feature.clarify.enabled",
  "value": true,
  "valueType": "boolean",
  "name": "需求澄清开关",
  "groupName": "feature",
  "description": "是否开启需求澄清功能",
  "isPublic": true,
  "status": 1
}
```

返回：

```json
{
  "code": 0,
  "message": "saved",
  "data": {
    "id": 1,
    "version": 4
  }
}
```

---

## 8.3 批量保存请求

为了减少接口数量，批量保存也走同一个接口。

```json
{
  "tenantId": "zhouzi",
  "appId": "zhouzi-mp",
  "env": "prod",
  "settings": [
    {
      "key": "feature.clarify.enabled",
      "value": true,
      "valueType": "boolean",
      "name": "需求澄清开关",
      "groupName": "feature",
      "description": "是否开启需求澄清功能",
      "isPublic": true,
      "status": 1
    },
    {
      "key": "theme.primaryColor",
      "value": "#1677ff",
      "valueType": "string",
      "name": "主题色",
      "groupName": "theme",
      "description": "小程序主题色",
      "isPublic": true,
      "status": 1
    }
  ]
}
```

返回：

```json
{
  "code": 0,
  "message": "saved",
  "data": {
    "successCount": 2,
    "failCount": 0
  }
}
```

---

## 8.4 禁用配置

不用 DELETE，仍然走 POST。

```json
{
  "tenantId": "zhouzi",
  "appId": "zhouzi-mp",
  "env": "prod",
  "key": "feature.clarify.enabled",
  "status": 0
}
```

含义：

```txt
status = 0 表示禁用
小程序 GET /settings 不再返回该配置
```

---

## 8.5 启用配置

```json
{
  "tenantId": "zhouzi",
  "appId": "zhouzi-mp",
  "env": "prod",
  "key": "feature.clarify.enabled",
  "status": 1
}
```

---

# 9. 后端处理逻辑

## 9.1 POST /admin/settings 逻辑

伪代码：

```txt
1. 校验管理员权限
2. 判断是单条保存还是批量保存
3. 校验 key 格式
4. 校验 value 是否符合 valueType
5. 校验 isPublic 配置是否包含敏感信息
6. 根据 tenantId + appId + env + key 查询是否存在
7. 不存在则 insert
8. 存在则 update
9. version + 1
10. 更新 updatedBy、updatedAt
11. 清理 settings 缓存
12. 返回保存结果
```

---

## 9.2 valueType 校验

```txt
string：任意字符串
boolean：只能是 true / false
number：必须是数字
json：必须是合法 JSON 对象
array：必须是合法 JSON 数组
```

---

# 10. 前端使用设计

小程序启动时加载配置：

```ts
let settingsCache: Record<string, unknown> = {}

export async function loadSettings() {
  const result = await request.get('/settings')
  settingsCache = result.settings || {}
  return settingsCache
}

export function getSetting<T = unknown>(key: string, defaultValue?: T): T {
  return (settingsCache[key] as T) ?? defaultValue
}

export function isFeatureEnabled(featureName: string) {
  return getSetting<boolean>(`feature.${featureName}.enabled`, false)
}
```

建议集中维护 key：

```ts
export const settingKeys = {
  appName: 'app.name',
  appLogo: 'app.logo',
  clarifyEnabled: 'feature.clarify.enabled',
  voiceMessageEnabled: 'feature.voiceMessage.enabled',
  rumEnabled: 'monitor.rum.enabled',
  rumId: 'monitor.rum.id',
  cdnBaseUrl: 'cdn.staticBaseUrl',
  customerServiceQr: 'customerService.wechatQr'
} as const
```

业务里不要到处写字符串：

```ts
getSetting(settingKeys.clarifyEnabled, false)
```

---

# 11. 缓存设计

`/settings` 不应该每个页面都请求。

建议：

```txt
1. 小程序启动时请求一次
2. 内存缓存一份
3. storage 缓存一份
4. 下次启动先用本地缓存，再异步刷新
```

后端可以缓存：

```txt
tenantId + appId + env
```

缓存 key 示例：

```txt
settings:zhouzi:zhouzi-mp:prod
```

后台保存配置后清理对应缓存。

---

# 12. 权限与安全

## 小程序端

```txt
只能访问 GET /settings
只能拿到 is_public = 1 且 status = 1 的配置
```

## 后台端

```txt
GET /admin/settings 需要 settings:read 权限
POST /admin/settings 需要 settings:write 权限
```

不允许 public 配置包含：

```txt
API Secret
数据库密码
支付密钥
云厂商 SecretKey
后端内部 Token
```

---

# 13. 第一版接口清单

最终第一版只需要：

```txt
GET  /settings
GET  /admin/settings
POST /admin/settings
```

对应职责：

| 接口                     | 使用方 | 职责               |
| ---------------------- | --- | ---------------- |
| `GET /settings`        | 小程序 | 读取公开启用配置         |
| `GET /admin/settings`  | 后台  | 查询全部配置           |
| `POST /admin/settings` | 后台  | 新建、修改、批量保存、启用、禁用 |

---

# 14. 最终结论

这套方案的核心是：

```txt
小程序只读。
后台只用 GET + POST。
配置通过 KV 数据化。
新增配置不改后端代码。
新增配置不加数据库字段。
```

最小可用版本：

```txt
一张 tenant_settings 表
三个接口
一个后台配置页面
一个前端 settings 读取封装
```

这样后续新增配置时，只需要在后台新增一条记录，例如：

```txt
feature.xxx.enabled = true
```

不需要：

```txt
后端改 DTO
后端加字段
数据库加列
重新发版
```
