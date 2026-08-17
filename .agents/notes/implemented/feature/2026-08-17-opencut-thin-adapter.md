# Agent Note: OpenCut thin adapter and OpenMontage handoff

Status: implemented

English | [中文](2026-08-17-opencut-thin-adapter.zh.md)

## Problem

Users want [OpenCut](https://github.com/OpenCut-app/OpenCut) available in DeepSeek Harness and used with the existing OpenMontage adapter. OpenCut is an MIT video editor in the middle of a rewrite. Official Editor API, MCP, and headless rendering are listed as upcoming and are not a loadable surface. Vendoring the editor, wrapping third-party Playwright MCP servers, or treating `opencut-classic` as the official tree would either ship a full app the harness does not own or bind the adapter to an unofficial control path.

## Decision

`@deepseek-ai/dsh-opencut` is an opt-in function plugin and profile bundle under `packages/opencut/opencut/`. It takes a required absolute `Config.root`, rejects a path that is not the official rewrite checkout (`moon.yml` plus `apps/web/`), and registers:

- prompt variable `opencut_root`
- prompt section `opencut` (`order` 160)
- bundled skills `opencut` and `opencut-openmontage`

The agent starts the rewrite editor (`proto use`, `moon run web:dev`, `moon run api:dev`) through the existing bash and filesystem tools. The bundle patch reads `OPENCUT_ROOT` and `OPENCUT_UPDATE` (default `pull`). After the tree validates, `apply()` fetches `origin` and fast-forwards a clean worktree that is behind upstream; `check` fails when behind; `off` skips git; a tree without `.git` is left unchanged. The row is absent from shipped `dsh-base`, `web`, and `headless` templates.

Joint use is two mounted adapters, not a third package. OpenMontage owns pipeline production. OpenCut owns the editor. The OpenMontage operating section names `opencut-openmontage` when that skill is registered. The handoff skill body substitutes `opencut_root` and, when `@deepseek-ai/dsh-openmontage` is mounted, the live `openmontage_root` value; if OpenMontage is absent, the body says the plugin is not mounted.

The adapter ships MIT-licensed Harness-owned prompt text and gateway skills. It does not vendor OpenCut sources.

## Alternatives considered

**Vendor OpenCut into `vendor/` or a git submodule.** Rejected because the checkout is a full editor (web, desktop, Rust core) the harness does not own.

**Wrap RavenMeld/OpenCut-MCP or another Playwright controller as dsh tools.** Rejected because those servers target `opencut-classic`, are not the official MCP, and would be a hundred-plus-tool wrap of an unofficial page-evaluate path.

**Accept `opencut-classic` as `Config.root`.** Rejected because the user-linked tree is the official rewrite, and classic markers would silently accept the wrong checkout.

**Merge OpenCut into `@deepseek-ai/dsh-openmontage`.** Rejected because editor-only users should not supply an OpenMontage root, and production-only users should not supply an OpenCut root.

**Wait for the official MCP and Editor API.** Rejected as the only adapter: those surfaces are not loadable yet, and users already need a local editor handoff after OpenMontage renders.

## Consequences

A profile must add the OpenCut bundle (and the OpenMontage bundle for joint use) and supply absolute checkout paths. Users clone and set up each tree themselves. Default web and headless snapshots are unchanged. Package tests pin fail-loud `root` checks, load-time git sync, prompt interpolation, skill dispose, unmounted versus mounted OpenMontage substitution, and a Loader-booted `cordis.yml` that mounts both adapters against fixture checkouts.

## Testing

Package unit tests reject a missing, relative, or non-rewrite `root`, pin interpolated `assemble()` text plus skill dispose, pin the handoff skill against a missing and a mounted `openmontage_root`, and pin `update` modes against a local git remote (`off`/`check`/`pull`, dirty-tree refusal). `tests/loader-composition.spec.ts` boots a temporary `cordis.yml` through the Loader with both fixture trees.
