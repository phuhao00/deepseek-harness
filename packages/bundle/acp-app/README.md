# `@deepseek-ai/dsh-acp-app`

English | [中文](README.zh.md)

The dsh ACP bundle. [`cordis.patch.yml`](cordis.patch.yml) rides directly over [`dsh-base`](../base/README.md): it supplies the coding persona and tool mode, disables HMR, mounts Code Mode's worker as a core execution capability, and inserts this package's `acp-startup` provider plus the [`dsh-acp`](../../acp/acp/README.md) transport row. It mounts no Host, HTTP server, Web runtime, or browser plugin.

Stdout is reserved for ACP JSON-RPC. The ordinary `acp-startup` provider ([`src/startup.ts`](src/startup.ts)) injects `ctx.cmdlineArgs` ([`dsh-cmdline`](../../boot/cmdline/README.md)), prints this app's `--help`, rejects extra arguments, and provides `acpStartup` only after a successful parse; the ACP row injects that service so help and usage errors never bind stdio. `dsh --profile acp` is the product command; Buzz (and other ACP clients) spawn that process and send `session/new` with stdio `mcpServers`.

## Model Experience

None, as the bundle is a patch-list carrier; prompts, tools, and session MCP mounts belong to the composed base and ACP rows.

#### KV Cache effect

None; the bundle adds nothing to the request prefix.

## Known Limitations and Deferred Work

- **Stdio ACP only** — the process is a protocol server, not a chat UI or one-shot printer.
- **`--help` must win stdout** — extra tokens and help exit before the ACP row activates.
