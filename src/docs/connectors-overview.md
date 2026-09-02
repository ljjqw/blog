---
title: 连接器总览
parent: examples
order: 1
description: 以“连接器”为例说明一类技术文档的写法。
---

# 连接器总览（Connectors Overview）

> 本页为示例文档，演示技术类文档的排版。

## 概述

**Connector（连接器）** 用于连接两个节点，触发 `PendingConnectionStartedEvent`，并依赖 `Anchor` 与 `IsConnected` 属性。按住 `ALT` 点击可触发 `DisconnectCommand` 断开连接。

## NodeInput 与 NodeOutput

二者都是 `Connector` 的具体实现，提供：

- `Header` / `HeaderTemplate`
- `ConnectorTemplate`

```ts
public class NodeInput : Connector { }
public class NodeOutput : Connector { }
```

## 小结

- 连接器负责“点”与“边”的连接语义
- 输入/输出是连接器的两个常见形态
