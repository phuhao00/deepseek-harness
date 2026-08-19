# Agent Note: 产品 ACP profile（`dsh --profile acp`）

Status: implemented

[English](2026-08-19-acp-profile.md) | 中文

## 问题

Buzz 创建 agent 的方式是 spawn 一个 stdio ACP 进程，并发送带 `{ cwd, mcpServers }` 的 `session/new`。MCP 列表是座席调用 Buzz CLI（`BUZZ_RELAY_URL`、`BUZZ_PRIVATE_KEY` 等）的通道。DSH 原先只有 `pnpm run demo:acp` / `dsh-acp-demo`，而且 `session/new` 会拒绝非空 `mcpServers`。这不是 Buzz 能像 `web` / `headless` 那样写进自定义 harness 的产品入口。

## 决策

产品 ACP 是 `dsh --profile acp`（源码树：`pnpm dsh --profile acp`）。组合包是 `@deepseek-ai/dsh-acp-app`，位于 `packages/bundle/acp-app`——`@deepseek-ai/dsh-acp` 已经是传输适配器。`PROFILE_TEMPLATES.acp = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-acp-app']`。它不进入 `INSTALLATION_OWNED_PROFILE_TUPLES`。

Buzz 自定义 harness 留在 DSH 之外：`command = dsh`，`args = --profile acp`。不要把 DSH 写进 Buzz `PRESET_HARNESSES`。

`session/new` 通过 `@deepseek-ai/dsh-mcp-client` 把客户端 stdio `mcpServers` 挂到尚未发布的 agent 作用域（`failOnStartupError: true`，关闭重连）。HTTP / SSE / ACP MCP 传输拒绝。`additionalDirectories` 仍然拒绝。协议 v1 下 Buzz 不会在 `session/new` 里发 `systemPrompt`；`_meta.sessionTitle` 忽略。

`demo:acp` 和 `examples/acp-agent` 仍是快照／示例组合。OpenMontage 不进入 acp profile。

## 曾考虑的替代

**继续让 Buzz spawn `demo:acp`。** 否决：产品 CLI 已经用 `--profile` 模板承载 `web` 和 `headless`；ACP 必须对齐。

**把组合包命名为 `@deepseek-ai/dsh-acp`。** 否决：该包已是 JSON-RPC 适配器。

**在 `initialize` 上公布 MCP 能力。** 否决：Buzz 无论能力位如何都会在 `session/new` 发送 `mcpServers`。

**把 DSH 写进 Buzz `PRESET_HARNESSES`。** 否决；DSH 是 Tier-3 自定义 harness。

## 后果

`PATH` 上已有 `dsh` 的 Buzz 座席可以直接 spawn ACP，不必走 demo 脚本。Buzz CLI 的会话工具只出现在该 agent 上，公开名为 `mcp__<serverName>__<rawName>`。快照测试继续使用 `demo:acp`。

## 测试

`dsh-acp` 单测覆盖名称／env 辅助函数、stdio fixture 挂载、带类型传输拒绝、以及启动失败。`dsh-acp-app` 测试覆盖空 argv、`--help`、多余参数和 patch 行。`apps/cli` built-bin e2e 覆盖 `--profile acp --help` 和 `--dump-default-config`。
