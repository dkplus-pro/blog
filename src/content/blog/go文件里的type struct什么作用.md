---
title: 'Go 文件里的 type struct 有什么用'
date: 2026-09-06
tags: ['Go', 'struct', '类型定义', '基础语法']
description: 'Go 结构体的作用：用 type UserInfo struct 定义数据结构，并对比 TypeScript interface'
draft: false
---

> type UserInfo struct有什么用

如果你看到的是：

```go
type UserInfo struct {
    ID       int    `json:"id"`
    Username string `json:"username"`
    Nickname string `json:"nickname"`
}
```

它的作用就是：

> **定义一个名叫 `UserInfo` 的数据结构（结构体），用来描述“用户信息”长什么样。**

可以把它理解成 TypeScript 里的：

```ts
interface UserInfo {
  id: number
  username: string
  nickname: string
}
```

### `struct` 是什么？

```go
type UserInfo struct {
    ID       int
    Username string
}
```

相当于定义了一个“对象模板”。

之后可以创建：

```go
user := UserInfo{
    ID:       1,
    Username: "admin",
}
```

然后：

```go
fmt.Println(user.ID)
fmt.Println(user.Username)
```

### `json:"id"` 又是什么？

例如：

```go
ID int `json:"id"`
```

这是告诉 Go：

> 当这个结构体转换成 JSON 时，字段叫 `id`。

所以：

```go
UserInfo{
    ID: 1,
}
```

转换 JSON 后：

```json
{
  "id": 1
}
```

而不是：

```json
{
  "ID": 1
}
```

### 在你现在的 OpenAPI 项目里尤其重要

你可能会看到：

```go
type UserInfo struct {
    ID       int    `json:"id"`
    Username string `json:"username"`
}
```

它通常就是一个 **API Response DTO**：

```text
GET /api/user/me
        ↓
Go
        ↓
UserInfo
        ↓
JSON
        ↓
前端
```

例如返回：

```json
{
  "id": 1,
  "username": "admin"
}
```

如果你的 OpenAPI 是契约驱动的，那么 `UserInfo` 很可能就是由 OpenAPI 生成出来的 Go 类型，或者反过来被用来描述 API 的 Response。

**简单记：**

```text
type UserInfo struct
        ↓
定义“用户信息这个数据长什么样”
```

它不是函数，也不是执行什么操作，主要就是**定义数据结构**。
