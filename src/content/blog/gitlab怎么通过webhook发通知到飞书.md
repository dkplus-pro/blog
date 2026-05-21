---
title: 'GitLab Webhook 直连飞书通知方案'
date: 2026-05-21
tags: ['DevOps', 'GitLab', '飞书', '自动化', 'CI/CD']
description: '用 Custom webhook template 将 MR、Pipeline、部署与 Tag 事件转为飞书群消息，含模板示例与安全策略'
draft: false
---

# GitLab Webhook 直连飞书技术方案

## 1. 目标

通过 **GitLab Webhooks + Custom webhook template**，在 GitLab 发生关键研发事件时，自动通知到飞书群。

适用通知场景：

```text
MR 创建 / 合并 / 关闭
Pipeline 成功 / 失败
部署开始 / 成功 / 失败
Tag 发布
关键分支 Push
```

GitLab Webhook 会在 Push、Merge Request、Pipeline、Deployment、Tag 等事件发生时向配置的 URL 发送 HTTP POST 请求；Custom webhook template 可以自定义请求体，并要求最终渲染结果是合法 JSON。([GitLab文档][1])

---

## 2. 推荐架构

本方案采用 **GitLab 直接请求飞书机器人 Webhook**：

```text
GitLab 事件
  ↓
GitLab Webhook
  ↓
Custom webhook template 转换成飞书消息格式
  ↓
飞书自定义机器人
  ↓
飞书群通知
```

优点：

```text
不需要写中转服务
接入快
适合 MVP
维护成本低
```

缺点：

```text
不能复杂过滤
不能动态 @ 人
不能计算飞书签名
不能访问数组字段
不适合复杂消息编排
```

GitLab Custom webhook template 支持用 `{{project.name}}` 这类方式读取 payload 字段，也支持用点号访问嵌套属性，但不能访问数组里的属性。([GitLab文档][2])

---

## 3. 飞书机器人配置

在飞书群中添加自定义机器人：

```text
飞书群
  → 群设置
  → 群机器人
  → 添加机器人
  → 自定义机器人
  → 复制 Webhook 地址
```

飞书自定义机器人通过 Webhook 地址发送消息，支持文本、富文本、图片等消息类型，也支持关键词、IP 白名单、签名等安全配置。([飞书开放平台][3])

### 推荐安全策略

直连模式下建议使用：

```text
关键词校验：GitLab
```

原因是 GitLab Custom webhook template 没法动态计算飞书签名。飞书签名校验需要动态生成签名参数，更适合“GitLab → 自己的中转服务 → 飞书”的方案。

如果你们 GitLab 是自建服务，并且出口 IP 固定，也可以叠加：

```text
IP 白名单：GitLab 服务器出口 IP
```

---

## 4. GitLab Webhook 配置入口

进入 GitLab 项目：

```text
Project
  → Settings
  → Webhooks
  → Add new webhook
```

填写：

```text
URL：飞书机器人 Webhook 地址
Secret token：不填
Trigger：按通知类型选择
Custom webhook template：填写飞书 JSON 模板
```

GitLab 创建 Webhook 的入口是 `Settings > Webhooks > Add new webhook`，配置时可以选择触发事件。Secret token 会以 `X-Gitlab-Token` 请求头发送给接收端，主要用于自有服务校验；直连飞书时飞书不会识别这个 Header，所以不建议填写。([GitLab文档][2])

---

# 5. 建议开启哪些钩子

## MVP 推荐开启

| GitLab Trigger       | 是否推荐 | 用途               | 噪音 |
| -------------------- | ---- | ---------------- | -- |
| Merge request events | 推荐   | MR 创建、更新、合并、关闭通知 | 中  |
| Pipeline events      | 推荐   | CI 成功/失败通知       | 中  |
| Deployment events    | 推荐   | 部署开始、成功、失败、取消通知  | 低  |
| Tag push events      | 推荐   | 版本发布通知           | 低  |

GitLab 文档列出的常用项目/组 Webhook 事件包括 Deployment、Job、Merge request、Pipeline、Push、Release、Tag 等；其中 Deployment 会在部署开始、成功、失败或取消时触发，MR 会在创建、编辑、合并、关闭或源分支新增提交时触发，Pipeline 会在状态变化时触发，Tag 会在创建或删除时触发。([GitLab文档][1])

## 谨慎开启

| GitLab Trigger | 建议                                       |
| -------------- | ---------------------------------------- |
| Push events    | 只监听 `main`、`test`、`release/*`、`hotfix/*` |
| Job events     | 如果 Pipeline 通知不够细，再开启                    |
| Release events | 如果你们使用 GitLab Release，可以开启               |
| Comment events | 不建议 MVP 开，容易刷屏                           |

Push events 容易产生大量通知，GitLab 支持对 Push webhook 按分支做过滤，可以使用全部分支、通配符或正则。([GitLab文档][2])

---

# 6. 推荐 Webhook 拆分方式

不要一个 Webhook 同时勾选所有事件。建议拆成多个 Webhook：

```text
Webhook 1：MR 通知
Trigger：Merge request events

Webhook 2：CI 通知
Trigger：Pipeline events

Webhook 3：部署通知
Trigger：Deployment events

Webhook 4：Tag 发布通知
Trigger：Tag push events

Webhook 5：关键分支 Push 通知，可选
Trigger：Push events
Branch filter：main / test / release/* / hotfix/*
```

这样做的好处：

```text
不同事件模板互不影响
字段更稳定
排查更容易
通知噪音更可控
```

---

# 7. 飞书模板示例

## 7.1 MR 富文本通知

GitLab 勾选：

```text
Merge request events
```

Custom webhook template：

```json
{
  "msg_type": "post",
  "content": {
    "post": {
      "zh_cn": {
        "title": "GitLab MR 通知",
        "content": [
          [
            {
              "tag": "text",
              "text": "项目：{{project.path_with_namespace}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "动作：{{object_attributes.action}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "状态：{{object_attributes.state}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "标题：{{object_attributes.title}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "分支：{{object_attributes.source_branch}} → {{object_attributes.target_branch}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "作者：{{user.name}}"
            }
          ],
          [
            {
              "tag": "a",
              "text": "查看 MR",
              "href": "{{object_attributes.url}}"
            }
          ],
          [
            {
              "tag": "a",
              "text": "查看项目",
              "href": "{{project.web_url}}"
            }
          ]
        ]
      }
    }
  }
}
```

---

## 7.2 Pipeline 富文本通知

GitLab 勾选：

```text
Pipeline events
```

Custom webhook template：

```json
{
  "msg_type": "post",
  "content": {
    "post": {
      "zh_cn": {
        "title": "GitLab Pipeline 通知",
        "content": [
          [
            {
              "tag": "text",
              "text": "项目：{{project.path_with_namespace}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "状态：{{object_attributes.status}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "分支：{{object_attributes.ref}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "提交：{{commit.id}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "提交信息：{{commit.message}}"
            }
          ],
          [
            {
              "tag": "a",
              "text": "查看 Pipeline",
              "href": "{{object_attributes.url}}"
            }
          ]
        ]
      }
    }
  }
}
```

如果 `commit.message` 有换行导致 JSON 渲染失败，可以先改成简单版本：

```json
{
  "msg_type": "text",
  "content": {
    "text": "GitLab Pipeline通知\n项目：{{project.path_with_namespace}}\n状态：{{object_attributes.status}}\n分支：{{object_attributes.ref}}\nPipeline：{{object_attributes.url}}"
  }
}
```

---

## 7.3 Deploy 部署通知

GitLab 勾选：

```text
Deployment events
```

Custom webhook template：

```json
{
  "msg_type": "post",
  "content": {
    "post": {
      "zh_cn": {
        "title": "GitLab Deploy 通知",
        "content": [
          [
            {
              "tag": "text",
              "text": "项目：{{project.path_with_namespace}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "环境：{{environment}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "状态：{{status}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "提交：{{short_sha}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "提交信息：{{commit_title}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "操作人：{{user.name}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "部署时间：{{status_changed_at}}"
            }
          ],
          [
            {
              "tag": "a",
              "text": "查看部署任务",
              "href": "{{deployable_url}}"
            }
          ],
          [
            {
              "tag": "a",
              "text": "访问环境地址",
              "href": "{{environment_external_url}}"
            }
          ]
        ]
      }
    }
  }
}
```

要触发 Deployment events，你的 `.gitlab-ci.yml` 里部署 Job 通常需要配置 `environment`：

```yaml
deploy_test:
  stage: deploy
  script:
    - echo "deploy test"
  environment:
    name: test
    url: https://test.example.com
```

---

## 7.4 Tag 发布通知

GitLab 勾选：

```text
Tag push events
```

Custom webhook template：

```json
{
  "msg_type": "post",
  "content": {
    "post": {
      "zh_cn": {
        "title": "GitLab Tag 发布通知",
        "content": [
          [
            {
              "tag": "text",
              "text": "项目：{{project.path_with_namespace}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "Tag：{{ref}}"
            }
          ],
          [
            {
              "tag": "text",
              "text": "操作人：{{user_name}}"
            }
          ],
          [
            {
              "tag": "a",
              "text": "查看项目",
              "href": "{{project.web_url}}"
            }
          ]
        ]
      }
    }
  }
}
```

---

## 7.5 关键分支 Push 通知，可选

GitLab 勾选：

```text
Push events
```

分支过滤建议：

```text
main
test
release/*
hotfix/*
```

Custom webhook template：

```json
{
  "msg_type": "text",
  "content": {
    "text": "GitLab Push通知\n项目：{{project.path_with_namespace}}\n分支：{{ref}}\n提交人：{{user_name}}\n提交数：{{total_commits_count}}\n项目地址：{{project.web_url}}"
  }
}
```

Push 不建议全分支开启，否则 feature 分支每次 push 都会通知飞书，噪音很大。

---

# 8. 推荐通知策略

## 小团队 MVP

建议开启：

```text
Merge request events
Pipeline events
Deployment events
Tag push events
```

不建议开启：

```text
所有 Push events
所有 Job events
所有 Comment events
```

## 前端项目推荐

```text
MR：
通知代码评审、合并状态。

Pipeline：
通知构建成功/失败，尤其是 test、release、main 分支。

Deployment：
通知真正部署到测试环境、生产环境。

Tag：
通知版本发布，例如 v1.3.8、0.3.2。

Push：
只通知 main、test、release/*、hotfix/*。
```

---

# 9. GitLab CI/CD 配合建议

如果你希望部署通知更准确，CI Job 建议分清楚环境：

```yaml
stages:
  - build
  - deploy

deploy_test:
  stage: deploy
  script:
    - pnpm install
    - pnpm build:test
    - echo "deploy to test"
  environment:
    name: test
    url: https://test.example.com
  only:
    - test

deploy_prod:
  stage: deploy
  script:
    - pnpm install
    - pnpm build:prod
    - echo "deploy to prod"
  environment:
    name: production
    url: https://example.com
  only:
    - main
```

这样 GitLab 的 Deployment event 才能清楚知道部署环境是 `test` 还是 `production`。

---

# 10. 测试和排查

## 10.1 先用最简单模板测试

第一次不要直接上复杂富文本，先用：

```json
{
  "msg_type": "text",
  "content": {
    "text": "GitLab 测试通知"
  }
}
```

如果飞书能收到，再逐步替换成 MR、Pipeline、Deploy 模板。

## 10.2 检查飞书关键词

如果飞书机器人配置了关键词 `GitLab`，模板文本中必须包含 `GitLab`。

否则飞书会拒绝消息。

## 10.3 检查 GitLab Recent events

GitLab Webhook 页面可以查看最近的请求记录，包括状态码、请求体、响应体和耗时；Webhook 失败次数过多时，GitLab 还可能自动禁用 Webhook。([GitLab文档][2])

入口：

```text
Settings
  → Webhooks
  → 找到对应 Webhook
  → Edit
  → Recent events
  → View details
```

---

# 11. 已知限制

## 11.1 不能动态签名

飞书签名校验需要动态生成签名。GitLab Custom webhook template 不能计算 HMAC，因此直连飞书时不适合启用飞书签名校验。

需要签名时改为：

```text
GitLab Webhook
  → Node/Java/Python 中转服务
  → 计算飞书签名
  → 飞书机器人
```

## 11.2 不能复杂过滤

例如这些需求直连模式不好做：

```text
只通知 pipeline failed，不通知 success
MR update 不通知，只通知 open/merge
失败时 @ 负责人
根据分支发送到不同飞书群
同类失败 10 分钟内只通知一次
```

这些需要中转服务处理。

## 11.3 不能访问数组字段

GitLab Custom webhook template 不能访问数组属性，所以不建议在 Push 模板里列 commit 明细。([GitLab文档][2])

---

# 12. 最终推荐方案

## MVP 版本

```text
GitLab Custom webhook template 直连飞书
飞书安全策略：关键词 GitLab
GitLab Secret token：不填
Webhook 拆分：MR / Pipeline / Deploy / Tag
Push 只监听关键分支
```

## 正式增强版

```text
GitLab Webhook
  → 自建 webhook 中转服务
  → 事件过滤
  → 消息格式化
  → 飞书签名
  → @ 负责人
  → 去重限流
  → 多群分发
  → 飞书机器人
```

你们现在最适合先用 MVP 版本，把这 4 个通知跑起来：

```text
MR 通知
Pipeline 通知
Deploy 通知
Tag 发布通知
```

等通知噪音和流程稳定后，再考虑加中转服务。

[1]: https://docs.gitlab.com/user/project/integrations/webhook_events/ "Webhook events | GitLab Docs"
[2]: https://docs.gitlab.com/user/project/integrations/webhooks/ "Webhooks | GitLab Docs"
[3]: https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot?lang=zh-CN&ref=fenx.work&utm_source=chatgpt.com "自定义机器人使用指南- 开发文档- 飞书开放平台"
