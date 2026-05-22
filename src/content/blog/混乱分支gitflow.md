---
title: '多分支并行上线下的 Git 分支整理方案'
date: 2026-05-15
tags: ['Git', '工程化', '发布']
description: 'feature/5.13、mp-html 重构与 dev-zc 并行时的 release 节奏、合并顺序与操作命令'
draft: false
---

明白了，新的上线顺序应该是：

```txt
第一优先级：feature/5.13 明天上线
第二优先级：feature/mp-html 重构内容先上线
第三优先级：dev-zc 月底上线
```

所以不能把 `feature/mp-html` 归到 `dev-zc` 里，也不能继续让它挂在旧的 `feature/5.13` 上无限开发。

---

# 一、新的核心原则

```txt
5.13 明天上线，先冻结。
mp-html 要独立成一个中间版本，先于 dev-zc 上线。
dev-zc 保持月底版本，不要提前混入 mp-html 以外的新内容。
```

推荐版本节奏：

```txt
release/5.13        # 明天上线
release/mp-html     # 5.13 之后，dev-zc 之前上线
release/month-end   # dev-zc 月底上线
```

或者用版本号：

```txt
release/5.13
release/5.14        # mp-html 重构版本
release/5.31        # dev-zc 月底版本
```

---

# 二、现在先不要动 dev-zc

`dev-zc` 是月底上线内容，它现在不能作为 `mp-html` 的基础。

原因是：

```txt
dev-zc 里可能包含月底才上线的内容
如果 mp-html 基于 dev-zc 上线
就会把月底内容提前带上线
```

所以：

```txt
mp-html 上线不能 merge dev-zc
mp-html 上线不能基于 dev-zc
mp-html 应该基于 5.13 上线后的 main / develop
```

---

# 三、推荐处理流程

## 阶段 1：今天处理 5.13

先把 `feature/5.13` 转成 release：

```bash
git checkout feature/5.13
git pull origin feature/5.13

git checkout -b release/5.13
git push origin release/5.13
```

从现在开始：

```txt
release/5.13 只修 bug
不加 mp-html
不加 dev-zc
不加重构
不加新功能
```

如果 `dev-zc` 上有明天必须带的 bugfix，只 cherry-pick bugfix：

```bash
git log --oneline release/5.13..dev-zc

git checkout release/5.13
git cherry-pick <必须上线的bugfix-commit>
```

---

## 阶段 2：明天 5.13 上线后，校准 main

因为 `main` 是几个月前的旧代码，上线后要用 `release/5.13` 校准 `main`。

先备份旧 main：

```bash
git checkout main
git pull origin main

git checkout -b backup/main-old-20260512
git push origin backup/main-old-20260512
```

如果 `main` 已经过旧，建议直接校准：

```bash
git checkout main
git reset --hard release/5.13
git push --force-with-lease origin main
```

然后打 tag：

```bash
git tag v5.13.0
git push origin v5.13.0
```

再从最新 `main` 创建 `develop`：

```bash
git checkout main
git pull origin main

git checkout -b develop
git push origin develop
```

到这里，正式主线建立：

```txt
main     = 最新线上 5.13
develop  = 基于最新线上代码的开发主线
```

---

# 四、mp-html 怎么先于 dev-zc 上线

`feature/mp-html` 现在是基于 `feature/5.13` 的。
5.13 上线后，`main/develop` 已经包含 5.13，所以这时可以把 `mp-html` 的差异迁移到新主线。

## 方式一：推荐，用 cherry-pick 迁移 mp-html

先看 `feature/mp-html` 相比 `release/5.13` 多了哪些提交：

```bash
git log --oneline release/5.13..feature/mp-html
```

然后从新的 `develop` 拉一个干净分支：

```bash
git checkout develop
git pull origin develop

git checkout -b feature/mp-html
```

把原来 `feature/mp-html` 已经完成的 commit 迁过来：

```bash
git cherry-pick <mp-html已完成commit1>
git cherry-pick <mp-html已完成commit2>
```

如果还要继续加几个和 `mp-html` 一起上线的新功能，不要继续全塞到一个大分支里，建议拆：

```txt
feature/mp-html
feature/mp-html-feature-a
feature/mp-html-feature-b
feature/mp-html-refactor
```

这些都从 `develop` 拉，开发完合回 `develop`。

---

## 方式二：如果 mp-html 已经很完整，可以直接拉 release

如果 `feature/mp-html` 已经很接近上线，只需要少量 bugfix，也可以从它拉：

```bash
git checkout feature/mp-html
git pull origin feature/mp-html

git checkout -b release/mp-html
git push origin release/mp-html
```

但这个方式有风险，因为它基于旧的 `feature/5.13`，不如 cherry-pick 到新 `develop` 干净。

更推荐：

```txt
先让 5.13 上线
再从最新 develop 重建 feature/mp-html
然后从 develop 拉 release/mp-html
```

---

# 五、mp-html 上线流程

当 `mp-html` 和它要一起上线的新功能都合入 `develop` 后：

```bash
git checkout develop
git pull origin develop

git checkout -b release/mp-html
git push origin release/mp-html
```

或者：

```bash
git checkout -b release/5.14
git push origin release/5.14
```

`release/mp-html` 规则：

```txt
只修 bug
不合 dev-zc
不合月底功能
不继续加大重构
```

测试通过后：

```bash
git checkout main
git merge --no-ff release/mp-html
git push origin main

git tag v5.14.0
git push origin v5.14.0
```

然后同步回 `develop`：

```bash
git checkout develop
git merge --no-ff main
git push origin develop
```

---

# 六、dev-zc 月底上线怎么处理

`dev-zc` 仍然保留为月底候选内容，但不能直接长期作为最终发版分支。

等 `mp-html` 上线完成后：

```txt
main     = 已包含 5.13 + mp-html
develop  = 已包含 5.13 + mp-html
dev-zc   = 原来基于 test 的月底内容
```

这时候再处理 `dev-zc`。

先看 `dev-zc` 相比 `develop` 多了什么：

```bash
git log --oneline develop..dev-zc
```

如果 `dev-zc` 内容干净，可以合入 `develop`：

```bash
git checkout develop
git merge --no-ff dev-zc
git push origin develop
```

如果 `dev-zc` 内容混杂，就不要整体 merge，只 cherry-pick 月底需要的提交：

```bash
git checkout develop
git cherry-pick <dev-zc需要上线commit>
```

月底冻结时，再从 `develop` 拉：

```bash
git checkout develop
git pull origin develop

git checkout -b release/month-end
git push origin release/month-end
```

或者：

```bash
git checkout -b release/5.31
git push origin release/5.31
```

---

# 七、最终时间线

## 今天

```txt
1. 备份 main
2. 备份 test
3. feature/5.13 -> release/5.13
4. release/5.13 只修 bug
5. dev-zc 上如果有 5.13 必须带的 bugfix，只 cherry-pick bugfix
6. feature/mp-html 冻结，不继续加新功能
```

---

## 明天 5.13 上线

```txt
1. release/5.13 上线
2. release/5.13 校准 main
3. 打 tag：v5.13.0
4. 从 main 创建 develop
```

---

## 5.13 上线后，mp-html 先上线

```txt
1. 从 develop 重新创建 feature/mp-html
2. 把旧 feature/mp-html 的有效 commit cherry-pick 过来
3. 其他几个要一起上线的新功能，也从 develop 拉独立 feature
4. 开发完成后合入 develop
5. 从 develop 拉 release/mp-html 或 release/5.14
6. 测试通过后合 main
7. 打 tag：v5.14.0
8. main 同步回 develop
```

---

## 月底 dev-zc 上线

```txt
1. 在 mp-html 已上线后的 develop 基础上处理 dev-zc
2. 将 dev-zc 有效内容 merge 或 cherry-pick 到 develop
3. 月底冻结时拉 release/5.31
4. release/5.31 只修 bug
5. 测试通过后合 main
6. 打 tag：v5.31.0
7. main 同步回 develop
```

---

# 八、调整后的分支优先级

```txt
main
  ↑
release/5.13         # 明天上线
  ↑
feature/5.13

main
  ↑
release/mp-html      # 5.13 后、dev-zc 前上线
  ↑
develop
  ↑
feature/mp-html
feature/mp-html-a
feature/mp-html-b

main
  ↑
release/5.31         # 月底上线
  ↑
develop
  ↑
dev-zc 有效内容
```

---

# 九、这几个分支现在怎么定义

| 分支                | 新定位           | 处理方式                    |
| ----------------- | ------------- | ----------------------- |
| `feature/5.13`    | 历史分支          | 拉出 `release/5.13` 后停止使用 |
| `release/5.13`    | 明天上线分支        | 只修 bug                  |
| `feature/mp-html` | mp-html 旧功能分支 | 冻结，等 5.13 后迁移 commit    |
| `develop`         | 新开发主线         | 5.13 上线后从 main 创建       |
| `release/mp-html` | mp-html 上线分支  | 先于 dev-zc 上线            |
| `dev-zc`          | 月底候选内容        | 暂不合入，等 mp-html 后再迁移     |
| `release/5.31`    | 月底上线分支        | 从 develop 拉出            |

---

# 十、最终建议

你的新规则应该是：

```txt
5.13 明天上线，不再混入任何新功能。
mp-html 要先于 dev-zc 上线，所以它应该单独形成 release/mp-html。
dev-zc 是月底版本，不能作为 mp-html 的基础。
mp-html 后续要基于 5.13 上线后的 develop 重新整理。
```

最关键一句：

```txt
不要让 feature/mp-html 继续基于旧 feature/5.13 往下滚，也不要把它合进 dev-zc。
正确做法是：5.13 上线后，从最新 develop 重建 mp-html 分支，再单独发一个 release/mp-html。
```
