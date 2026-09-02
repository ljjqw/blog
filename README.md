# 我的个人博客（免费方案）

一个零成本的个人博客：用 Markdown 写作，Node 脚本构建成静态网站，一键部署到 GitHub Pages（完全免费，无需服务器）。

## 目录结构

```
.
├── config.js            # 站点配置（标题、作者、端口等）
├── build.js             # 构建脚本：Markdown → 静态 HTML
├── serve.js             # 本地启动服务脚本（静态服务器）
├── deploy.js            # 自动化部署脚本（→ GitHub Pages）
├── start.bat            # Windows 一键本地预览
├── deploy.bat           # Windows 一键部署
├── src/
│   ├── posts/           # 你的文章（Markdown）
│   ├── templates/       # HTML 模板（首页 / 文章页）
│   └── assets/          # 静态资源（style.css 等）
└── public/              # 构建产物（部署用，勿手改）
```

## 快速开始

```bash
npm install        # 安装依赖（marked, gh-pages）
npm run dev        # 构建 + 启动本地预览
```

然后浏览器打开 http://localhost:3000

- 仅构建：`npm run build`
- 仅预览（需先 build）：`npm run serve`  （端口可用 `PORT=8080 npm run serve` 覆盖）

Windows 用户也可直接双击 `start.bat`。

## 写文章

在 `src/posts/` 新建 `<名称>.md`，文件头用 `---` 包裹元信息：

```markdown
---
title: 文章标题
date: 2026-09-02
tags: 技术, 随笔
description: 一句话简介
---

正文……
```

保存后重新 `npm run build`（或 `npm run dev`）。

## 免费部署到 GitHub Pages

1. 在 GitHub 新建仓库（如 `blog`）。
2. 本地初始化并关联远程：

   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/ljjqw/blog.git
   git push -u origin main
   ```

3. 一键部署：

   ```bash
   npm run deploy       # 或 Windows 双击 deploy.bat
   ```

   脚本会构建并把 `public/` 推送到 `gh-pages` 分支。

4. 在仓库 **Settings → Pages** 中，Source 选择 **Deploy from a branch**，分支选 **gh-pages**，保存。
5. 等待 1~2 分钟，访问 `https://<用户名>.github.io/blog/`。

> 想用自定义域名？在仓库 Settings → Pages 填写域名，并在 `src/assets/` 放一个 `CNAME` 文件即可（构建会一并复制）。

## 其他免费托管（可选）

构建产物是纯静态文件，也可直接拖到以下平台（均免费）：

- **Netlify** / **Vercel**：拖入 `public/` 目录，或连接 Git 仓库自动部署
- **Cloudflare Pages**：同样支持静态托管
- **Gitee Pages / 码云**：国内访问更快的备选

## 自定义

- 改站点信息：编辑 `config.js`
- 改样式：编辑 `src/assets/style.css`
- 改布局：编辑 `src/templates/index.html` 与 `post.html`
