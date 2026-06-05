---
title: '前端项目代码复杂度治理与 CI 落地方案'
date: 2026-06-05
tags: ['前端', '代码质量', 'CI', 'ESLint', '工程化']
description: '总结前端项目中函数复杂度、认知复杂度、重复代码和循环依赖等质量指标的治理方式，并介绍如何通过 ESLint、sonarjs、jscpd、madge 和 GitLab CI 建立自动化质量门禁'
draft: false
---

# 前端项目代码复杂度治理与 CI 落地方案

## 1. 背景

随着前端项目不断迭代，代码复杂度会逐渐上升。常见表现包括：

* 单个文件越来越长；
* 单个函数分支越来越多；
* Store、页面、组件职责混杂；
* 重复代码越来越多；
* 模块之间出现循环依赖；
* Code Review 难以快速判断影响范围；
* Bug 修复容易引发连锁问题。

因此，前端项目需要引入代码复杂度治理机制，并逐步接入 CI，形成自动化质量门禁。

本文主要介绍如何通过以下工具进行治理：

```txt
ESLint + sonarjs：检查函数复杂度、认知复杂度、文件行数、函数行数
jscpd：检查重复代码
madge：检查循环依赖
GitLab CI：自动执行质量检查
```

---

## 2. 需要关注的复杂度指标

前端项目中，建议重点关注以下几类指标：

```txt
函数复杂度：complexity
认知复杂度：sonarjs/cognitive-complexity
函数行数：max-lines-per-function
文件行数：max-lines
嵌套深度：max-depth
参数数量：max-params
重复代码：jscpd
循环依赖：madge
```

其中：

* **函数复杂度** 用于衡量函数中分支、条件、循环的复杂程度；
* **认知复杂度** 更贴近“人读代码时累不累”；
* **文件行数** 可以发现超大页面、超大 Store、超大工具文件；
* **函数行数** 可以发现职责过重的函数；
* **嵌套深度** 可以发现过多 if/else、循环嵌套；
* **参数数量** 可以推动复杂函数收拢为 `options` 对象；
* **重复代码** 可以发现复制粘贴式开发；
* **循环依赖** 可以发现模块边界不清晰的问题。

---

## 3. 安装依赖

如果项目使用 `pnpm`：

```bash
pnpm add -D eslint-plugin-sonarjs jscpd madge
```

如果项目使用 `npm`：

```bash
npm i -D eslint-plugin-sonarjs jscpd madge
```

---

## 4. ESLint 复杂度规则配置

### 4.1 `.eslintrc.cjs` 写法

如果项目使用传统 ESLint 配置：

```js
module.exports = {
  plugins: ['sonarjs'],
  extends: ['plugin:sonarjs/recommended'],
  rules: {
    // 圈复杂度：分支越多，复杂度越高
    complexity: ['warn', 10],

    // 认知复杂度：更贴近代码阅读难度
    'sonarjs/cognitive-complexity': ['warn', 15],

    // 单函数最大行数
    'max-lines-per-function': [
      'warn',
      {
        max: 80,
        skipBlankLines: true,
        skipComments: true,
      },
    ],

    // 单文件最大行数
    'max-lines': [
      'warn',
      {
        max: 500,
        skipBlankLines: true,
        skipComments: true,
      },
    ],

    // 最大嵌套层级
    'max-depth': ['warn', 4],

    // 函数参数数量，超过 2 个建议收拢为 options
    'max-params': ['warn', 2],
  },
}
```

### 4.2 `eslint.config.js` 写法

如果项目使用 Flat Config：

```js
import sonarjs from 'eslint-plugin-sonarjs'

export default [
  {
    plugins: {
      sonarjs,
    },
    rules: {
      complexity: ['warn', 10],

      'sonarjs/cognitive-complexity': ['warn', 15],

      'max-lines-per-function': [
        'warn',
        {
          max: 80,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      'max-lines': [
        'warn',
        {
          max: 500,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      'max-depth': ['warn', 4],

      'max-params': ['warn', 2],
    },
  },
]
```

---

## 5. 推荐阈值

建议先使用相对温和的阈值：

```txt
函数 complexity > 10：需要关注
函数 cognitive-complexity > 15：需要拆分
函数超过 80 行：需要拆分
文件超过 500 行：需要评估拆分
文件超过 800 行：原则上必须拆分
嵌套超过 4 层：需要 early return 或拆函数
参数超过 2 个：建议收拢为 options 对象
```

对于老项目，不建议一开始全部改成 `error`，可以先使用 `warn`，观察一段时间后再逐步收紧。

---

## 6. package.json 脚本配置

可以在 `package.json` 中加入以下脚本：

```json
{
  "scripts": {
    "check:complexity": "eslint \"src/**/*.{ts,vue}\" --max-warnings=0",
    "check:duplicate": "jscpd src --pattern \"**/*.{ts,vue,js}\" --min-lines 10 --min-tokens 80 --reporters console,html --output reports/jscpd",
    "check:circular": "madge src --extensions ts,vue --circular",
    "check:quality": "pnpm check:complexity && pnpm check:duplicate && pnpm check:circular"
  }
}
```

各脚本含义：

```txt
check:complexity
  检查复杂度、函数行数、文件行数、参数数量、嵌套深度

check:duplicate
  检查重复代码，并输出 HTML 报告

check:circular
  检查循环依赖

check:quality
  一次性执行所有质量检查
```

本地执行：

```bash
pnpm check:quality
```

如果项目使用 npm，可以改成：

```json
{
  "scripts": {
    "check:quality": "npm run check:complexity && npm run check:duplicate && npm run check:circular"
  }
}
```

---

## 7. 为什么要加 `--max-warnings=0`

ESLint 默认情况下，`warn` 不会让命令失败。

如果希望在 CI 中把 warning 也当作质量问题，可以使用：

```bash
eslint "src/**/*.{ts,vue}" --max-warnings=0
```

这样只要出现 warning，命令就会以非 0 状态退出，从而让 CI job 失败。

不过在老项目中，前期不建议马上使用强阻塞，可以先观察报告，再逐步启用。

---

## 8. GitLab CI 接入方式

### 8.1 最小可用版本

在 `.gitlab-ci.yml` 中加入质量检查 job：

```yaml
stages:
  - quality
  - build

quality_check:
  stage: quality
  image: node:20-bullseye
  tags:
    - miniapp
  script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - pnpm check:quality
  artifacts:
    when: always
    expire_in: 7 days
    paths:
      - reports/
  rules:
    - if: '$CI_COMMIT_BRANCH'
```

这样每次 push 都会执行：

```txt
ESLint 复杂度检查
jscpd 重复代码检查
madge 循环依赖检查
```

如果检查失败，后续 build 阶段不会继续执行。

---

## 9. 前期不阻塞流水线的方式

如果项目历史问题比较多，建议先让质量检查只告警，不阻塞主流程。

```yaml
quality_check:
  stage: quality
  image: node:20-bullseye
  tags:
    - miniapp
  allow_failure: true
  script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - pnpm check:quality
  artifacts:
    when: always
    expire_in: 7 days
    paths:
      - reports/
```

`allow_failure: true` 的作用是：

```txt
即使 quality_check 失败，pipeline 仍然继续执行。
```

适合第一阶段用于收集问题和观察报告。

---

## 10. 分支差异化卡点

更推荐的方式是按分支分阶段治理。

比如：

```txt
feature 分支：
  质量检查失败只提醒，不阻塞开发

release 分支：
  质量检查失败直接阻塞上线
```

`.gitlab-ci.yml` 示例：

```yaml
stages:
  - quality
  - build

quality_warn:
  stage: quality
  image: node:20-bullseye
  tags:
    - miniapp
  allow_failure: true
  script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - pnpm check:quality
  artifacts:
    when: always
    expire_in: 7 days
    paths:
      - reports/
  rules:
    - if: '$CI_COMMIT_BRANCH != "release"'

quality_block:
  stage: quality
  image: node:20-bullseye
  tags:
    - miniapp
  script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - pnpm check:quality
  artifacts:
    when: always
    expire_in: 7 days
    paths:
      - reports/
  rules:
    - if: '$CI_COMMIT_BRANCH == "release"'
```

这样可以做到：

```txt
普通分支：
  质量问题只作为提醒

release 分支：
  质量问题作为上线卡点
```

---

## 11. 只检查改动文件

对于历史代码问题比较多的项目，直接全量检查可能会导致短期无法落地。

更现实的方式是：

```txt
历史问题先不一次性处理；
新代码和本次改动必须达标。
```

### 11.1 新建脚本

新建：

```txt
scripts/check-changed-files.cjs
```

内容如下：

```js
const { execSync } = require('node:child_process')

function run(command) {
  console.log(`\n> ${command}`)
  execSync(command, {
    stdio: 'inherit',
  })
}

const targetBranch = process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME || 'develop'

const changedFiles = execSync(`git diff --name-only origin/${targetBranch}...HEAD`, {
  encoding: 'utf-8',
})
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => /\.(ts|vue|js)$/.test(file))
  .filter((file) => file.startsWith('src/'))

if (changedFiles.length === 0) {
  console.log('没有需要检查的变更文件')
  process.exit(0)
}

const files = changedFiles.map((file) => `"${file}"`).join(' ')

run(`pnpm eslint ${files} --max-warnings=0`)
run(`pnpm jscpd ${files} --min-lines 10 --min-tokens 80 --reporters console,html --output reports/jscpd`)
```

### 11.2 package.json 增加脚本

```json
{
  "scripts": {
    "check:changed-quality": "node scripts/check-changed-files.cjs"
  }
}
```

### 11.3 GitLab CI 配置

```yaml
quality_changed:
  stage: quality
  image: node:20-bullseye
  tags:
    - miniapp
  script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - git fetch origin develop
    - pnpm check:changed-quality
  artifacts:
    when: always
    expire_in: 7 days
    paths:
      - reports/
  rules:
    - if: '$CI_MERGE_REQUEST_ID'
```

这样只会检查 MR 里的变更文件，适合老项目渐进治理。

---

## 12. 推荐落地策略

建议分四个阶段推进。

### 12.1 第一阶段：只生成报告，不阻塞

目标是了解项目现状。

配置：

```txt
quality_check allow_failure: true
```

执行内容：

```txt
复杂度检查
重复代码检查
循环依赖检查
```

产物：

```txt
reports/jscpd
CI 日志
复杂文件清单
重复代码清单
循环依赖清单
```

### 12.2 第二阶段：release 分支阻塞

目标是保障上线分支质量。

策略：

```txt
feature 分支：失败不阻塞
release 分支：失败阻塞
```

这样不会影响日常开发，但能防止问题进入上线流程。

### 12.3 第三阶段：MR 只检查改动文件

目标是控制新增问题。

策略：

```txt
历史问题暂时不追究；
新增代码必须达标。
```

适合老项目治理。

### 12.4 第四阶段：全量收紧

目标是形成长期质量门禁。

可以逐步把规则从 `warn` 改为 `error`：

```txt
复杂度超限：error
函数过长：error
文件过长：error
循环依赖：error
重复代码超过阈值：error
```

---

## 13. 推荐 CI 最终形态

一个比较完整的质量检查流程可以是：

```yaml
stages:
  - quality
  - build
  - deploy

quality_check:
  stage: quality
  image: node:20-bullseye
  tags:
    - miniapp
  script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - pnpm check:quality
  artifacts:
    when: always
    expire_in: 7 days
    paths:
      - reports/
  rules:
    - if: '$CI_COMMIT_BRANCH == "release"'

build_development:
  stage: build
  image: node:20-bullseye
  tags:
    - miniapp
  needs:
    - quality_check
  script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - pnpm run build:mp-weixin:development
  rules:
    - if: '$CI_COMMIT_BRANCH == "release"'
```

这表示：

```txt
release 分支先跑质量检查；
质量检查通过后才允许构建；
质量检查失败则阻塞后续流程。
```

---

## 14. 注意事项

### 14.1 不要一开始卡太死

如果老项目问题很多，一开始全部阻塞会导致大家无法正常开发。

建议先：

```txt
只告警
再卡 release
再卡 MR 改动文件
最后卡全量
```

### 14.2 不要只看行数

行数只是辅助指标。

真正要看：

```txt
职责是否单一
调用链是否清晰
状态是否混乱
副作用是否太多
是否存在过多分支
是否难以测试
```

### 14.3 复杂度治理要配合重构规范

发现复杂代码后，不能只说“太复杂”，还需要有拆分方向：

```txt
UI 拆 components
状态拆 store / page state
流程拆 biz
接口拆 api / service
复用逻辑拆 composables
纯函数拆 utils
类型拆 types
常量拆 constants
```

### 14.4 CI 质量检查要有报告

建议保留：

```txt
reports/
```

并通过 GitLab artifacts 上传，方便 Review 时查看。

---

## 15. 总结

前端代码复杂度治理的核心不是一次性消灭所有问题，而是建立长期机制。

推荐组合：

```txt
ESLint + sonarjs：检查复杂度
jscpd：检查重复代码
madge：检查循环依赖
GitLab CI：形成自动化质量门禁
```

推荐推进路径：

```txt
先报告
再提醒
再卡 release
再卡 MR
最后全量治理
```

最终目标是：

```txt
新代码不继续变差；
核心分支质量可控；
上线前能发现明显风险；
复杂模块能持续被拆分治理。
```
