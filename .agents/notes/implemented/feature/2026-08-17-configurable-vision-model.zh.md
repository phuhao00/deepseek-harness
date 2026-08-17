# Agent Note: 可配置的首选看图模型

Status: implemented

[English](2026-08-17-configurable-vision-model.md) | 中文

## Problem

同提供方带图提示词回退（[2026-08-17-same-provider-vision-fallback.md](2026-08-17-same-provider-vision-fallback.md)）始终把 Qwen 品牌的目录 id 排在最前。Token Plan 用户需要能在模型页点名某个视觉兄弟模型（`qwen3.6-plus`、`kimi-k2.5` 等），未点名时仍走 Qwen 排序。

## Decision

`agent-default-model.imageModel` 是可选的同提供方目录 id。宿主提供该 namespace 时，模型页会暴露它：下拉列出 `llm.models` 中声明接受图片的行，外加「自动（优先 Qwen）」以取消该字段。`pickImageCapableModel` 在该 id 是当前路由上的视觉兄弟时使用它，否则仍按 Qwen 品牌排序。`saveSelection` 会保留已存储的 `imageModel`，因此 composer 切换对话模型不会清掉它。带图提示词的会话级切换仍然不会写成部署默认值。

## Alternatives considered

**把 `imageModel` 放在 pi-ai profile 上按提供方配置。** 否决，因为这次回退是产品默认值，不是路由目录覆盖；composer 的 `saveSelection` 已经持有 `agent-default-model`。

**附加图片时切换提供方。** 否决，因为带图提示词路径继续使用当前路由的凭据。

## Consequences

已存储的 Token Plan 视觉 id 会在下一次带图提示词时使用。空或未知 id 仍走 Qwen 兄弟模型。宿主未暴露 `agent-default-model` 时，模型页隐藏该控件。

## Testing

`packages/core/agent-default-model/tests/agent-default-model.spec.ts` 钉住 `saveSelection` 保留 `imageModel`，以及空白字段读成未设置。`packages/host/apiproxy/tests/image-capable-route.spec.ts` 与 `api-proxy-models.spec.ts` 钉住已配置 id 优先于 Qwen 排序。`packages/client/ui-settings-models/tests/image-model-field.client.spec.tsx` 钉住目录过滤、写入 set，以及「自动」的 unset。
