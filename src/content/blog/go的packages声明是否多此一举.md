---
title: 'Go 的 package 声明是不是多此一举'
date: 2026-09-06
tags: ['Go', 'package', '目录结构', '基础语法']
description: '既然目录能体现包路径，为什么还要在文件里写 package 声明？讨论 Go 包声明存在的必要性'
draft: false
---

> 为什么要写packages types，不是已经在文件夹了吗，有路径就能知道吧，是不是多此一举

对，你这个理解**基本是对的**：从文件系统角度看，`package types` 确实有点“重复”。

比如：

```text
internal/types/
├── user.go
├── role.go
└── permission.go
```

`user.go` 里面：

```go
package types

type UserInfo struct {
    ID       int
    Username string
}
```

你会觉得：

> 文件已经在 `types/` 目录了，Go 编译器直接知道它属于 types，不就行了吗？

### 关键点：Go 的 `package` 不是给“路径”看的，而是给“编译器定义边界”的

Go 实际上规定：

> **一个目录里的 `.go` 文件，通过 `package xxx` 声明属于哪个 package。**

所以：

```text
internal/types/user.go
internal/types/role.go
```

两个文件都写：

```go
package types
```

Go 就把它们视为**同一个 package**。

于是 `role.go` 可以直接使用 `user.go` 里的类型：

```go
// user.go
package types

type UserInfo struct {
    ID int
}
```

```go
// role.go
package types

type Role struct {
    Users []UserInfo
}
```

不需要：

```go
import "./user"
```

---

### 为什么不直接根据文件夹推断？

因为 **Go 的 package 名字和目录名字并不是必须一样的**。

例如：

```text
internal/model/
├── user.go
└── role.go
```

完全可以：

```go
package types
```

虽然目录叫 `model`，package 却叫 `types`。

甚至：

```text
internal/foo/
    user.go
```

里面：

```go
package bar
```

也是合法的。

所以 Go 的规则是：

```text
目录 → package 的物理组织
package xxx → package 的编译单元/命名空间
```

两者有关，但不是一回事。

---

### 你可以把它理解成 TypeScript

TypeScript：

```text
types/
├── user.ts
└── role.ts
```

文件路径告诉你文件在哪里，但不会自动让它们共享一个 namespace。

Go 则是：

```go
package types
```

相当于明确告诉编译器：

> “这个文件属于 `types` 这个编译单元。”

所以**对开发者来说看起来确实有一点重复，但对 Go 编译器来说不是多余的**。

而且 Go 特意这样设计，可以让：

```text
types/
├── user.go
├── role.go
├── permission.go
└── pagination.go
```

这些文件共同组成一个 `types` package，而不是每个文件都变成一个独立模块。

你可以记一个最简单的规则：

> **目录决定“文件放哪”，`package` 决定“这个文件跟谁是一家人”。**

这也是为什么你不能在同一个目录里写：

```go
// user.go
package types

// role.go
package model
```

正常情况下，同一个目录的 Go 源文件必须属于同一个 package（测试文件有一些特殊规则）。
