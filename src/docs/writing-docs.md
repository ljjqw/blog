---
title: 编写文档与层级关系
parent: guide
order: 2
description: frontmatter 字段与父子层级说明。
---

# 编写文档与层级关系

每篇文档通过 **frontmatter** 控制元数据与层级：

| 字段 | 说明 |
| --- | --- |
| `title` | 文档标题（侧边栏显示） |
| `parent` | 父文档的 slug，留空为顶级 |
| `order` | 同级排序，数字越小越靠前 |
| `group` | 设为 `true` 显示为可折叠分组 |
| `tags` | 标签，逗号分隔 |
| `description` | 一句话简介 |

## 父子层级示例

```markdown
---
title: 子文档
parent: guide      # 父文档 slug
order: 1
---

正文……
```

构建后会自动生成可折叠的树形导航。你也可以在**后台 → 层级结构**中可视化地调整父子关系与顺序。
