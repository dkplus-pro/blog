---
title: 'gitlab怎么跑cicd'
date: 2026-05-13
tags: ['前端', '后端', '运维', '工程化', '性能优化', '全栈']
description: 'GitLab CI/CD 可以理解成：'
draft: false
---

GitLab CI/CD 可以理解成：

```txt
GitLab 负责触发任务和展示结果
Runner 负责真正跑脚本
.gitlab-ci.yml 负责定义跑什么脚本
```

也就是说，**真正跑命令的机器不是 GitLab 本身，而是 GitLab Runner 所在的机器**。GitLab 官方也说，Runner 是执行 pipeline job 的应用，GitLab 会把 job 分发给可用 Runner，Runner 执行后把结果回传给 GitLab。([GitLab 文档][1])

---

## 1. GitLab CI/CD 是怎么跑起来的

流程是：

```txt
1. 你在项目根目录写 .gitlab-ci.yml
2. 你 push 代码 / 打 tag / 合并 MR
3. GitLab 创建 Pipeline
4. Pipeline 里有多个 Stage
5. 每个 Stage 里有多个 Job
6. GitLab 把 Job 分配给 Runner
7. Runner 拉代码，执行 script
8. 执行结果回传给 GitLab
```

GitLab 官方文档也明确说，`.gitlab-ci.yml` 放在项目根目录，用来定义 stages、jobs 和 scripts；Pipeline 由 stages 和 jobs 组成，stages 定义执行顺序，jobs 定义具体任务。([GitLab 文档][2])

---

## 2. “怎样才有一个机器能让我跑脚本？”

你需要准备一个 **GitLab Runner**。

这个 Runner 可以装在：

```txt
公司服务器
云服务器 ECS / CVM
你自己的本地电脑
Docker 容器
Kubernetes 集群
```

Runner 支持本地执行、Docker 容器执行、SSH、Kubernetes 等方式；官方文档也说 Runner 可以在 Linux、macOS、Windows 上工作，并支持 Bash、PowerShell 等。([GitLab 文档][1])

对你们前端项目，我建议：

```txt
最推荐：Linux 服务器 + Docker Runner
次推荐：Linux 服务器 + Shell Runner
不建议：长期用自己电脑当 Runner
```

---

## 3. Runner 有两种常见执行方式

### 方式 A：Shell Runner

Runner 直接在服务器系统里执行命令：

```bash
pnpm install
pnpm build
```

优点：

```txt
简单
速度快
容易理解
```

缺点：

```txt
环境容易被污染
多个项目依赖可能冲突
Node / pnpm / Java / coscli 都要自己装在机器上
```

适合小团队刚开始。

---

### 方式 B：Docker Runner

每个 job 在 Docker 容器里执行：

```yaml
image: node:20
```

优点：

```txt
环境干净
可复现
不同项目互不污染
更适合团队长期使用
```

缺点：

```txt
需要懂 Docker
如果要部署到服务器/COS/CDN，需要处理凭证和工具镜像
```

GitLab 官方 Executor 文档也把 Docker、Kubernetes、Shell 等列为 Runner 可选执行环境，其中 Docker 适合容器化构建，Shell 则直接用 Bash/Zsh/PowerShell 跑命令。([GitLab 文档][3])

---

## 4. 最小可用搭建流程

假设你们 GitLab 是：

```txt
https://dev.ai4love.cn
```

你准备一台 Linux 云服务器。

### 第一步：安装 GitLab Runner

可以直接在服务器安装 `gitlab-runner`，也可以用 Docker 跑 Runner。官方注册文档提供了两种方式：直接运行 `gitlab-runner register`，或者用 `gitlab/gitlab-runner` Docker 容器注册。([GitLab 文档][4])

Docker 方式大概是：

```bash
docker run -d --name gitlab-runner --restart always \
  -v /srv/gitlab-runner/config:/etc/gitlab-runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gitlab/gitlab-runner:latest
```

### 第二步：在 GitLab 创建 Runner Token

进入项目：

```txt
Project -> Settings -> CI/CD -> Runners
```

创建一个 Project Runner，拿到 token。

现在推荐用 Runner authentication token，GitLab 文档里说这个 token 前缀通常是 `glrt-`。([GitLab 文档][4])

### 第三步：注册 Runner

```bash
docker run --rm -it \
  -v /srv/gitlab-runner/config:/etc/gitlab-runner \
  gitlab/gitlab-runner register
```

按提示填：

```txt
GitLab URL: https://dev.ai4love.cn
Token: glrt-xxxx
Description: fe-runner
Tags: fe,node20
Executor: docker
Default image: node:20
```

官方也给了非交互注册示例：`gitlab-runner register --url ... --token ... --executor docker --docker-image alpine:latest`。([GitLab 文档][4])

---

## 5. 项目里写 `.gitlab-ci.yml`

比如你的前端 monorepo：

```yaml
stages:
  - check
  - build

default:
  image: node:20
  tags:
    - fe
    - node20
  before_script:
    - corepack enable
    - corepack prepare pnpm@9.15.0 --activate
    - pnpm -v
    - pnpm install --frozen-lockfile

lint:
  stage: check
  script:
    - pnpm lint
    - pnpm typecheck

build_mp:
  stage: build
  script:
    - pnpm --filter mp-a build:mp-weixin
  artifacts:
    paths:
      - apps/mp-a/unpackage/dist/build/mp-weixin
    expire_in: 7 days
```

这就表示：

```txt
有代码 push 后
Runner 会启动 node:20 容器
安装 pnpm
安装依赖
跑 lint/typecheck
再构建小程序产物
最后把产物作为 artifacts 保存
```

---

## 6. 如果你要自动部署

比如你们前端构建后要同步到 COS/CDN，可以再加：

```yaml
deploy_test:
  stage: build
  image: dev.ai4love.cn/registry/gitlab-ci/qcloud-cos-tools:node20
  tags:
    - fe
    - node20
  rules:
    - if: '$CI_COMMIT_BRANCH =~ /^(release|hotfix)\/.*$/'
  script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - pnpm run build:release
    - coscli_config
    - cos_sync_delete
    - cdn_purge_url
```

你之前那个 GitLab CI 里已经有类似：

```txt
COS_TEST_BUCKET
COS_TEST_PREFIX
CDN_PURGE_URL_TEST
```

这些应该放在 GitLab 的：

```txt
Settings -> CI/CD -> Variables
```

不要写死在仓库里。GitLab 官方也说明，CI/CD variables 可以用来存配置和敏感信息，比如密码或 API key，并支持 masked、protected 等安全设置。([GitLab 文档][2])

---

## 7. 你到底需要准备什么？

最小配置是：

```txt
1 台 Linux 机器
Docker
GitLab Runner
Runner Token
.gitlab-ci.yml
```

前端项目建议这台机器配置：

```txt
2 核 4G 起步
磁盘 40G+
能访问 GitLab
能访问 npm/pnpm registry
能访问部署目标，比如 COS/CDN/服务器
```

如果构建小程序、monorepo、node_modules 很大，建议：

```txt
4 核 8G
磁盘 80G+
```

---

## 8. 我建议你们前端团队这样落地

第一阶段，不要搞复杂：

```txt
一台云服务器
一个 Docker Runner
一个 fe,node20 tag
CI 只跑 lint + build
```

第二阶段再加：

```txt
pnpm 缓存
构建产物 artifacts
release/hotfix 自动部署测试环境
tag 自动部署生产环境
```

第三阶段再加：

```txt
多个 Runner
不同 tag 区分前端/后端/部署
缓存优化
失败通知
权限隔离
```

---

## 一句话总结

```txt
GitLab CI/CD 本身不提供“跑脚本的机器”；
你需要注册一个 GitLab Runner。
Runner 装在哪台机器上，脚本就在哪台机器或它启动的 Docker 容器里跑。
```

对你们前端 monorepo，我最推荐：

```txt
Linux 云服务器 + Docker GitLab Runner + node:20 镜像 + .gitlab-ci.yml
```

[1]: https://docs.gitlab.com/runner/ "GitLab Runner | GitLab Docs"
[2]: https://docs.gitlab.com/ci/ "Get started with GitLab CI/CD | GitLab Docs"
[3]: https://docs.gitlab.com/runner/executors/ "Executors | GitLab Docs"
[4]: https://docs.gitlab.com/runner/register/ "Registering runners | GitLab Docs"
