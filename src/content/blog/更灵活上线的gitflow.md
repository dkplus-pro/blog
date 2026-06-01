---
title: '更灵活上线的 GitFlow：以 main 为稳定主干'
date: 2026-05-25
tags: ['Git', 'GitFlow', '工程化', '发布']
description: '适合多功能并行且上线顺序不确定的分支管理规范：main 稳定、feature 独立、release 临时组包'
draft: false
---

# 前端项目分支管理规范

## 1. 背景

当前项目存在多个功能并行开发、上线顺序不确定的情况：

```txt
feature1 开发中，可能延期
feature2 更紧急，可能先上线
feature3 测试完成，可能提前发布
```

在传统 Gitflow 中，多个功能通常会先合入 `develop`，再从 `develop` 拉出 `release` 分支进行发布。

但在当前项目模式下，这会带来明显风险：

```txt
feature1 合入 develop，并引入 bug
feature2 合入 develop
从 develop 拉 release2
release2 被迫带上 feature1 的 bug
feature2 无法单独干净上线
```

因此，项目不再采用传统 Gitflow 中以 `develop` 为核心集成和发布来源的模式。

新的分支策略调整为：

> 以 `main` 作为唯一线上稳定主干，`feature` 独立开发和测试，`release` 仅在组包发布时临时使用。

---

# 2. 分支类型

## 2.1 main 分支

`main` 是线上稳定分支。

它代表当前生产环境最新稳定代码。

规则：

```txt
1. main 永远保持可发布状态。
2. main 上的代码必须已经通过测试并允许上线。
3. 生产发布最终必须落到 main。
4. 每次上线后必须打 tag。
5. 禁止直接在 main 上开发功能。
```

推荐保护规则：

```txt
1. 禁止直接 push main。
2. 必须通过 Merge Request / Pull Request 合入。
3. 合入前必须通过 CI。
4. 合入前至少一人 Code Review。
5. main 合入后自动触发构建或发布流程。
```

---

## 2.2 feature 分支

`feature/*` 用于功能开发。

命名建议：

```txt
feature/login
feature/order-list
feature/payment-refactor
feature/user-center
```

创建方式：

```bash
git checkout main
git pull origin main
git checkout -b feature/order-list
```

规则：

```txt
1. feature 分支必须从 main 拉出。
2. 每个 feature 只做一个相对独立的功能。
3. feature 未测试通过，不允许合入 main。
4. feature 可以部署到独立测试环境进行测试。
5. feature 测试通过后，才允许进入发布流程。
```

重点原则：

> feature 没有准备好上线之前，不要合入长期公共发布分支。

---

## 2.3 release 分支

`release/*` 是临时发布分支，只在需要多个功能组包上线时使用。

命名建议：

```txt
release/2026-05-27
release/v1.3.0
release/sprint-12
```

创建方式：

```bash
git checkout main
git pull origin main
git checkout -b release/2026-05-27
```

使用场景：

```txt
1. 多个 feature 需要一起上线。
2. 上线前需要冻结代码。
3. 发布前需要集中修复发版问题。
4. 需要单独维护一个待发布版本。
```

组包方式：

```bash
git checkout release/2026-05-27
git merge feature/order-list
git merge feature/payment
git merge feature/coupon
```

规则：

```txt
1. release 必须从 main 拉出。
2. release 不能从 develop 拉出。
3. release 只合入本次确定要上线的 feature。
4. 未确认上线的 feature 不允许合入 release。
5. release 测试通过后，可以从 release 构建上线。
6. 上线完成后，release 必须合回 main。
7. release 合回 main 后打 tag。
8. 发布完成后可以删除 release 分支。
```

发布完成后：

```bash
git checkout main
git pull origin main
git merge release/2026-05-27
git tag v1.3.0
git push origin main --tags
```

删除 release：

```bash
git branch -d release/2026-05-27
git push origin --delete release/2026-05-27
```

---

## 2.4 hotfix 分支

`hotfix/*` 用于线上紧急修复。

命名建议：

```txt
hotfix/login-error
hotfix/payment-timeout
hotfix/white-screen
```

创建方式：

```bash
git checkout main
git pull origin main
git checkout -b hotfix/login-error
```

规则：

```txt
1. hotfix 必须从 main 拉出。
2. hotfix 只修复线上问题，不夹带新功能。
3. hotfix 测试通过后合入 main。
4. main 发布后打 tag。
5. 如果存在未完成的 release 分支，需要把 hotfix 同步到 release。
```

示例：

```bash
git checkout main
git merge hotfix/login-error
git tag v1.3.1
git push origin main --tags
```

如果当前还有待发布分支：

```bash
git checkout release/2026-05-27
git merge hotfix/login-error
git push origin release/2026-05-27
```

---

## 2.5 integration 分支

`integration/*` 是临时联调分支。

它只用于多个功能提前联调，不作为正式发布来源。

命名建议：

```txt
integration/payment-coupon
integration/order-user
integration/sprint-12
```

使用场景：

```txt
feature/payment 和 feature/coupon 需要提前联调
但这两个功能不一定同时上线
```

可以创建：

```bash
git checkout main
git checkout -b integration/payment-coupon
git merge feature/payment
git merge feature/coupon
```

规则：

```txt
1. integration 只用于联调。
2. integration 不作为生产发布来源。
3. integration 不长期保留。
4. 联调完成后可以删除。
5. integration 上发现的问题，应回到对应 feature 分支修复。
```

错误做法：

```txt
feature/a → integration
feature/b → integration
integration → main
```

正确做法：

```txt
feature/a → integration，仅用于联调
feature/b → integration，仅用于联调

真正发布时：
feature/a 测试通过 → main 或 release
feature/b 测试通过 → main 或 release
```

---

# 3. 是否保留 develop 分支

## 3.1 结论

当前项目可以废弃 `develop` 分支。

原因是：

> 当前项目不是固定版本节奏，而是多个 feature 并行开发，谁先完成谁先上线。

在这种模式下，`develop` 很容易变成多个未上线功能的混合池。

一旦某个功能引入 bug，后续从 `develop` 拉出的发布分支都会被污染。

---

## 3.2 develop 不再作为发布来源

禁止使用：

```txt
develop → release → main
```

原因：

```txt
develop 可能包含未测试完成的功能
develop 可能包含暂缓上线的功能
develop 可能包含有 bug 的功能
```

新的发布来源应该是：

```txt
main
```

或者：

```txt
main → release
```

---

## 3.3 如果暂时不能删除 develop

如果团队短期内还不能完全废弃 `develop`，可以保留，但需要重新定义它的定位：

```txt
develop = 临时集成验证分支
```

而不是：

```txt
develop = 下一个发布版本
```

也就是说：

```txt
1. develop 不能作为正式发布来源。
2. develop 不能默认代表下个版本。
3. develop 只能用于提前集成、发现冲突、联调验证。
4. 真正发布仍然必须从 main 或 release 进行。
```

---

# 4. 标准发布流程

## 4.1 单功能独立上线

适用于一个 feature 已经开发完成、测试完成，并且需要单独上线。

流程：

```txt
main
 ↓
feature/order-list
 ↓
开发完成
 ↓
feature 独立测试
 ↓
测试通过
 ↓
merge 到 main
 ↓
从 main 构建上线
 ↓
打 tag
```

命令示例：

```bash
git checkout main
git pull origin main
git merge feature/order-list
git tag v1.3.0
git push origin main --tags
```

流程图：

```txt
main ────────────────●───────────────●
        \             ↑               ↑
         \            │               tag v1.3.0
          feature/order-list          上线
```

---

## 4.2 多功能组包上线

适用于多个功能需要一起发布。

流程：

```txt
main
 ↓
release/2026-05-27
 ↑
feature/order-list
feature/payment
feature/coupon
 ↓
release 测试
 ↓
从 release 构建上线
 ↓
release 合回 main
 ↓
main 打 tag
```

示例：

```bash
git checkout main
git pull origin main
git checkout -b release/2026-05-27

git merge feature/order-list
git merge feature/payment
git merge feature/coupon
```

测试通过后：

```bash
git checkout main
git pull origin main
git merge release/2026-05-27
git tag v1.3.0
git push origin main --tags
```

流程图：

```txt
main ────────────────●────────────────────●
        \             \                    ↑
         \             release/2026-05-27  tag v1.3.0
          \              ↑   ↑   ↑
           \             │   │   │
            feature/a────┘   │   │
            feature/b────────┘   │
            feature/c────────────┘
```

---

## 4.3 线上紧急修复

适用于生产环境 bug 修复。

流程：

```txt
main
 ↓
hotfix/login-error
 ↓
修复问题
 ↓
测试通过
 ↓
merge main
 ↓
上线
 ↓
打 tag
```

示例：

```bash
git checkout main
git pull origin main
git checkout -b hotfix/login-error
```

修复后：

```bash
git checkout main
git merge hotfix/login-error
git tag v1.3.1
git push origin main --tags
```

如果当前存在 release 分支：

```bash
git checkout release/2026-05-27
git merge hotfix/login-error
git push origin release/2026-05-27
```

---

# 5. 分支流转规则

## 5.1 feature 合入 main 的条件

feature 必须满足以下条件，才允许合入 `main`：

```txt
1. 开发完成。
2. 自测完成。
3. 测试环境验证通过。
4. 没有阻塞级 bug。
5. Code Review 通过。
6. CI 通过。
7. 产品或业务确认可以上线。
```

未满足条件时，feature 只能停留在自己的分支或临时测试环境中。

---

## 5.2 feature 合入 release 的条件

feature 必须满足以下条件，才允许合入 `release`：

```txt
1. 该功能确定属于本次发布范围。
2. 功能已经完成测试或进入发布测试阶段。
3. 产品、测试、研发确认本次要带上该功能。
4. 该功能不会强依赖未上线功能。
```

禁止将“可能上线”的功能提前合入 release。

---

## 5.3 release 合入 main 的条件

release 必须满足以下条件，才允许合入 `main`：

```txt
1. release 分支测试通过。
2. 本次发布范围确认无误。
3. 没有阻塞级 bug。
4. 发布负责人确认可以上线。
5. CI 通过。
6. 已准备好版本号和 tag。
```

---

# 6. 版本 tag 规范

每次生产发布都必须打 tag。

推荐格式：

```txt
v主版本.次版本.修订版本
```

示例：

```txt
v1.0.0
v1.1.0
v1.1.1
v2.0.0
```

含义：

```txt
主版本：有重大架构变化或不兼容升级
次版本：新增功能
修订版本：bugfix、hotfix、小改动
```

示例：

```bash
git tag v1.3.0
git push origin v1.3.0
```

查看 tag：

```bash
git tag
```

回滚到某个 tag：

```bash
git checkout v1.3.0
```

---

# 7. 回滚策略

## 7.1 推荐回滚方式

推荐基于 tag 回滚。

每次上线后，`tag` 都代表一次线上版本快照。

例如当前线上版本是：

```txt
v1.3.1
```

如果出现严重问题，需要回滚到：

```txt
v1.3.0
```

可以通过 CI/CD 选择 `v1.3.0` 重新构建发布。

---

## 7.2 不推荐的回滚方式

不推荐在生产环境随意选择某个未标记 commit 回滚。

原因：

```txt
1. 不容易确认该 commit 对应哪个发布版本。
2. 不方便追踪线上问题。
3. 不方便审计发布历史。
4. 可能回滚到一个未完整测试的中间状态。
```

---

# 8. 常见场景处理

## 8.1 feature1 没测完，feature2 急着上线

错误流程：

```txt
feature1 → develop
feature2 → develop
develop → release
```

这样会导致 feature2 被迫带上 feature1。

正确流程：

```txt
feature1 继续留在 feature/feature1
feature2 独立测试
feature2 测试通过后合入 main
main 发布上线
```

或者：

```txt
main → release/feature2
feature2 → release/feature2
release/feature2 测试通过
release/feature2 → main
main 上线
```

---

## 8.2 feature1 和 feature2 需要联调，但不确定是否一起上线

可以创建临时联调分支：

```txt
integration/feature1-feature2
```

流程：

```txt
feature1 → integration/feature1-feature2
feature2 → integration/feature1-feature2
```

但发布时不能直接发 `integration`。

真正发布仍然要看各自是否测试通过：

```txt
feature1 测试通过 → main 或 release
feature2 未测试通过 → 继续留在 feature2
```

---

## 8.3 release 测试时发现 bug

如果 bug 属于某个 feature，建议回到 feature 分支修复，然后再合入 release。

流程：

```txt
feature/order-list 修复 bug
 ↓
merge release/2026-05-27
 ↓
release 回归测试
```

如果 bug 只存在于 release 组包阶段，也可以直接在 release 分支修复。

但发布后必须保证修复内容进入 main：

```txt
release → main
```

---

## 8.4 线上出现 bug，但 release 还在测试

先从 `main` 拉 `hotfix` 修复线上问题：

```txt
main → hotfix/login-error
hotfix/login-error → main
main 上线
```

然后把 hotfix 同步到正在测试的 release：

```txt
hotfix/login-error → release/2026-05-27
```

这样可以避免 release 上线时覆盖掉 hotfix。

---

# 9. 推荐的 CI/CD 规则

## 9.1 main 分支

`main` 合入后：

```txt
1. 自动安装依赖。
2. 自动执行 lint。
3. 自动执行类型检查。
4. 自动执行单元测试。
5. 自动构建产物。
6. 可选择自动部署生产，或等待人工确认。
```

---

## 9.2 feature 分支

`feature/*` 推送后：

```txt
1. 自动执行 lint。
2. 自动执行类型检查。
3. 自动执行单元测试。
4. 可选择自动部署临时测试环境。
```

---

## 9.3 release 分支

`release/*` 推送后：

```txt
1. 自动执行完整 CI。
2. 自动构建测试包。
3. 自动部署预发环境。
4. 禁止非本次发布范围功能进入 release。
```

---

## 9.4 hotfix 分支

`hotfix/*` 推送后：

```txt
1. 自动执行基础 CI。
2. 优先部署测试环境验证。
3. 验证通过后快速合入 main。
```

---

# 10. 分支保护建议

## main 分支保护

建议配置：

```txt
1. 禁止直接 push。
2. 必须通过 MR / PR。
3. 必须至少 1 人 Review。
4. 必须通过 CI。
5. 必须解决所有冲突。
6. 不允许 force push。
7. 不允许删除 main。
```

---

## release 分支保护

建议配置：

```txt
1. 禁止无关人员直接 push。
2. 合入 release 必须确认发布范围。
3. release 上的变更必须经过测试确认。
4. 不允许随意 merge 未确认上线的 feature。
```

---

## tag 保护

建议保护生产 tag：

```txt
v*
```

规则：

```txt
1. 只有发布负责人可以创建 tag。
2. 禁止删除已发布 tag。
3. 禁止覆盖已有 tag。
```

---

# 11. 团队协作约定

## 11.1 开发人员

开发人员负责：

```txt
1. 从 main 拉 feature 分支。
2. 保持 feature 分支职责单一。
3. 开发完成后自测。
4. 及时同步 main，解决冲突。
5. 提交 MR / PR。
6. 不将未完成代码合入 main。
```

---

## 11.2 测试人员

测试人员负责：

```txt
1. 确认 feature 是否测试通过。
2. 确认 release 发布范围。
3. 对 release 进行回归测试。
4. 确认阻塞级 bug 是否修复。
5. 发布前给出测试结论。
```

---

## 11.3 发布负责人

发布负责人负责：

```txt
1. 确认本次发布范围。
2. 创建 release 分支。
3. 控制哪些 feature 进入 release。
4. 确认上线时机。
5. 合并 release 到 main。
6. 创建 tag。
7. 删除已完成 release 分支。
```

---

# 12. 最终推荐模型

项目最终推荐分支模型：

```txt
main
feature/*
release/*
hotfix/*
integration/*
```

其中：

```txt
main         线上稳定分支
feature/*    功能开发分支
release/*    临时发布分支，只在组包发布时使用
hotfix/*     线上紧急修复分支
integration/* 临时联调分支，不作为发布来源
```

不再推荐：

```txt
develop
```

或者说：

```txt
develop 不再作为核心分支，也不再作为发布来源。
```

---

# 13. 一句话原则

团队可以把下面这几条作为核心原则：

```txt
1. main 永远代表线上最新稳定代码。

2. feature 从 main 拉出，测试通过后才允许进入发布流程。

3. release 只从 main 拉出，只合入本次确定要上线的 feature。

4. develop 不再作为发布来源。

5. integration 只用于联调，不能用于上线。

6. 生产发布最终必须落到 main。

7. 每次上线必须打 tag。

8. 未确认上线的代码，不允许进入 main 或 release。
```

最重要的一句话：

> **谁要上线，谁进入发布分支；谁没测完，谁留在自己的 feature 分支。**
