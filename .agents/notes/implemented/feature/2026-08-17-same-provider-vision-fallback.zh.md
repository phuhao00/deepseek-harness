# Agent Note: 同提供方看图回退

Status: implemented

[English](2026-08-17-same-provider-vision-fallback.md) | 中文

## Problem

一条 Token Plan（或其他网关）路由常常在同一提供方密钥下同时公布纯文本聊天模型和视觉模型。用户会把默认模型留在纯文本上，例如 `qwen-token-plan-cn` 上的 `deepseek-v4-pro`。此时附加图片会在 `session.prompt` 以 `MODEL_DOES_NOT_SUPPORT_IMAGES` 失败，即使同一路由已经列出声明接受图片的 `qwen3.*` 和 `kimi-*` 条目。

## Decision

当当前模型声明不接受图片、**并且**同一提供方目录里也没有声明接受图片的条目时，`session.prompt` 仍按「明确纯文本」拒绝。若该提供方有声明接受图片的兄弟条目，网关把该条目指定为本会话选择并放行图片。挑选优先选择 id 与提供方路由第一段相同的目录条目（`qwen-token-plan-cn` 优先 `qwen*`），再按 id 排序。该切换不会写入 `agent-default-model`。省略 `inputModalities` 的模型仍放行，与原先「未知能力」姿态一致。

排序逻辑在 `packages/host/apiproxy/src/image-capable-route.ts`。已存储的 `agent-default-model.imageModel` 若是该路由上的视觉兄弟则优先，见 [2026-08-17-configurable-vision-model.md](2026-08-17-configurable-vision-model.md)。只要持久或待处理图片仍可见，`session.selectModel` 仍拒绝切回纯文本模型。

## Alternatives considered

**只把用户默认模型改成视觉模型。** 否决为唯一修复，因为纯文本默认值仍然有用；失败点在准入，不在已存储的默认值。

**把纯文本 catalog 行标成接受图片。** 否决，因为 catalog 记录的是端点实际接受的模态；夸大声明会在消息已经持久化之后、轮次中途失败。

**再加一个可配置的首选视觉模型 id。** 此处推迟；已在 [2026-08-17-configurable-vision-model.md](2026-08-17-configurable-vision-model.md) 落地。

## Consequences

在 Token Plan 纯文本默认值上发送带图提示词时，会使用该路由上的视觉兄弟模型，无需手动切换。只公布纯文本模型的提供方仍返回 `MODEL_DOES_NOT_SUPPORT_IMAGES`。composer 选择器在下一次读取 `session.models` 时更新。

## Testing

`packages/host/apiproxy/tests/image-capable-route.spec.ts` 钉住品牌排序和空目录未命中。`packages/host/apiproxy/tests/api-proxy-models.spec.ts` 钉住 Token Plan 纯文本默认值在带图提示词时切到 `qwen3.6-flash`，以及仅有纯文本的提供方仍拒绝。
