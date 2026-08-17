# Agent Note: Same-provider vision fallback on image prompts

Status: implemented

English | [中文](2026-08-17-same-provider-vision-fallback.zh.md)

## Problem

A Token Plan (or other gateway) route often advertises both text-only chat models and vision models on one provider key. Users keep a text-only default such as `deepseek-v4-pro` on `qwen-token-plan-cn`. Attaching an image then fails at `session.prompt` with `MODEL_DOES_NOT_SUPPORT_IMAGES`, even though the same route already lists `qwen3.*` and `kimi-*` entries that declare image input.

## Decision

`session.prompt` keeps the explicit-text-only refusal when the current model declares no image input **and** the same provider advertises no image-capable catalog entry. When a sibling on that provider does declare image input, the gateway assigns that sibling as the session-local selection and admits the image. The pick prefers catalog ids that share the provider route's first path segment (`qwen-token-plan-cn` prefers `qwen*`), then sorts by id. The switch is not written to `agent-default-model`. A model whose `inputModalities` is omitted still admits, matching the previous unknown-capability posture.

The ranking lives in `packages/host/apiproxy/src/image-capable-route.ts`. A stored `agent-default-model.imageModel` wins when it is a vision sibling on the route; see [2026-08-17-configurable-vision-model.md](2026-08-17-configurable-vision-model.md). `session.selectModel` still refuses switching back to a text-only model while durable or pending images remain visible.

## Alternatives considered

**Change the user's default to a vision model.** Rejected as the only fix because text-only defaults remain useful; the failure is admission, not the stored default.

**Mark text-only catalog rows as image-capable.** Rejected because the catalog records what the endpoint accepts; over-claiming fails mid-turn after the message is durable.

**Add a configurable preferred vision model id.** Deferred here; shipped in [2026-08-17-configurable-vision-model.md](2026-08-17-configurable-vision-model.md).

## Consequences

An image prompt on a Token Plan text-only default uses a vision sibling on that route without a manual model switch. A provider that advertises only text-only models still returns `MODEL_DOES_NOT_SUPPORT_IMAGES`. The composer selector updates on the next `session.models` read.

## Testing

`packages/host/apiproxy/tests/image-capable-route.spec.ts` pins brand ranking and the empty-catalog miss. `packages/host/apiproxy/tests/api-proxy-models.spec.ts` pins a Token Plan text-only default switching to `qwen3.6-flash` on an image prompt, and a text-only-only provider still refusing.
