# Agent Note: Product ACP profile (`dsh --profile acp`)

Status: implemented

English | [中文](2026-08-19-acp-profile.zh.md)

## Problem

Buzz creates agents by spawning a stdio ACP process and sending `session/new` with `{ cwd, mcpServers }`. The MCP list is how the seat calls Buzz CLI (`BUZZ_RELAY_URL`, `BUZZ_PRIVATE_KEY`, …). DSH only had `pnpm run demo:acp` / `dsh-acp-demo`, and `session/new` rejected non-empty `mcpServers`. That is not a product entry Buzz can put in a custom harness the same way it puts `web` / `headless` behind `dsh --profile`.

## Decision

Product ACP is `dsh --profile acp` (`pnpm dsh --profile acp` from source). The bundle is `@deepseek-ai/dsh-acp-app` at `packages/bundle/acp-app` — `@deepseek-ai/dsh-acp` is already the transport adapter. `PROFILE_TEMPLATES.acp = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-acp-app']`. It is not in `INSTALLATION_OWNED_PROFILE_TUPLES`.

Buzz custom harness stays outside DSH: `command = dsh`, `args = --profile acp`. DSH is not added to Buzz `PRESET_HARNESSES`.

`session/new` mounts client stdio `mcpServers` onto the unpublished agent scope through `@deepseek-ai/dsh-mcp-client` (`failOnStartupError: true`, reconnect off). HTTP / SSE / ACP MCP transports reject. `additionalDirectories` still reject. Protocol v1 means Buzz does not send `systemPrompt` on `session/new`; `_meta.sessionTitle` is ignored.

`demo:acp` and `examples/acp-agent` stay the snapshot/example composition. OpenMontage is not in the acp profile.

## Alternatives considered

**Keep `demo:acp` as the Buzz spawn target.** Rejected because the product CLI already owns `web` and `headless` as `--profile` templates; ACP must match that.

**Name the bundle `@deepseek-ai/dsh-acp`.** Rejected because that package is the JSON-RPC adapter.

**Advertise MCP capabilities on `initialize`.** Rejected because Buzz always sends `mcpServers` on `session/new` regardless of the capability bit.

**Put DSH in Buzz `PRESET_HARNESSES`.** Rejected; DSH is a Tier-3 custom harness.

## Consequences

A Buzz seat env that already has `dsh` on `PATH` can spawn ACP without a demo script. Session tools from Buzz CLI appear as `mcp__<serverName>__<rawName>` on that agent only. Snapshot tests keep using `demo:acp`.

## Testing

`dsh-acp` unit tests cover name/env helpers, stdio fixture mount, typed-transport reject, and startup failure. `dsh-acp-app` tests cover empty argv, `--help`, extra args, and the patch rows. `apps/cli` built-bin e2e covers `--profile acp --help` and `--dump-default-config`.
