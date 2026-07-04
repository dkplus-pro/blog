---
title: 'Docker 常用命令：掌握 Dockerfile 的核心指令'
date: 2026-07-04
tags: ['Docker', 'Dockerfile', '命令', '部署', '容器化']
description: '梳理 Dockerfile 中 FROM、WORKDIR、COPY、RUN、ENV、CMD 等常见指令，帮助理解 Node 服务镜像构建的基本流程'
draft: false
---

## 掌握 Dockerfile 的常见指令：FROM、WORKDIR、COPY、RUN、ENV、CMD

Dockerfile 本质上是一份镜像构建说明书。要写好 Dockerfile，首先要掌握几个最常用的指令：`FROM`、`WORKDIR`、`COPY`、`RUN`、`ENV`、`CMD`。

这些指令基本覆盖了一个 Node 服务从选择运行环境、复制代码、安装依赖、设置环境变量到最终启动服务的完整过程。

### 1. FROM：指定基础镜像

`FROM` 用来指定当前镜像基于哪个基础镜像构建。

例如：

```dockerfile
FROM node:20-alpine
```

这表示当前项目会基于 Node.js 20 的 Alpine Linux 环境运行。

常见写法：

```dockerfile
FROM node:20
FROM node:20-alpine
FROM nginx:alpine
FROM ubuntu:22.04
```

对于 Node 服务来说，常用：

```dockerfile
FROM node:20-alpine
```

`alpine` 版本体积更小，适合生产部署。但如果项目依赖一些系统库，`alpine` 可能会遇到兼容问题，这时可以使用普通版本：

```dockerfile
FROM node:20
```

### 2. WORKDIR：指定工作目录

`WORKDIR` 用来设置容器内部的工作目录。

例如：

```dockerfile
WORKDIR /app
```

后续的 `COPY`、`RUN`、`CMD` 等命令，都会默认在 `/app` 目录下执行。

如果不写 `WORKDIR`，文件可能会复制到默认目录，后续命令也容易混乱。

推荐每个 Dockerfile 都明确写：

```dockerfile
WORKDIR /app
```

这样结构更清晰。

### 3. COPY：复制文件到镜像中

`COPY` 用来把本地项目文件复制到 Docker 镜像里。

例如：

```dockerfile
COPY package*.json ./
```

表示把当前目录下的 `package.json`、`package-lock.json` 复制到容器的当前工作目录。

再比如：

```dockerfile
COPY . .
```

表示把当前项目目录下的所有文件复制到容器当前目录。

Node 项目里常见写法是：

```dockerfile
COPY package*.json ./
RUN npm install
COPY . .
```

为什么不直接先 `COPY . .`？

因为 Docker 构建有缓存机制。先复制 `package.json`，再安装依赖，如果业务代码变化但依赖没变，Docker 可以复用依赖安装缓存，加快构建速度。

### 4. RUN：构建镜像时执行命令

`RUN` 用来在构建镜像阶段执行命令。

例如：

```dockerfile
RUN npm install
```

或者：

```dockerfile
RUN npm run build
```

注意，`RUN` 是在 `docker build` 阶段执行的，不是容器启动时执行的。

常见用途：

```dockerfile
RUN npm install
RUN npm run build
RUN apk add --no-cache curl
RUN apt-get update && apt-get install -y nginx
```

对于 Node 服务来说，常见流程是：

```dockerfile
RUN npm install
RUN npm run build
```

如果是生产环境，可以只安装生产依赖：

```dockerfile
RUN npm install --omit=dev
```

### 5. ENV：设置环境变量

`ENV` 用来在镜像中设置环境变量。

例如：

```dockerfile
ENV NODE_ENV=production
```

这表示容器运行时，`NODE_ENV` 的值默认为 `production`。

Node 服务中经常会根据 `NODE_ENV` 判断当前环境：

```js
console.log(process.env.NODE_ENV);
```

也可以设置多个环境变量：

```dockerfile
ENV NODE_ENV=production
ENV PORT=3000
```

不过敏感信息不要直接写进 Dockerfile，比如：

```dockerfile
ENV DB_PASSWORD=123456
```

这种不推荐。

数据库密码、密钥、Token 等应该通过运行容器时传入：

```bash
docker run -e DB_PASSWORD=xxx node-api
```

或者通过 CI/CD、环境变量管理、Kubernetes Secret 等方式管理。

### 6. CMD：指定容器启动命令

`CMD` 用来指定容器启动时默认执行的命令。

例如：

```dockerfile
CMD ["node", "server.js"]
```

如果是构建后的 Node 服务：

```dockerfile
CMD ["node", "dist/main.js"]
```

`CMD` 和 `RUN` 不一样。

```txt
RUN：构建镜像时执行
CMD：容器启动时执行
```

比如：

```dockerfile
RUN npm run build
CMD ["node", "dist/main.js"]
```

含义是：

```txt
构建镜像时执行 npm run build
容器启动时执行 node dist/main.js
```

`CMD` 推荐使用数组形式：

```dockerfile
CMD ["node", "dist/main.js"]
```

不推荐写成：

```dockerfile
CMD node dist/main.js
```

数组形式更稳定，也更符合 Docker 推荐写法。

## 一个完整示例

下面是一个简单 Node 服务的 Dockerfile：

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
```

这份 Dockerfile 的含义是：

```txt
1. 使用 Node 20 Alpine 作为基础环境
2. 设置容器工作目录为 /app
3. 复制 package.json 到容器中
4. 安装项目依赖
5. 复制完整项目代码
6. 设置 NODE_ENV 为 production
7. 声明服务端口为 3000
8. 容器启动时执行 node server.js
```

如果是 TypeScript 或 NestJS 项目，可能会写成：

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

## 总结

这几个指令可以这样记：

```txt
FROM：基于什么环境
WORKDIR：在哪个目录工作
COPY：复制哪些文件进去
RUN：构建镜像时执行什么命令
ENV：设置什么环境变量
CMD：容器启动时执行什么命令
```

掌握这几个指令后，就可以写出大多数 Node 服务的基础 Dockerfile。

一个 Dockerfile 的典型顺序通常是：

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

这就是一个 Node 服务容器化部署的基本骨架。
