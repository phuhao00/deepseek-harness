# Agent Note: OpenMontage thin adapter

Status: implemented

English | [中文](2026-08-14-openmontage-thin-adapter.zh.md)

## Problem

Users want [OpenMontage](https://github.com/calesthio/OpenMontage) available as a DeepSeek Harness plugin. OpenMontage is an agent-first video production tree: YAML pipeline manifests, Markdown stage skills, and a Python tool registry. It is AGPL-3.0. Vendoring that tree, or rewriting its hundred-plus tools as Cordis tools, would either relicense the harness or fight OpenMontage's own operating contract.

## Decision

`@deepseek-ai/dsh-openmontage` is an opt-in function plugin and profile bundle under `packages/openmontage/openmontage/`. It takes a required absolute `Config.root`, rejects a path that is not an OpenMontage checkout (`AGENT_GUIDE.md` plus `pipeline_defs/`), and registers:

- prompt variable `openmontage_root`
- prompt section `openmontage` (`order` 150)
- bundled skills `openmontage` and `openmontage-onboarding`

The agent reads the checkout and runs its Python tools through the existing bash and filesystem tools. The bundle patch reads `OPENMONTAGE_ROOT`. The row is absent from `dsh-base`, `web`, and `headless`.

The adapter ships MIT-licensed Harness-owned prompt text and gateway skills. It does not vendor OpenMontage sources.

## Alternatives considered

**Vendor OpenMontage into `vendor/` or a git submodule.** Rejected because AGPL-3.0 would attach to the shipped tree, and the checkout is a full production studio the harness does not own.

**Wrap each Python tool as a dsh tool or MCP server.** Rejected because OpenMontage's intelligence is the pipeline and stage skills, not a fixed tool list, and a hundred-plus wrappers would drift from that registry.

**Point `dsh-skill-filesystem` at OpenMontage's nested `skills/` tree.** Rejected because filesystem discovery is one level deep and a 700-file catalog would drown the model-facing skill list.

**Mount the plugin disabled in `dsh-base`.** Rejected because a required `root` cannot have a safe shipped default, and opt-ins stay out of shipped profiles.

## Consequences

A profile must add the bundle or insert the row and supply an absolute checkout path. Users clone and set up OpenMontage themselves; API keys stay in that checkout's `.env`. Default web and headless snapshots are unchanged. Package tests pin fail-loud `root` checks, prompt interpolation, skill dispose, and a Loader-booted `cordis.yml` against a fixture checkout. The root `AGENTS.md` layout line is required standing-order inventory; its `verify-doc-budgets` ceiling is 2100 so the file keeps 5% headroom after that line.

## Testing

Package unit tests reject a missing, relative, or non-checkout `root`, and pin interpolated `assemble()` text plus skill dispose. `tests/loader-composition.spec.ts` boots a temporary `cordis.yml` through the Loader with a fixture tree that contains only `AGENT_GUIDE.md` and `pipeline_defs/`.
