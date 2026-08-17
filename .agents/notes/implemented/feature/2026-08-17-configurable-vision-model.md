# Agent Note: Configurable preferred vision model

Status: implemented

English | [中文](2026-08-17-configurable-vision-model.zh.md)

## Problem

Same-provider image-prompt fallback ([2026-08-17-same-provider-vision-fallback.md](2026-08-17-same-provider-vision-fallback.md)) always ranked Qwen-branded catalog ids first. Token Plan users need to name a specific vision sibling (`qwen3.6-plus`, `kimi-k2.5`, …) from the Models page, and keep the Qwen ranking when they name none.

## Decision

`agent-default-model.imageModel` is an optional same-provider catalog id. The Models page exposes it when the host serves that namespace: a select of `llm.models` rows that declare image input, plus Automatic (prefer Qwen), which unsets the field. `pickImageCapableModel` uses that id when it is a vision sibling on the current route; otherwise it keeps the Qwen-brand ranking. `saveSelection` keeps a stored `imageModel` so a composer chat-model switch does not clear it. The session-local image-prompt switch is still not written as the deployment default.

## Alternatives considered

**Per-provider `imageModel` on the pi-ai profile.** Rejected because the fallback is a product default, not a route-catalog override, and composer `saveSelection` already owns `agent-default-model`.

**Switch provider on image attach.** Rejected because the image-prompt path stays on the current route's credential.

## Consequences

A stored Token Plan vision id is used on the next image prompt. An empty or unknown id keeps the Qwen sibling. The Models page hides the control when `agent-default-model` is not exposed.

## Testing

`packages/core/agent-default-model/tests/agent-default-model.spec.ts` pins `saveSelection` keeping `imageModel` and a blank field reading as unset. `packages/host/apiproxy/tests/image-capable-route.spec.ts` and `api-proxy-models.spec.ts` pin a configured id winning over Qwen ranking. `packages/client/ui-settings-models/tests/image-model-field.client.spec.tsx` pins the catalog filter, the set write, and the Automatic unset.
