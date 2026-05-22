---
title: 'Windows 下输出 Git 新增文件树形结构'
date: 2026-05-21
tags: ['Git', 'Windows', 'PowerShell', '工具']
description: '解决 Windows 不支持 tree --fromfile 的问题，用 PowerShell 把 git 未跟踪或暂存新增文件输出为目录树'
draft: false
---

你这个报错说明你用的是 **Windows 自带的 `tree` 命令**，它不支持 `--fromfile`。

`tree --fromfile` 是 Linux/macOS 上 GNU `tree` 的参数，在 Windows CMD / PowerShell 里会被当成路径，所以才会出现：

```txt
D:\xxx\--FROMFILE
无效的路径
```

---

## 最简单：先直接输出新增文件列表

未跟踪新增文件：

```bash
git ls-files --others --exclude-standard
```

已暂存新增文件：

```bash
git diff --cached --name-only --diff-filter=A
```

---

## Windows PowerShell 输出树形结构

在 PowerShell 里复制下面这段：

```powershell
$paths = git ls-files --others --exclude-standard

$tree = @{}

foreach ($path in $paths) {
  $parts = $path -split '[\\/]'
  $node = $tree

  foreach ($part in $parts) {
    if (-not $node.ContainsKey($part)) {
      $node[$part] = @{}
    }
    $node = $node[$part]
  }
}

function Show-Tree($node, $prefix = '') {
  $keys = @($node.Keys | Sort-Object)

  for ($i = 0; $i -lt $keys.Count; $i++) {
    $key = $keys[$i]
    $isLast = $i -eq $keys.Count - 1

    if ($isLast) {
      Write-Host "$prefix└── $key"
      Show-Tree $node[$key] "$prefix    "
    } else {
      Write-Host "$prefix├── $key"
      Show-Tree $node[$key] "$prefix│   "
    }
  }
}

Write-Host "."
Show-Tree $tree
```

它会把 **Git 检测到的未跟踪新增文件** 输出成树。

---

## 如果要看“已 git add 的新增文件”

把第一行换成：

```powershell
$paths = git diff --cached --name-only --diff-filter=A
```

---

## 如果要同时看“未跟踪新增 + 已暂存新增”

第一行换成：

```powershell
$paths = @(
  git ls-files --others --exclude-standard
  git diff --cached --name-only --diff-filter=A
) | Sort-Object -Unique
```

---

## 更推荐你封装成函数

在 PowerShell 里临时用：

```powershell
function git-new-tree {
  $paths = git ls-files --others --exclude-standard

  $tree = @{}

  foreach ($path in $paths) {
    $parts = $path -split '[\\/]'
    $node = $tree

    foreach ($part in $parts) {
      if (-not $node.ContainsKey($part)) {
        $node[$part] = @{}
      }
      $node = $node[$part]
    }
  }

  function Show-Tree($node, $prefix = '') {
    $keys = @($node.Keys | Sort-Object)

    for ($i = 0; $i -lt $keys.Count; $i++) {
      $key = $keys[$i]
      $isLast = $i -eq $keys.Count - 1

      if ($isLast) {
        Write-Host "$prefix└── $key"
        Show-Tree $node[$key] "$prefix    "
      } else {
        Write-Host "$prefix├── $key"
        Show-Tree $node[$key] "$prefix│   "
      }
    }
  }

  Write-Host "."
  Show-Tree $tree
}
```

以后直接执行：

```powershell
git-new-tree
```

---

你原来的命令在 **Git Bash / WSL / macOS / Linux** 里才适合用：

```bash
git ls-files --others --exclude-standard | tree --fromfile
```

在 Windows 原生终端里，建议用上面的 PowerShell 版本。
