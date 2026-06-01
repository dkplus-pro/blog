---
title: 'WSL 开发小程序：源码放 WSL，产物同步到 Windows'
date: 2026-05-24
tags: ['WSL', 'Windows', '小程序', '前端', '工程化']
description: 'Windows 上使用 WSL 开发小程序的推荐工作流：源码放 WSL，编译产物同步到 Windows，再由微信开发者工具打开'
draft: false
---

# WSL 开发小程序：源码放 WSL，产物同步到 Windows 的工作流

## 1. 背景

在 Windows 上开发前端项目时，经常会遇到两个矛盾：

一方面，Node、pnpm、Git、Vite、uni-app 等工具在 WSL 的 Linux 环境中运行更顺畅，尤其是处理 `node_modules`、`.git`、依赖扫描、热更新、类型检查这类大量小文件读写的场景。

另一方面，微信开发者工具是 Windows 程序，它更适合打开 Windows 本地路径，例如：

```text
D:\wechat-preview\my-miniapp
```

如果直接把整个项目放在 Windows 盘里，然后通过 WSL 的 `/mnt/d` 访问，虽然路径方便，但编译速度可能变慢。

如果直接让微信开发者工具打开 WSL 路径，例如：

```text
\\wsl.localhost\Ubuntu\home\xxx\code\my-miniapp\dist\dev\mp-weixin
```

有时候又可能遇到路径兼容、文件监听、刷新不稳定的问题。

因此更推荐采用这套工作流：

```text
源码放 WSL /home
WSL 内完成安装、开发、编译
只把小程序产物同步到 Windows 目录
微信开发者工具打开 Windows 产物目录
```

## 2. 最终目标

我们希望形成这样的目录结构：

```text
WSL 源码目录：
/home/xxx/code/my-miniapp

小程序开发产物：
/home/xxx/code/my-miniapp/dist/dev/mp-weixin

同步到 Windows 后的目录：
/mnt/d/wechat-preview/my-miniapp

Windows 中实际路径：
D:\wechat-preview\my-miniapp
```

微信开发者工具最终打开：

```text
D:\wechat-preview\my-miniapp
```

而不是打开源码根目录。

## 3. 为什么源码建议放 WSL 的 /home 目录

前端项目的编译过程会频繁读写大量小文件，例如：

```text
node_modules
.git
src
dist
.cache
eslint 缓存
vite / webpack 缓存
TypeScript 类型文件
```

如果项目放在 Windows 盘，比如：

```text
/mnt/d/code/my-miniapp
```

那么 WSL 中的 Node、pnpm、Git 实际是在跨系统访问 Windows 文件系统。

这种方式能用，但在大量小文件读写场景下，通常不如直接访问 WSL 自己的 Linux 文件系统快。

更推荐把源码放在：

```text
/home/xxx/code/my-miniapp
```

这样：

```text
pnpm install 更快
git status 更快
pnpm dev 更快
热更新更稳定
依赖扫描更顺
node_modules 操作更快
```

## 4. 为什么不建议把整个项目同步到 Windows

不要直接同步整个项目：

```bash
rsync -av ./ /mnt/d/code/my-miniapp/
```

这样会把很多不需要给微信开发者工具看的内容也同步过去：

```text
node_modules
.git
src
package.json
pnpm-lock.yaml
各种缓存文件
临时文件
```

这样有几个问题：

```text
同步慢
占空间
容易产生两份源码
容易误改 Windows 那份代码
容易让团队成员分不清真正源码在哪
```

微信开发者工具真正需要的只是小程序编译产物。

所以应该只同步：

```text
dist/dev/mp-weixin
```

或者正式构建时同步：

```text
dist/build/mp-weixin
```

## 5. 推荐工作流

完整流程如下：

```text
1. 源码放在 WSL 的 /home/xxx/code/my-miniapp
2. 使用 VS Code WSL 模式打开项目
3. 在 WSL 终端执行 pnpm install
4. 在 WSL 终端执行 pnpm dev:mp-weixin
5. 将 dist/dev/mp-weixin 同步到 /mnt/d/wechat-preview/my-miniapp
6. 微信开发者工具打开 D:\wechat-preview\my-miniapp
```

整体链路：

```text
WSL 源码
  ↓
WSL 编译
  ↓
dist/dev/mp-weixin
  ↓
rsync 同步
  ↓
D:\wechat-preview\my-miniapp
  ↓
微信开发者工具预览
```

## 6. 初始化项目目录

在 WSL 中创建源码目录：

```bash
mkdir -p ~/code
cd ~/code
git clone <你的仓库地址> my-miniapp
cd my-miniapp
```

安装依赖：

```bash
pnpm install
```

使用 VS Code WSL 模式打开：

```bash
code .
```

打开后，VS Code 左下角应该显示类似：

```text
WSL: Ubuntu
```

这表示当前 VS Code 窗口已经连接到 WSL 环境。

## 7. 编译微信小程序产物

以 uni-app 项目为例，开发模式通常输出到：

```text
dist/dev/mp-weixin
```

执行：

```bash
pnpm dev:mp-weixin
```

如果是正式构建，一般输出到：

```text
dist/build/mp-weixin
```

执行：

```bash
pnpm build:mp-weixin
```

具体命令以项目 `package.json` 中的 scripts 为准。

例如：

```json
{
  "scripts": {
    "dev:mp-weixin": "uni -p mp-weixin",
    "build:mp-weixin": "uni build -p mp-weixin"
  }
}
```

## 8. 安装 rsync

同步产物建议使用 `rsync`。

在 WSL 中安装：

```bash
sudo apt update
sudo apt install -y rsync
```

`rsync` 的好处是：

```text
只同步有变化的文件
支持删除目标目录多余文件
适合重复同步 dist 产物
比每次完整复制更稳定
```

## 9. 编写同步脚本

在项目根目录新建：

```text
scripts/sync-mp-weixin.sh
```

内容如下：

```bash
#!/usr/bin/env bash

set -e

SOURCE_DIR="./dist/dev/mp-weixin/"
TARGET_DIR="/mnt/d/wechat-preview/my-miniapp/"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "同步失败：未找到小程序产物目录：$SOURCE_DIR"
  echo "请先执行 pnpm dev:mp-weixin"
  exit 1
fi

mkdir -p "$TARGET_DIR"

rsync -av --delete "$SOURCE_DIR" "$TARGET_DIR"

echo "同步完成：$TARGET_DIR"
echo "Windows 路径：D:\\wechat-preview\\my-miniapp"
```

添加执行权限：

```bash
chmod +x scripts/sync-mp-weixin.sh
```

手动同步：

```bash
./scripts/sync-mp-weixin.sh
```

## 10. 配置 package.json 命令

在 `package.json` 中增加：

```json
{
  "scripts": {
    "dev:mp-weixin": "uni -p mp-weixin",
    "build:mp-weixin": "uni build -p mp-weixin",
    "sync:mp-weixin": "bash scripts/sync-mp-weixin.sh"
  }
}
```

开发时可以这样使用：

第一个终端运行编译：

```bash
pnpm dev:mp-weixin
```

第二个终端同步产物：

```bash
pnpm sync:mp-weixin
```

微信开发者工具打开：

```text
D:\wechat-preview\my-miniapp
```

## 11. 自动监听并同步

如果希望每次产物变化后自动同步，可以使用 `chokidar-cli`。

安装：

```bash
pnpm add -D chokidar-cli
```

在 `package.json` 中增加：

```json
{
  "scripts": {
    "dev:mp-weixin": "uni -p mp-weixin",
    "sync:mp-weixin": "bash scripts/sync-mp-weixin.sh",
    "watch:sync:mp-weixin": "chokidar \"dist/dev/mp-weixin/**/*\" -c \"bash scripts/sync-mp-weixin.sh\""
  }
}
```

开发时开启两个终端：

```bash
pnpm dev:mp-weixin
```

另一个终端：

```bash
pnpm watch:sync:mp-weixin
```

这样 WSL 中的小程序产物发生变化后，会自动同步到 Windows 目录。

## 12. 微信开发者工具如何打开

打开微信开发者工具后选择：

```text
导入项目
```

项目目录选择：

```text
D:\wechat-preview\my-miniapp
```

这个目录里应该能看到类似文件：

```text
app.json
project.config.json
pages/
common/
static/
```

如果你看到的是这些：

```text
src/
package.json
vite.config.ts
pages.json
manifest.json
```

说明你打开错了目录。

微信开发者工具要打开的是编译后的微信小程序项目，不是 uni-app 源码根目录。

## 13. 开发时的标准操作流程

日常开发推荐流程：

```text
1. 打开 WSL
2. cd ~/code/my-miniapp
3. code .
4. pnpm dev:mp-weixin
5. pnpm watch:sync:mp-weixin
6. 微信开发者工具打开 D:\wechat-preview\my-miniapp
7. 在 VS Code 中修改源码
8. WSL 自动编译
9. 脚本自动同步
10. 微信开发者工具刷新预览
```

如果不想自动同步，也可以手动同步：

```bash
pnpm sync:mp-weixin
```

## 14. 开发包和正式包分开同步

如果需要同时支持开发包和正式包，可以写两个同步脚本。

开发包同步：

```json
{
  "scripts": {
    "sync:mp-dev": "rsync -av --delete dist/dev/mp-weixin/ /mnt/d/wechat-preview/my-miniapp/"
  }
}
```

正式包同步：

```json
{
  "scripts": {
    "sync:mp-build": "rsync -av --delete dist/build/mp-weixin/ /mnt/d/wechat-preview/my-miniapp-build/"
  }
}
```

对应 Windows 目录：

```text
开发包：
D:\wechat-preview\my-miniapp

正式包：
D:\wechat-preview\my-miniapp-build
```

## 15. 常见问题

### 15.1 微信开发者工具里没有更新

先确认同步脚本是否执行成功：

```bash
pnpm sync:mp-weixin
```

再确认 Windows 目录里的文件是否更新：

```bash
ls -la /mnt/d/wechat-preview/my-miniapp
```

如果文件已经同步，但微信开发者工具没有刷新，可以手动点击：

```text
编译
```

或者重新打开项目。

### 15.2 提示找不到 dist/dev/mp-weixin

说明还没有编译成功。

先执行：

```bash
pnpm dev:mp-weixin
```

等小程序产物生成后，再执行：

```bash
pnpm sync:mp-weixin
```

### 15.3 同步很慢

检查是不是同步了整个项目。

推荐只同步：

```text
dist/dev/mp-weixin/
```

不要同步：

```text
node_modules
.git
src
```

### 15.4 Windows 里能不能直接打开 WSL 路径

可以通过下面路径访问：

```text
\\wsl.localhost\Ubuntu\home\xxx\code\my-miniapp
```

或者：

```text
\\wsl$\Ubuntu\home\xxx\code\my-miniapp
```

但不建议微信开发者工具长期直接打开这个路径。

更稳的方式是：

```text
WSL 编译
同步产物到 D 盘
微信开发者工具打开 D 盘目录
```

### 15.5 能不能把源码也同步到 Windows

不建议。

源码应该只有一份，放在 WSL 中维护。

Windows 目录只作为微信开发者工具的预览产物目录。

否则容易出现：

```text
WSL 一份源码
Windows 一份源码
不知道改的是哪一份
Git 状态混乱
依赖重复安装
```

## 16. 推荐目录规范

建议统一团队目录：

```text
WSL 源码：
~/code/项目名

Windows 小程序预览目录：
D:\wechat-preview\项目名

同步脚本：
scripts/sync-mp-weixin.sh
```

例如：

```text
~/code/mode-miniapp-cangqin
D:\wechat-preview\mode-miniapp-cangqin
scripts/sync-mp-weixin.sh
```

这样每个项目的源码和预览产物边界都很清楚。

## 17. 总结

这套工作流的核心是：

```text
源码在 WSL
编译在 WSL
产物同步到 Windows
微信开发者工具打开 Windows 产物目录
```

优点是：

```text
WSL 编译速度更快
node_modules 和 Git 操作更顺
微信开发者工具路径更稳定
源码和产物隔离清楚
不会污染 Windows 项目目录
团队协作更容易统一
```

一句话总结：

```text
不要让 WSL 去慢慢编译 /mnt/d 里的源码，也不要让微信开发者工具直接打开 WSL 路径。
最稳的是：WSL 管源码和编译，Windows 只接收 mp-weixin 产物。
```
