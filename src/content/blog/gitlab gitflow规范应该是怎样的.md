---
title: 'GitLab GitFlow 工程协作规范'
date: 2026-05-21
tags: ['Git', 'GitLab', '工程化', 'DevOps', 'CI/CD']
description: '分支模型、MR 规则、CI/CD、版本发布、Hotfix、Tag 与权限通知的通用 GitFlow + GitLab 协作规范'
draft: false
---

# GitLab GitFlow 规范技术文档

## 1. 文档目标

本文档定义一套通用的 **GitFlow + GitLab 工程协作规范**，用于约束分支管理、代码评审、CI/CD、版本发布、Hotfix、Tag、权限与通知流程。

适用场景：

```text
多人协作项目
存在测试、预发、生产环境
有版本化发布节奏
需要稳定发布、回滚和审计
```

GitFlow 的核心思想是使用长期分支管理生产与集成代码，并使用 `feature`、`release`、`hotfix` 等辅助分支完成开发、发布和线上修复。Hotfix 分支通常从 `main` 拉出，修复后合回 `main` 和 `develop`，并在 `main` 上打新版本 Tag。([Atlassian][1])

---

## 2. 分支模型

标准 GitFlow 分支如下：

```text
main
develop
feature/*
release/*
hotfix/*
```

### 2.1 main

`main` 是生产稳定分支。

规则：

```text
main 永远代表当前线上生产代码
禁止直接 push
只能通过 Merge Request 合入
每次生产发布后必须打 Tag
```

### 2.2 develop

`develop` 是日常集成分支。

规则：

```text
所有 feature 分支最终合入 develop
develop 应该保持可测试、可构建
不直接用于生产发布
```

### 2.3 feature/*

功能开发分支。

命名：

```text
feature/login
feature/payment-refactor
feature/JIRA-123-user-profile
```

来源：

```text
从 develop 拉出
```

合并方向：

```text
feature/* → develop
```

### 2.4 release/*

发布候选分支。

命名：

```text
release/v1.2.0
release/2026.05.20
```

来源：

```text
从 develop 拉出
```

用途：

```text
版本冻结
提测
修复发布前 bug
准备 release notes
```

合并方向：

```text
release/* → main
release/* → develop
```

### 2.5 hotfix/*

线上紧急修复分支。

命名：

```text
hotfix/v1.2.1-login-error
hotfix/payment-callback
```

来源：

```text
从 main 拉出
```

合并方向：

```text
hotfix/* → main
hotfix/* → develop
```

Hotfix 完成后，应合回生产分支和开发分支，并在生产分支上打新的版本 Tag。([Atlassian][1])

---

## 3. 标准流转流程

### 3.1 功能开发流程

```text
develop
  ↓
feature/*
  ↓ MR
develop
```

步骤：

```bash
git checkout develop
git pull origin develop
git checkout -b feature/user-profile
```

开发完成后：

```bash
git add .
git commit -m "feat: add user profile page"
git push origin feature/user-profile
```

然后在 GitLab 创建 MR：

```text
source: feature/user-profile
target: develop
```

合并条件：

```text
CI 通过
Code Review 通过
讨论已解决
无阻塞缺陷
```

---

### 3.2 发布流程

```text
develop
  ↓
release/v1.2.0
  ↓ MR
main
  ↓ tag
v1.2.0
  ↓
release/v1.2.0 → develop
```

步骤：

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0
git push origin release/v1.2.0
```

发布分支阶段只允许：

```text
修复 bug
更新版本号
更新 release notes
修复构建配置
补充必要文档
```

不允许：

```text
新增大功能
大规模重构
引入高风险依赖
```

发布完成后：

```text
release/v1.2.0 → main
main 打 Tag：v1.2.0
release/v1.2.0 → develop
```

---

### 3.3 Hotfix 流程

```text
main
  ↓
hotfix/*
  ↓ MR
main
  ↓ tag
v1.2.1
  ↓
hotfix/* → develop
```

步骤：

```bash
git checkout main
git pull origin main
git checkout -b hotfix/login-error
```

修复完成：

```bash
git add .
git commit -m "fix: fix login error"
git push origin hotfix/login-error
```

创建 MR：

```text
source: hotfix/login-error
target: main
```

生产合并后：

```text
main 打 Tag：v1.2.1
hotfix/login-error 再合回 develop
```

---

## 4. GitLab 权限与保护分支配置

GitLab 的 Protected Branches 可以控制谁能 push、谁能 merge。官方建议生产分支应限制为 Maintainer 才能合并，并将直接 push 设为 No one。([GitLab文档][2])

配置入口：

```text
Project
  → Settings
  → Repository
  → Protected branches
```

推荐配置：

| 分支          | 允许 Push             | 允许 Merge             | 说明         |
| ----------- | ------------------- | -------------------- | ---------- |
| `main`      | No one              | Maintainer           | 生产分支，禁止直推  |
| `develop`   | No one              | Developer/Maintainer | 集成分支，必须 MR |
| `release/*` | No one              | Maintainer           | 发布候选分支     |
| `hotfix/*`  | No one 或 Maintainer | Maintainer           | 紧急修复分支     |
| `feature/*` | Developer           | Developer/Maintainer | 功能开发分支     |

强制原则：

```text
main 不允许直接 push
release/* 不允许直接 push
hotfix/* 建议走 MR
所有生产变更必须可追溯
```

---

## 5. Merge Request 规范

### 5.1 MR 必须包含的信息

每个 MR 应包含：

```text
变更内容
影响范围
自测结果
关联需求 / 缺陷编号
是否涉及数据库 / 配置 / 接口变更
是否需要发布说明
是否有回滚方案
```

推荐 MR 模板：

```md
## 变更内容

-

## 影响范围

- [ ] API
- [ ] UI
- [ ] 数据库
- [ ] 配置
- [ ] CI/CD
- [ ] 权限
- [ ] 第三方服务

## 自测结果

- [ ] 本地测试通过
- [ ] 单元测试通过
- [ ] CI 通过
- [ ] 关键流程验证通过

## 发布说明

- 是否需要发版：
- 是否需要配置变更：
- 是否需要回滚方案：

## 关联任务

-
```

### 5.2 MR 合并要求

GitLab 支持设置 “Pipelines must succeed”，开启后 MR 的最新 Pipeline 必须成功，否则不能合并；同时该设置也会要求 MR 存在 Pipeline。([GitLab文档][3])

推荐合并规则：

| 目标分支                  | CI   | Review            | 备注     |
| --------------------- | ---- | ----------------- | ------ |
| `feature/* → develop` | 必须通过 | 至少 1 人            | 日常开发   |
| `release/* → main`    | 必须通过 | 至少 1 名 Maintainer | 生产发布   |
| `hotfix/* → main`     | 必须通过 | 至少 1 名 Maintainer | 紧急修复   |
| `release/* → develop` | 必须通过 | 可简化               | 回合并    |
| `hotfix/* → develop`  | 必须通过 | 可简化               | 防止修复丢失 |

GitLab Approval Rules 可以定义 MR 合并前需要多少审批，以及由哪些人审批。([GitLab文档][4])

---

## 6. Code Owners 规范

建议在项目根目录维护：

```text
CODEOWNERS
```

示例：

```text
# 默认代码负责人
* @team-lead

# CI/CD
.gitlab-ci.yml @devops @team-lead

# 安全相关
/src/auth/ @security-team @team-lead

# 核心 API
/src/api/ @backend-lead @team-lead

# 全局状态
/src/stores/ @frontend-lead @team-lead
```

GitLab Code Owners 可以标识文件或目录负责人，并可结合受保护分支要求对应负责人审批后才能合并。([GitLab文档][5])

---

## 7. CI/CD 规范

### 7.1 Pipeline 阶段

推荐基础阶段：

```text
install
lint
test
build
security_scan
deploy
```

示例：

```yaml
stages:
  - lint
  - test
  - build
  - deploy

lint:
  stage: lint
  script:
    - pnpm lint
    - pnpm typecheck
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == "develop"'
    - if: '$CI_COMMIT_BRANCH == "main"'
    - if: '$CI_COMMIT_BRANCH =~ /^release\/.+$/'
    - if: '$CI_COMMIT_BRANCH =~ /^hotfix\/.+$/'

test:
  stage: test
  script:
    - pnpm test
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'

build:
  stage: build
  script:
    - pnpm build
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop"'
    - if: '$CI_COMMIT_BRANCH == "main"'
    - if: '$CI_COMMIT_BRANCH =~ /^release\/.+$/'

deploy_production:
  stage: deploy
  script:
    - echo "deploy production"
  environment:
    name: production
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
      when: manual
```

### 7.2 环境映射

| 分支          | 环境                   | 说明     |
| ----------- | -------------------- | ------ |
| `feature/*` | 临时环境，可选              | 功能自测   |
| `develop`   | dev / test           | 集成测试   |
| `release/*` | staging / preprod    | 发布验收   |
| `main`      | production           | 生产     |
| `hotfix/*`  | staging / production | 紧急修复验证 |

---

## 8. Tag 与版本规范

GitLab Protected Tags 可以控制谁能创建 Tag，并防止 Tag 被误更新或误删除。([GitLab文档][6])

配置入口：

```text
Project
  → Settings
  → Repository
  → Protected tags
```

推荐保护规则：

```text
v*
```

允许创建：

```text
Maintainer only
```

### 8.1 版本号规范

推荐使用语义化版本：

```text
v主版本.次版本.修订版本
```

示例：

```text
v1.0.0
v1.1.0
v1.1.1
v2.0.0
```

含义：

```text
主版本：不兼容变更
次版本：向后兼容的新功能
修订版本：向后兼容的问题修复
```

### 8.2 Tag 创建规则

生产发布后，在 `main` 上打 Tag：

```bash
git checkout main
git pull origin main
git tag -a v1.2.0 -m "release: v1.2.0"
git push origin v1.2.0
```

建议使用 annotated tag。GitLab 文档说明 Git 支持 lightweight tag 和 annotated tag，其中 annotated tag 包含元数据，并可用于签名验证。([GitLab文档][7])

---

## 9. 分支命名规范

推荐格式：

```text
feature/<short-description>
feature/<ticket-id>-<short-description>

bugfix/<short-description>
release/v<version>
hotfix/<short-description>
chore/<short-description>
refactor/<short-description>
```

示例：

```text
feature/user-login
feature/JIRA-123-user-login
bugfix/payment-timeout
release/v1.2.0
hotfix/login-crash
chore/update-ci
refactor/order-service
```

不推荐：

```text
test1
new
fix
dev-user
zhangsan
临时分支
```

如果 GitLab 支持 Push Rules，可通过正则校验分支名和提交信息。GitLab Push Rules 支持校验 commit message 是否匹配表达式，也可用于仓库推送规则治理。([GitLab文档][8])

推荐分支名正则：

```regex
^(main|develop)$|^(feature|bugfix|release|hotfix|chore|refactor)\/[a-zA-Z0-9._-]+$
```

---

## 10. Commit Message 规范

推荐采用 Conventional Commits 风格：

```text
<type>(<scope>): <subject>
```

示例：

```text
feat(auth): add login page
fix(order): fix payment timeout
refactor(api): split request client
chore(ci): update gitlab pipeline
docs: update release guide
```

推荐 type：

```text
feat      新功能
fix       缺陷修复
docs      文档
style     代码格式
refactor  重构
perf      性能优化
test      测试
chore     工程杂项
ci        CI/CD
revert    回滚
```

推荐 commit message 正则：

```regex
^(feat|fix|docs|style|refactor|perf|test|chore|ci|revert)(\([a-zA-Z0-9._-]+\))?: .{1,100}
```

---

## 11. Webhook 与通知规范

GitLab Webhook 可在项目事件发生时触发 HTTP 请求，例如 Push、MR、Pipeline、Deployment、Tag 等事件。([GitLab文档][2])

推荐开启：

| Webhook 事件           | 是否推荐    | 用途              |
| -------------------- | ------- | --------------- |
| Merge request events | 推荐      | MR 创建、更新、合并、关闭  |
| Pipeline events      | 推荐      | CI 成功 / 失败      |
| Deployment events    | 推荐      | 部署开始 / 成功 / 失败  |
| Tag push events      | 推荐      | 版本发布            |
| Push events          | 谨慎      | 仅关键分支           |
| Job events           | 可选      | 需要更细粒度 CI 通知时开启 |
| Comment events       | 不推荐默认开启 | 噪音较大            |

推荐通知渠道：

```text
飞书
Slack
Teams
邮件
企业微信
```

行业实践上，通知应关注关键节点，不应把所有 Push 都推送到群，否则容易造成通知疲劳。

---

## 12. 发布与回滚规范

### 12.1 发布前检查

发布前必须确认：

```text
release 分支 CI 通过
测试验收通过
MR 已审批
版本号已确认
变更日志已更新
回滚方案已准备
监控和告警已确认
```

### 12.2 发布后动作

```text
main 打 Tag
生成 release notes
通知相关团队
观察监控指标
保留构建产物
```

### 12.3 回滚策略

推荐优先使用：

```text
回滚到上一个稳定 Tag
重新部署上一个构建产物
必要时创建 hotfix 分支修复
```

示例：

```bash
git checkout main
git checkout -b hotfix/rollback-v1.2.0
```

---

## 13. GitLab 项目设置清单

### 13.1 Repository

```text
开启 Protected branches
保护 main
保护 develop
保护 release/*
保护 hotfix/*
保护 v* tags
```

### 13.2 Merge Requests

```text
开启 Pipelines must succeed
开启 All discussions must be resolved
建议开启 Delete source branch after merge
根据团队习惯选择是否 Squash commits
```

### 13.3 CI/CD

```text
MR 必须跑 lint/test/build
main 部署生产建议 manual
release 分支部署预发
生产变量使用 Protected CI/CD variables
```

### 13.4 Approval

```text
main 至少 1 名 Maintainer 审批
release/* 至少 1 名负责人审批
高风险目录使用 CODEOWNERS
```

### 13.5 Push Rules

```text
限制分支命名
限制 commit message
禁止提交敏感文件
禁止大文件误提交
```

### 13.6 Webhooks

```text
MR 通知
Pipeline 通知
Deploy 通知
Tag 通知
关键分支 Push 通知
```

---

## 14. 最终推荐标准

一套通用 GitLab GitFlow 最小标准如下：

```text
1. main 代表生产代码
2. develop 代表日常集成代码
3. feature/* 从 develop 拉出，合回 develop
4. release/* 从 develop 拉出，合入 main 和 develop
5. hotfix/* 从 main 拉出，合入 main 和 develop
6. main、release/*、hotfix/* 必须受保护
7. 所有进入 main 的变更必须走 MR
8. MR 必须 CI 通过后才能合并
9. 生产发布必须在 main 打 v* Tag
10. v* Tag 必须受保护
11. 关键目录使用 CODEOWNERS
12. MR、Pipeline、Deploy、Tag 事件通知协作群
13. 每次发布必须有版本记录和回滚方案
```

这套规范适合大多数采用版本化发布、需要测试验收和生产稳定性的团队。对于极高频发布、持续交付成熟度很高的团队，可以进一步演进为 Trunk-Based Development；但在需要明确测试、预发、生产隔离的项目中，GitFlow 仍然是常见且可治理的分支管理方案。

[1]: https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow?utm_source=chatgpt.com "Gitflow Workflow | Atlassian Git Tutorial"
[2]: https://docs.gitlab.com/user/project/repository/branches/protected/?utm_source=chatgpt.com "Protected branches"
[3]: https://docs.gitlab.com/user/project/merge_requests/auto_merge/?utm_source=chatgpt.com "Auto-merge"
[4]: https://docs.gitlab.com/user/project/merge_requests/approvals/rules/?utm_source=chatgpt.com "Merge request approval rules"
[5]: https://docs.gitlab.com/user/project/codeowners/?utm_source=chatgpt.com "Code Owners"
[6]: https://docs.gitlab.com/user/project/protected_tags/?utm_source=chatgpt.com "Protected tags"
[7]: https://docs.gitlab.com/user/project/repository/tags/?utm_source=chatgpt.com "Tags"
[8]: https://docs.gitlab.com/user/project/repository/push_rules/?utm_source=chatgpt.com "Push rules"
