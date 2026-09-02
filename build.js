/**
 * build.js —— 文档站点构建脚本
 *
 * 把 src/docs 下的 Markdown 文档（含 frontmatter）编译为 public/ 下的静态站点：
 *   - index.html        文档落地页（站点介绍 + 文档目录树）
 *   - docs/<slug>.html  每篇文档页
 *
 * 文档支持层级关系（frontmatter）：
 *   parent: <父文档slug>   父级文档（留空为顶级）
 *   order:  <数字>         同级排序（越小越靠前）
 *   group:  true           标记为分组（侧边栏显示为可折叠标题，仍可点击进入）
 *
 * 同时导出 readDocs / parseFrontmatter / slugify 供 admin.js 复用。
 */
const fs = require('fs');
const path = require('path');
const marked = require('marked');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DOCS_DIR = path.join(SRC, 'docs');
const TEMPLATES_DIR = path.join(SRC, 'templates');
const ASSETS_DIR = path.join(SRC, 'assets');
const PUBLIC = path.join(ROOT, 'public');

const SITE = Object.assign(
  {
    title: 'My Docs',
    description: 'A personal documentation site.',
    author: 'Author',
    baseUrl: '',
    github: '',
    about: ''
  },
  loadConfig()
);

function loadConfig() {
  try {
    return require('./config.js');
  } catch (e) {
    return {};
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// 解析 Markdown 顶部的 frontmatter（--- key: value ---）
function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  m[1].split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    val = val.replace(/^['"]|['"]$/g, '');
    data[key] = val;
  });
  return { data, body: m[2] };
}

// 由标题生成文件 slug（保留中文，英文转小写、空格转连字符）
function slugify(s) {
  return (
    String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w一-龥-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'post'
  );
}

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8');
}

function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : ''
  );
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const y = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// 渲染 Markdown，并为 h2/h3 生成 id，同时产出“本页目录(TOC)”
function renderMarkdown(body) {
  let html = marked.parse(body || '');
  const used = new Set();
  const toc = [];
  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (m, lvl, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    let id = slugify(text) || 'section';
    let uniq = id;
    let n = 2;
    while (used.has(uniq)) uniq = `${id}-${n++}`;
    used.add(uniq);
    toc.push({ lvl: Number(lvl), text, id: uniq });
    return `<h${lvl} id="${uniq}">${inner}</h${lvl}>`;
  });
  return { html, toc };
}

// 读取所有文档（含正文与 HTML）
function readDocs() {
  if (!fs.existsSync(DOCS_DIR)) return [];
  return fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(DOCS_DIR, f), 'utf8');
      const { data, body } = parseFrontmatter(raw);
      const slug = f.replace(/\.md$/i, '');
      const { html, toc } = renderMarkdown(body);
      const tags = (data.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      return {
        slug,
        title: data.title || slug,
        date: data.date || '',
        parent: (data.parent || '').trim(),
        order: data.order !== undefined && data.order !== '' ? Number(data.order) : 999,
        group: String(data.group || '').toLowerCase() === 'true',
        tags,
        description: data.description || '',
        content: body.trim(),
        html,
        toc
      };
    });
}

// 构建嵌套文档树（含环检测）
function buildTree(docs) {
  const map = {};
  docs.forEach((d) => (map[d.slug] = { ...d, parentSlug: d.parent, children: [] }));
  const roots = [];
  docs.forEach((d) => {
    const node = map[d.slug];
    const parent = node.parentSlug && map[node.parentSlug];
    if (parent && !wouldCycle(node.slug, node.parentSlug, map)) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (arr) => {
    arr.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'zh'));
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function wouldCycle(childSlug, parentSlug, map) {
  let cur = map[parentSlug];
  while (cur) {
    if (cur.slug === childSlug) return true;
    cur = cur.parentSlug && map[cur.parentSlug];
  }
  return false;
}

function flatten(nodes, acc = []) {
  nodes.forEach((n) => {
    acc.push(n);
    flatten(n.children, acc);
  });
  return acc;
}

function ancestorSet(slug, map) {
  const set = new Set();
  let cur = map[slug];
  while (cur && cur.parentSlug && map[cur.parentSlug]) {
    set.add(cur.parentSlug);
    cur = map[cur.parentSlug];
  }
  return set;
}

// 渲染可折叠的树形侧边栏
function renderSidebar(tree, activeSlug, base) {
  const map = {};
  flatten(tree).forEach((n) => (map[n.slug] = n));
  const ancestors = activeSlug ? ancestorSet(activeSlug, map) : new Set();

  function renderNode(node, depth) {
    const hasChildren = node.children && node.children.length;
    const active = node.slug === activeSlug;
    if (hasChildren) {
      const open = ancestors.has(node.slug) || depth === 0;
      let html = `<details class="nav-group"${open ? ' open' : ''}>`;
      html += `<summary class="nav-summary"><a class="nav-link${
        active ? ' active' : ''
      }" href="${base}docs/${node.slug}.html">${escapeHtml(node.title)}</a></summary>`;
      html += '<div class="nav-children">';
      node.children.forEach((c) => (html += renderNode(c, depth + 1)));
      html += '</div></details>';
      return html;
    }
    return `<a class="nav-link leaf${
      active ? ' active' : ''
    }" href="${base}docs/${node.slug}.html">${escapeHtml(node.title)}</a>`;
  }

  return tree.map((n) => renderNode(n, 0)).join('\n');
}

// 渲染“本页目录”
function renderToc(toc) {
  if (!toc || !toc.length) {
    return '<div class="toc-inner"><div class="toc-title">本页目录</div><div class="toc-empty">（无章节）</div></div>';
  }
  const items = toc
    .map(
      (t) =>
        `<li class="toc-${t.lvl}"><a href="#${t.id}">${escapeHtml(t.text)}</a></li>`
    )
    .join('');
  return `<div class="toc-inner"><div class="toc-title">本页目录</div><ul class="toc-list">${items}</ul></div>`;
}

// 渲染上一页 / 下一页
function renderPrevNext(flat, activeSlug, base) {
  const i = flat.findIndex((n) => n.slug === activeSlug);
  if (i === -1) return '';
  const prev = i > 0 ? flat[i - 1] : null;
  const next = i < flat.length - 1 ? flat[i + 1] : null;
  const cell = (node, dir) =>
    node
      ? `<a class="pn pn-${dir}" href="${base}docs/${node.slug}.html"><span class="pn-label">${
          dir === 'prev' ? '← 上一页' : '下一页 →'
        }</span><span class="pn-title">${escapeHtml(node.title)}</span></a>`
      : `<span class="pn pn-empty"></span>`;
  return `<nav class="pager">${cell(prev, 'prev')}${cell(next, 'next')}</nav>`;
}

function build() {
  console.log('→ 开始构建文档站点...\n');

  // 清空上一次产物，避免残留
  if (fs.existsSync(PUBLIC)) {
    try {
      fs.rmSync(PUBLIC, { recursive: true, force: true });
    } catch (e) {
      /* 个别环境对删除有拦截，忽略后继续 */
    }
  }

  ensureDir(PUBLIC);
  ensureDir(path.join(PUBLIC, 'docs'));
  ensureDir(path.join(PUBLIC, 'assets'));

  if (fs.existsSync(ASSETS_DIR)) copyDir(ASSETS_DIR, path.join(PUBLIC, 'assets'));

  if (!fs.existsSync(DOCS_DIR)) {
    ensureDir(DOCS_DIR);
    seedDocs();
    console.log('  未发现文档，已生成示例文档 src/docs/*\n');
  }

  const docs = readDocs();
  const tree = buildTree(docs);
  const flat = flatten(tree);
  const map = {};
  flat.forEach((n) => (map[n.slug] = n));

  const docTemplate = readTemplate('doc.html');
  const indexTemplate = readTemplate('index.html');

  // 1) 每篇文档页（base = '../'）
  docs.forEach((doc) => {
    const out = render(docTemplate, {
      base: '../',
      title: escapeHtml(doc.title),
      site_title: escapeHtml(SITE.title),
      site_description: escapeHtml(SITE.description),
      github: escapeHtml(SITE.github || '#'),
      year: new Date().getFullYear(),
      sidebar: renderSidebar(tree, doc.slug, '../'),
      content: doc.html,
      toc: renderToc(doc.toc),
      prevnext: renderPrevNext(flat, doc.slug, '../')
    });
    fs.writeFileSync(path.join(PUBLIC, 'docs', `${doc.slug}.html`), out, 'utf8');
    console.log(`  ✓ 文档: docs/${doc.slug}.html`);
  });

  // 2) 落地页（base = ''）
  const firstSlug = flat.length ? flat[0].slug : '';
  const sectionCards = tree
    .map((n) => {
      const childCount = n.children ? n.children.length : 0;
      const sub = childCount
        ? `<div class="card-sub">${childCount} 篇文档</div>`
        : `<div class="card-sub">${escapeHtml(n.description || '')}</div>`;
      return `<a class="show-card" href="docs/${n.slug}.html">
        <h3>${escapeHtml(n.title)}</h3>
        ${sub}
      </a>`;
    })
    .join('\n');

  const featuresHtml = (SITE.features || [])
    .map(
      (f) => `<div class="feature-card">
      <div class="ic">${escapeHtml(f.icon || '✨')}</div>
      <h3>${escapeHtml(f.title || '')}</h3>
      <p>${escapeHtml(f.desc || '')}</p>
    </div>`
    )
    .join('\n');

  const indexOut = render(indexTemplate, {
    base: '',
    title: escapeHtml(SITE.title),
    site_title: escapeHtml(SITE.title),
    site_description: escapeHtml(SITE.description),
    github: escapeHtml(SITE.github || '#'),
    year: new Date().getFullYear(),
    sidebar: renderSidebar(tree, null, ''),
    first_slug: escapeHtml(firstSlug),
    section_cards: sectionCards,
    features_html: featuresHtml
  });
  fs.writeFileSync(path.join(PUBLIC, 'index.html'), indexOut, 'utf8');
  console.log('  ✓ 落地页: index.html');

  console.log(`\n✓ 构建完成，共 ${docs.length} 篇文档 → public/`);
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function seedDocs() {
  const seeds = {
    'home.md': `---
title: 站点介绍
order: 1
description: 这个文档站点的定位与使用方法。
---
# 欢迎来到我的文档站 👋

这是一个**免费方案**搭建的文档/博客框架，整体风格参考了 Nodify 等项目的文档站：

- 🌲 左侧是可折叠的**层级文档树**，支持任意父子嵌套
- 🔍 顶部**搜索**可快速过滤文档（Ctrl+K 聚焦）
- 🌗 右上角可**切换亮/暗主题**
- 📑 右侧**本页目录**方便跳转章节
- ⏮ 底部有**上一页 / 下一页**导航
- 🛠 后台可**批量导入 Markdown** 并**编辑层级关系**

## 如何开始

点击左侧目录中的任意文档开始阅读，或点击右上角 GitHub 查看源码。

> 写作方式：在 \`src/docs\` 目录新建 \`.md\` 文件，通过 frontmatter 的 \`parent\` / \`order\` 控制层级与排序。
`,
    'guide.md': `---
title: 使用指南
order: 2
description: 如何编写和组织文档。
---
# 使用指南

本分组介绍如何编写文档、如何组织层级结构。

- **开始使用**：从零创建你的第一篇文档
- **编写文档**：了解 frontmatter 与层级关系

通过左侧展开本分组即可阅读子文档。
`,
    'getting-started.md': `---
title: 开始使用
parent: guide
order: 1
description: 五分钟创建你的第一篇文档。
---
# 开始使用

## 创建文档

在 \`src/docs\` 目录新建一个 \`.md\` 文件，例如 \`hello.md\`：

\`\`\`markdown
---
title: 你好世界
order: 1
---

# 你好世界

这是我的第一篇文档。
\`\`\`

运行 \`npm run build\`，刷新页面即可看到新文档出现在侧边栏。

## 启动本地预览

\`\`\`bash
npm run serve      # 本地预览
npm run admin      # 打开后台在线编辑
\`\`\`
`,
    'writing-docs.md': `---
title: 编写文档与层级关系
parent: guide
order: 2
description: frontmatter 字段与父子层级说明。
---
# 编写文档与层级关系

每篇文档通过 **frontmatter** 控制元数据与层级：

| 字段 | 说明 |
| --- | --- |
| \`title\` | 文档标题（侧边栏显示） |
| \`parent\` | 父文档的 slug，留空为顶级 |
| \`order\` | 同级排序，数字越小越靠前 |
| \`group\` | 设为 \`true\` 显示为可折叠分组 |
| \`tags\` | 标签，逗号分隔 |
| \`description\` | 一句话简介 |

## 父子层级示例

\`\`\`markdown
---
title: 子文档
parent: guide      # 父文档 slug
order: 1
---

正文……
\`\`\`

构建后会自动生成可折叠的树形导航。你也可以在**后台 → 层级结构**中可视化地调整父子关系与顺序。
`,
    'examples.md': `---
title: 技术示例
order: 3
description: 一些技术向的示例文档。
---
# 技术示例

这里放一些技术向的示例文档，风格类似 API / 组件说明。
`,
    'connectors-overview.md': `---
title: 连接器总览
parent: examples
order: 1
description: 以“连接器”为例说明一类技术文档的写法。
---
# 连接器总览（Connectors Overview）

> 本页为示例文档，演示技术类文档的排版。

## 概述

**Connector（连接器）** 用于连接两个节点，触发 \`PendingConnectionStartedEvent\`，并依赖 \`Anchor\` 与 \`IsConnected\` 属性。按住 \`ALT\` 点击可触发 \`DisconnectCommand\` 断开连接。

## NodeInput 与 NodeOutput

二者都是 \`Connector\` 的具体实现，提供：

- \`Header\` / \`HeaderTemplate\`
- \`ConnectorTemplate\`

\`\`\`ts
public class NodeInput : Connector { }
public class NodeOutput : Connector { }
\`\`\`

## 小结

- 连接器负责“点”与“边”的连接语义
- 输入/输出是连接器的两个常见形态
`,
    'contact.md': `---
title: 联系方式
order: 4
description: 与我取得联系的方式。
---
# 联系方式

欢迎通过以下方式与我交流：

- 📧 邮箱：you@example.com
- 🐙 GitHub：${SITE.github || 'https://github.com/ljjqw'}
- 💬 微信：your_wechat_id

> 如果这个文档站点对你有帮助，欢迎 Star / Fork 源码。
`
  };
  Object.entries(seeds).forEach(([name, content]) => {
    fs.writeFileSync(path.join(DOCS_DIR, name), content, 'utf8');
  });
}

if (require.main === module) {
  try {
    build();
  } catch (e) {
    console.error('构建失败:', e.message);
    process.exit(1);
  }
}

module.exports = { build, readDocs, parseFrontmatter, slugify, renderMarkdown, buildTree };
