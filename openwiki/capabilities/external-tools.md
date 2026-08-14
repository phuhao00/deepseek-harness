---
type: 外部工具能力设计
title: Web、LSP 与技能 Provider

description: 说明 web search/fetch、LSP 和 skill capability 的可替换 provider、选择规则、进程边界与模型工具消费者。
tags: [capabilities, web-tools, lsp, skills]
---

# Web、LSP 与技能 Provider

本页覆盖由外部内容、语言服务器或本地 skill 文件驱动的模型能力；MCP 的连接代际与动态工具注册另见[MCP Client](../runtime/mcp-client.md)。

## Web search 与 fetch

`WebRuntime`（`packages/web/web/src/index.ts`，`ctx.web`）分别维护 search 和 fetch provider registry。provider id 重复立即拒绝；每次执行才选择 provider：显式配置必须存在且 `available()`，未配置时必须恰有一个可用 provider，因此永远不依赖注册顺序。多个可用 provider 返回 `WEB_PROVIDER_AMBIGUOUS`，没有可用 provider 返回明确错误。`DSH_WEB_SEARCH_PROVIDER`/`DSH_WEB_FETCH_PROVIDER` 与 config 是同一选择面，不应另造隐式优先级。

`web-fetch-http` 实现 HTTP fetch、重定向/大小等 policy；search adapters（DeepSeek、Exa、Perplexity）和 `tool-web` 是 provider/consumer 层。非 2xx 是描述性 fetch result，不是 transport throw；search result 会由 seam 强制 `maxResults` 上限。

## LSP

`dsh-lsp` 是 `ctx.lsp` definition，`lsp-stdio` 把语言服务器限制在 workspace-keyed lifecycle：同 workspace 初始化 single-flight、连接丢失后按协议重连，request signal 会取消本次请求而非任意关闭共享 server。它经 `ctx.fs`/`ctx.subprocess` 取得源、路径和进程，`tool-lsp` 只消费抽象 LSP API。注册失败或初始化回滚不得泄露 child process；unload 要停止 intake、drain/terminate owned server。

## Skills

`SkillRuntime`（`packages/skill/skill/src/index.ts`，`ctx.skill`）维护可发现 skill/provider 目录，`skill-filesystem` 从文件系统读取、验证并装载，`tool-skill` 向模型呈现 catalog/loader，`skill-badge` 为 UI 提供呈现。provider 必须用 stable identity、明确 availability 与 disposer；文件内容、指令文本和 tool result 的 model-visible 影响仍须遵守 session logging。

## 完整变更面

| 新增或变更 | 必须同行检查 | 聚焦验证 |
|---|---|---|
| Web provider | `dsh-web` registry、provider `available()`、config/bundle、`tool-web` | `pnpm vitest run packages/web` |
| LSP provider/protocol | definition、stdio host/connection、fs/subprocess boundary、`tool-lsp` | `pnpm vitest run packages/lsp packages/fs packages/subprocess` |
| Skill provider | registry、filesystem validation、catalog/tool、UI 仅作 consumer | `pnpm vitest run packages/skill` |

不要将 provider credential 写入 session、tool result 或 browser transport；配置错误、不可用与协议失败必须保持可诊断的稳定类型。