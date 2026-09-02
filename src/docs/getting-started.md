---
title: 开始使用
parent: guide
order: 1
description: 五分钟创建你的第一篇文档。
---

# 开始使用

## 创建文档

在 `src/docs` 目录新建一个 `.md` 文件，例如 `hello.md`：

```markdown
---
title: 你好世界
order: 1
---

# 你好世界

这是我的第一篇文档。
```

运行 `npm run build`，刷新页面即可看到新文档出现在侧边栏。

## 启动本地预览

```bash
npm run serve      # 本地预览
npm run admin      # 打开后台在线编辑
```
