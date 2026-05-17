---
title: 'GitLab CI/CD 配置文件完全指南'
date: 2026-05-13
tags: ['DevOps', 'GitLab', 'CI/CD', '自动化']
description: '全面解析 .gitlab-ci.yml 的作用、常用字段和配置示例，帮助理解持续集成与持续部署的核心概念'
draft: false
---

`gitlab.yml` 一般指的是 **GitLab CI/CD 配置文件**，标准文件名通常是：

```text
.gitlab-ci.yml
```

它的作用是：**告诉 GitLab 在你提交代码后，要自动执行哪些流程**。

比如：

```text
拉代码
安装依赖
检查代码
运行测试
打包项目
构建 Docker 镜像
部署到服务器
```

---

## 一句话理解

如果你用前端类比：

```text
.gitlab-ci.yml ≈ 项目的自动化脚本说明书
```

你提交代码后，GitLab 会根据这个文件自动跑任务。

---

## 它主要用来做什么？

常见用途有：

```text
自动安装依赖
自动运行单元测试
自动构建前端项目
自动打包 Spring Boot 项目
自动构建 Docker 镜像
自动部署测试环境 / 生产环境
```

比如你 push 代码到 GitLab：

```text
git push
   ↓
GitLab 读取 .gitlab-ci.yml
   ↓
执行 test 阶段
   ↓
执行 build 阶段
   ↓
执行 deploy 阶段
```

---

## 一个前端项目例子

```yaml
stages:
  - install
  - build

install:
  stage: install
  image: node:20
  script:
    - npm install

build:
  stage: build
  image: node:20
  script:
    - npm run build
```

意思是：

```text
先安装依赖
再执行 npm run build
```

---

## 一个 Java / Spring Boot 项目例子

```yaml
stages:
  - test
  - build

test:
  stage: test
  image: maven:3.9-eclipse-temurin-17
  script:
    - mvn test

build:
  stage: build
  image: maven:3.9-eclipse-temurin-17
  script:
    - mvn clean package -DskipTests
```

意思是：

```text
先跑测试
再用 Maven 打包
```

---

## 常见字段是什么意思？

| 字段               | 作用                           |
| ---------------- | ---------------------------- |
| `stages`         | 定义流水线阶段，比如 test、build、deploy |
| `image`          | 使用哪个 Docker 镜像运行任务           |
| `script`         | 实际执行的命令                      |
| `only` / `rules` | 控制什么时候执行                     |
| `artifacts`      | 保存构建产物，比如 dist、jar 包         |
| `variables`      | 定义环境变量                       |
| `cache`          | 缓存依赖，加快构建速度                  |

---

## 比如这个配置

```yaml
stages:
  - build
  - deploy

build-job:
  stage: build
  image: node:20
  script:
    - npm install
    - npm run build
  artifacts:
    paths:
      - dist/

deploy-job:
  stage: deploy
  script:
    - echo "部署到服务器"
```

它的含义是：

```text
1. 使用 node:20 环境
2. 安装前端依赖
3. 执行 npm run build
4. 保存 dist 目录
5. 再执行部署任务
```

---

## 和 GitHub Actions 类比

如果你听过 GitHub Actions：

```text
GitLab 的 .gitlab-ci.yml ≈ GitHub 的 .github/workflows/xxx.yml
```

它们都是 CI/CD 自动化配置文件。

---

## CI/CD 是什么？

### CI：持续集成

每次提交代码后自动检查：

```text
代码能不能编译？
测试能不能通过？
有没有语法错误？
```

### CD：持续部署 / 持续交付

检查通过后自动部署：

```text
部署到测试环境
部署到预发布环境
部署到生产环境
```

---

## 一句话总结

**`.gitlab-ci.yml` 是 GitLab 的自动化流水线配置文件，用来定义项目在提交代码后如何自动测试、构建、打包和部署。**

你可以把它理解成：

```text
GitLab 看到这个文件后，就知道该怎么帮你自动跑项目流程
```
