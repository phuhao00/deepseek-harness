# Agent Note: OpenMontage video studio page

Status: implemented

English | [中文](2026-08-18-openmontage-video-studio.zh.md)

## Problem

Users who mount the [OpenMontage thin adapter](2026-08-14-openmontage-thin-adapter.md) still start production by typing a free-form chat message. Duration and resolution have Host settings, but there is no Web form that binds a Workspace, attaches OpenWiki titles, and sends a first user message the pipeline must obey.

## Decision

`@deepseek-ai/dsh-client-ui-openmontage-studio` is a Web client plugin in `dsh-web-app`. It registers a `sidebar.footer.action` trigger and a `shell.page` center-pane form. Both slots always register when their holes exist; the trigger returns null until `settings.describe` lists the `openmontage` namespace, so a default Web profile without the Host adapter shows no button. `shell.page` is declared by `ui-layout` and fills the center column over `conversation` without covering the sidebar.

Submit uses existing verbs only: `settings.mutate` for `outputDurationSeconds` / `outputResolution` / `outputUpscaleTo` / `generationProfile`, optional `workspaces.create`, `workspaces.connectWorkspace`, `sessions.open`, and `session.prompt(..., 'queue')`. Generation resolution includes `480p`; an optional upscale target must be strictly higher (`720p` / `1080p` / `4k`). The form shows the selected Workspace absolute path and an output directory that defaults to that path (or a separately picked directory). Both paths are always written into the first user message. A generation profile (`auto` / `cost` / `quality` / `drama`) is an agent preference over checkout Token Plan / pipeline tools; it does not switch unconnected vendor APIs (MiniMax / Seedance / Kling stay deferred). The first user message is `formatStudioPrompt` output and is therefore a logged `user/message`. OpenWiki context is a names-only walk of the selected Workspace's `openwiki/` or `OpenWiki/` directories through `host.listDirectory`. The paste field carries text that listing cannot read. Goldfish wiki MCP stays out of `dsh --profile web`.

The Host adapter still owns the operating prompt and skills. When the user message names an output directory or generation profile, the operating section requires the pipeline to obey them using configured checkout tools only. Duration, resolution, upscale, and profile are not written to the OpenMontage checkout `.env`.

## Alternatives considered

**Settings fields only, no page.** Rejected because a production start needs a brief, a Workspace, and a first user message, not another Models-page group.

**Keep `shell.overlay` modal.** Rejected once the product asked for a center-pane SPA surface; `shell.page` was added to `ui-layout` so the sidebar stays usable.

**Bundle a slug/title/summary catalog from the harness `openwiki/` tree.** Rejected because the production Workspace is often an OpenMontage checkout whose sandbox cannot read the harness tree; listing that Workspace's own `openwiki/` directory matches the directory the agent will use.

**Embed an OpenCut timeline.** Rejected because the thin-adapter contract keeps OpenMontage/OpenCut out of the Web shell; the studio hands the session to the existing skill pipeline.

**Register the Host plugin in shipped `web` / `headless` / `dsh-base`.** Rejected because `root` still has no safe default; the client row may ship in `dsh-web-app` while the button stays hidden.

**A second session-create RPC owned by the studio.** Rejected because `connectWorkspace` already reuses or creates the Workspace blank session.

## Consequences

A profile that mounts OpenMontage on a Web host shows 视频制作 in the sidebar foot. Opening it replaces the center conversation with the studio page until close or successful submit. The model-visible brief is owned by this client package's README Model Experience and the `formatStudioPrompt` file snapshot. Default keyless headless snapshots stay unchanged.

## Testing

Package tests pin apply registration and mount signalling, submit verb order, the names-only wiki walk, center-page validation (including 480p + upscale), and the `formatStudioPrompt` file snapshot. `ui-layout` tests pin the `shell.page` declaration. There is no assembled headless example replay because the studio is a Web center page.
