---
title: 'go.sum 的作用：Go 依赖的完整性校验清单'
date: 2026-09-06
tags: ['Go', 'go.mod', 'go.sum', '依赖管理']
description: '理解 go.sum 与 go.mod 的分工：go.mod 记录需要什么依赖，go.sum 校验依赖内容是否被篡改'
draft: false
---

`go.sum` 可以简单理解成：

> **Go 依赖的“完整性校验清单”。**

### `go.mod` 和 `go.sum` 的区别

```text
go.mod
↓
我这个项目“需要什么依赖、什么版本”

go.sum
↓
这些依赖文件“具体是什么内容，是否被篡改”
```

比如 `go.mod`：

```go
require (
    github.com/gin-gonic/gin v1.10.0
)
```

`go.sum` 会记录类似：

```text
github.com/gin-gonic/gin v1.10.0 h1:xxxxx
github.com/gin-gonic/gin v1.10.0/go.mod h1:yyyyy
```

这里的 `h1:xxxxx` 是依赖内容的 hash。

### 为什么需要它？

主要解决两个问题：

**1. 保证依赖一致**

你今天下载的：

```text
gin v1.10.0
```

和别人明天下载的，应该是同一份内容。

**2. 防止依赖被偷偷修改**

如果下载到的依赖内容和 `go.sum` 中记录的 hash 不一致，Go 会报错，而不是悄悄使用。

---

### 开发时你基本不用手动管

正常：

```bash
go get xxx
go mod tidy
```

Go 会自动维护：

```text
go.mod
go.sum
```

一般来说，**两个文件都应该提交 Git**：

```text
go.mod
go.sum
```

不要把 `go.sum` 加进 `.gitignore`。

---

### 一个容易混淆的点

`go.sum` **不是锁文件（lock file）**。

很多人会把它类比成：

```text
package-lock.json
yarn.lock
pnpm-lock.yaml
```

但 Go 的机制不完全一样。

**真正决定直接依赖版本的是 `go.mod`；`go.sum` 主要负责校验依赖模块的内容。**

所以你做 Go Admin 项目时，简单记：

> **`go.mod` 管依赖声明，`go.sum` 管依赖完整性。**
