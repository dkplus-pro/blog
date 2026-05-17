# Blog

基于 Astro 构建的轻量静态博客，部署在 GitHub Pages。

## 特性

- 静态站点，零运维，无需数据库
- Markdown 文章管理，放在 `src/content/blog/` 即可
- 标签系统（聚合页 + 筛选）
- 文章归档（按年月分组）
- 客户端全文搜索
- 暗色/亮色主题切换（偏好持久化）
- 文章目录导航（TOC）
- 代码语法高亮 + 一键复制
- 响应式布局（移动端适配）
- 分页功能

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建静态站点
npm run build

# 本地预览构建结果
npm run preview
```

## 写文章

在 `src/content/blog/` 目录下创建 `.md` 文件，文件名为 URL slug。

必须包含 frontmatter：

```markdown
---
title: '文章标题'
date: 2025-01-01
tags: ['前端', 'Vue']
description: '文章简介，会显示在列表页'
draft: false
---

文章正文写在这里...
```

- `title` - 文章标题（必填）
- `date` - 发布日期（必填，格式 `YYYY-MM-DD`）
- `tags` - 标签数组（可选）
- `description` - 文章简介（可选，用于列表页和 SEO）
- `draft` - 草稿标记（可选，设为 `true` 不会发布）

## 发布到 GitHub Pages

1. 在 GitHub 上创建一个仓库
2. 在 `astro.config.mjs` 中修改 `site` 和 `base` 为你的 GitHub Pages 地址
3. 推送代码到 `main` 分支
4. 在仓库 Settings > Pages 中，Source 选择 "GitHub Actions"
5. 推送代码后 GitHub Actions 会自动构建并部署

## 项目结构

```
├── src/
│   ├── components/     # 可复用组件（PostCard 等）
│   ├── content/
│   │   ├── blog/       # Markdown 文章
│   │   └── config.ts   # 内容集合 schema
│   ├── layouts/        # 页面布局
│   ├── pages/          # 路由页面
│   │   ├── index.astro       # 首页（文章列表）
│   │   ├── archive.astro     # 归档页
│   │   ├── search.astro      # 搜索页
│   │   ├── posts/[...slug].astro  # 文章详情
│   │   └── tags/             # 标签相关页面
│   └── styles/         # 全局样式
├── public/             # 静态资源
├── .github/workflows/  # GitHub Actions 部署配置
├── astro.config.mjs    # Astro 配置
└── package.json
```

