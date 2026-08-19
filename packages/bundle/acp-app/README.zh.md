# `@deepseek-ai/dsh-acp-app`

[English](README.md) | 中文

dsh ACP 组合包。[`cordis.patch.yml`](cordis.patch.yml) 直接叠加在 [`dsh-base`](../base/README.md) 之上：提供编码 persona 和工具模式、禁用 HMR（热模块替换）、将 Code Mode 的 worker 作为核心执行能力挂载，并插入本包的 `acp-startup` 提供方以及 [`dsh-acp`](../../acp/acp/README.md) 传输行。它不挂载任何 Host、HTTP server、Web runtime 或浏览器插件。

Stdout 专用于 ACP JSON-RPC。普通 `acp-startup` 提供方（[`src/startup.ts`](src/startup.ts)）注入 `ctx.cmdlineArgs`（[`dsh-cmdline`](../../boot/cmdline/README.md)），打印本应用的 `--help`，拒绝多余参数，并仅在解析成功后提供 `acpStartup`；ACP 行注入该服务，因此帮助与用法错误不会占用 stdio。产品命令是 `dsh --profile acp`；Buzz（以及其他 ACP 客户端）会 spawn 该进程，并在 `session/new` 中发送 stdio `mcpServers`。

## 模型体验

无影响，因为本组合包只是 patch 列表载体；提示词、工具和会话 MCP 挂载由组合后的 base 与 ACP 行提供。

#### KV Cache 影响

无；本组合包不向请求前缀添加任何内容。

## 已知限制与暂缓事项

- **仅 stdio ACP**：该进程是协议服务器，不是聊天 UI，也不是一次性打印器。
- **`--help` 必须占用 stdout**：多余参数和帮助会在 ACP 行激活前退出。
