---
type: 包领域索引
title: Workspace 包领域与权威归属
description: 将所有 manifest-backed package groups 映射到运行时责任、规范页面和稳定源码入口，避免把目录树误作架构。
tags: [reference, packages, workspaces, architecture]
---

# Workspace 包领域与权威归属

Workspace leaf 遵循 `packages/<group>/<package>`，命名通常为 `@deepseek-ai/dsh-<package>`。本页压缩导航，不替代各包 README；全量 package/ctx 映射以 `packages/README.zh.md` 为准。

| 领域组 | 包族 | Canonical wiki home |
|---|---|---|
| 启动与产品装配 | `boot/*`、`bundle/*`、`apps/cli`、`apps/web` | [启动](../runtime/boot.md)、[Web](../web/application.md) |
| Agent 核心 | `core/agent`、`agent-loop`、`session`、`system-prompt`、`tools`、scope | [Agent Loop](../runtime/agent-loop.md)、[会话](../data/session.md)、[工具授权](../runtime/tool-execution-and-authorization.md) |
| LLM 与上下文 | `llm/*`、`context/*`、`system-prompt` | [LLM、提示词与运行时上下文](../runtime/llm-and-context.md) |
| 协作状态与 guard | `guard/*`、`plan`、`goal/*`、`todo`、feedback、interaction | [目标、计划、待办与人工协作](../capabilities/collaboration-and-agent-guidance.md) |
| 安全执行 | `fs/*`、`shell/*`、`terminal/*`、`subprocess/*`、`sandbox/*`、spill | [文件系统、Shell、子进程与终端](../capabilities/filesystem-and-process-capabilities.md)、[Sandbox runner](../platform/sandbox-and-native-runners.md) |
| 异步工作 | `subagent/*`、jobs、schedule、`workflow/*` | [异步 Agent 与 Workflow](../runtime/async-agents-and-workflows.md) |
| 数据资产与遥测 | `session/*`、`session-query/*`、attachment、storage、workspace | [会话](../data/session.md)、[持久化查询](../data/session-persistence-and-query.md)、[数据资产](../data/assets-and-workspaces.md)、[会话遥测](../data/session-telemetry.md) |
| 用户状态与预设 | settings、credentials、identity、preset | [配置状态来源](../runtime/configuration-and-state-sources.md)、[Agent Preset](../runtime/agent-presets.md) |
| Host/Client UI | host、client、api | [Web 应用](../web/application.md)、[Client Runtime](../web/client-runtime-and-connection.md)、[Typert Gateway](../integration/typert-gateway-and-connection.md) |
| 外部协议与工具 | typert、sdk、acp、mcp、hooks、web、lsp、skill、code-runtime、e2b | [Typert](../integration/typert-gateway-and-connection.md)、[自动化 SDK](../integration/automation-sdks.md)、[MCP](../runtime/mcp-client.md)、[外部工具](../capabilities/external-tools.md)、[外部执行 runtime](../capabilities/executable-and-remote-runtimes.md) |
| 动态扩展 | extensions、plugin inventory | [动态 Plugin 隔离](../platform/dynamic-cordis-plugin-isolation.md) |
| 开发支持 | test-support、util、examples、vendor | [构建测试](../engineering/build-and-test.md)、[发布制品](../engineering/release-artifacts-and-generated-contracts.md) |
| 原生/Python | native/landlock-run、python/sdk、python/sdk-runtime | [Sandbox runner](../platform/sandbox-and-native-runners.md)、[自动化 SDK](../integration/automation-sdks.md) |

## 如何安全定位

先由改动意图选择上表页面，再从页面列出的 entrypoint、definition/provider/consumer 与 focused test 向下走。新增 package 应加入既有 group，并更新该 group README 和 `packages/README.zh.md` 表；若新 capability 跨组，补充其 canonical page，而不是只在此索引增加一行。

`vendor/*` 是受控上游快照，不能按普通本地 package 修改；修改须同步 vendor manifest。`examples` 主要证明 built package consumption，其 workspace 成员身份不表示它进入普通 build target。