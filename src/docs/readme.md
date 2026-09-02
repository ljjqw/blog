---
title: README
---

# 文档博客框架（免费方案）

一个零成本的**文档/博客框架**，整体风格参考 [Nodify 文档站](https://miroiu.github.io/nodify/wiki/connectors-overview.html)（Starlight 风格）：

- 🌲 左侧**可折叠的层级文档树**（任意父子嵌套，支持分组）
- 🔍 顶部**全文搜索**（Ctrl+K 聚焦，实时过滤目录）
- 🌗 **亮 / 暗主题**一键切换（记忆偏好）
- 📑 右侧**本页目录**（自动提取 h2/h3，平滑滚动+高亮）
- ⏮ 底部**上一页 / 下一页**导航
- 🛠 **后台可视化编辑**：在线写文章、**批量导入 Markdown**、**拖拽式调整层级关系**

纯静态、零服务器成本，构建后一键部署到 GitHub Pages（或 Cloudflare Pages / Netlify）。

## 站点页面
- **落地页 `index.html`**：站点介绍 + 文档目录卡片
- **文档页 `docs/<slug>.html`**：每篇文档，含侧边栏树 / 本页目录 / 上下页

## 目录结构
```
.
├── config.js            # 站点配置（标题/描述/GitHub/端口）
├── build.js             # 构建脚本：Markdown → 静态 HTML（文档树/TOC/导航）
├── serve.js             # 本地启动服务脚本（静态服务器）
├── admin.js             # 后台服务（在线编辑 / 导入 MD / 编辑层级）
├── deploy.js            # 自动化部署脚本（→ GitHub Pages）
├── start.bat / admin.bat / deploy.bat   # Windows 一键脚本
├── src/
│   ├── docs/            # 你的文档（Markdown）
│   ├── templates/       # HTML 模板（doc.html / index.html）
│   └── assets/          # 静态资源（style.css / app.js）
└── public/              # 构建产物（部署用，勿手改）
```

## 快速开始
```bash
npm install        # 安装依赖（marked, gh-pages）
npm run dev        # 构建 + 启动本地预览（http://localhost:3000）
```
- 仅构建：`npm run build`
- 仅预览：`npm run serve`（端口可用 `PORT=8080 npm run serve` 覆盖）

首次构建会在 `src/docs/` 生成一批示例文档（含层级结构），可直接参考。

## 文档的层级关系（frontmatter）
每篇文档通过头部 frontmatter 控制元数据与层级：

| 字段 | 说明 |
| --- | --- |
| `title` | 文档标题（侧边栏显示） |
| `parent` | 父文档的 slug，留空为顶级 |
| `order` | 同级排序，数字越小越靠前 |
| `group` | 设为 `true` 显示为可折叠分组 |
| `tags` | 标签，逗号分隔 |
| `description` | 一句话简介 |

示例（子文档）：
```markdown
---
title: 子文档
parent: guide        # 父文档 slug
order: 1
---

# 子文档

正文……
```

构建后会自动生成可折叠的树形导航。

## 后台管理（编辑 / 导入 / 层级）
```bash
npm run admin        # 或双击 admin.bat
```
浏览器打开 `http://localhost:4000/admin`，有两个标签页：

**1. 编辑文章**：可视化新建 / 编辑 / 删除文档，字段含 `父级`、`排序`。

**2. 层级结构**：
- 📥 **导入 Markdown**：选择若干 `.md` 文件批量导入；文件原有的 `parent` / `order` 会被保留，slug 冲突时自动加后缀。
- 🗂 **关系层级与排序**：表格里为每篇文档设置父级与顺序，点击“保存层级”即重建整棵目录树。

> 后台是本地写作工具，请勿暴露到公网。线上部署只发布 `public/` 静态产物。

## 免费部署到 GitHub Pages
1. 在 GitHub 新建仓库（如 `blog`）。
2. 初始化并关联远程：
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/ljjqw/blog.git
   git push -u origin main
   ```
3. 一键部署：`npm run deploy`（或双击 deploy.bat）。
4. **关键**：进入仓库 **Settings → Pages**，Source 选 `Deploy from a branch`，分支选 `gh-pages` / `(root)`，Save。
5. 等待 1~2 分钟，访问 `https://<用户名>.github.io/<仓库名>/`（项目站点必须带 `/<仓库名>/`）。

> github.io 在中国大陆常被墙/很慢，若打不开，建议改用 **Cloudflare Pages**（构建命令 `npm run build`，输出目录 `public`）。

## 自定义
- 站点信息 / GitHub 链接 / 端口：编辑 `config.js`
- 样式（亮暗主题、侧边栏、TOC）：编辑 `src/assets/style.css`
- 页面布局：编辑 `src/templates/*.html`
- 前端交互（主题/搜索/目录）：编辑 `src/assets/app.js`
