# Agent Note: Configurable Token Plan generation models

Status: implemented

English | [中文](2026-08-17-configurable-token-plan-generation.zh.md)

## Problem

OpenMontage Token Plan video, image, and speech ids lived only on plugin `Config` and load-time checkout `.env` sync. Users who already pick a chat vision model on the Models page ([2026-08-17-configurable-vision-model.md](2026-08-17-configurable-vision-model.md)) also need to name HappyHorse / Wan / Qwen-Audio TTS ids there, and keep the plugin defaults when they name none. Naming only the model ids without a key or origin on that same group leaves the checkout unable to spend credits until someone edits plugin config or `.credentials.yaml` by hand. A Qwen-only plan select plus a launch-environment `QWEN_TOKEN_PLAN_CN_API_KEY` then locked the key field, so OpenRouter, OpenAI, or a page-typed key could not be saved.

## Decision

`@deepseek-ai/dsh-openmontage` registers a live `openmontage` settings section with `tokenPlanKeyEnv`, `tokenPlanBaseUrl`, `tokenPlanVideoModel`, `tokenPlanImageModel`, `tokenPlanTtsModel`, and `tokenPlanTtsVoice`. The composition entry is the base layer; the user layer overrides one or more fields. An empty `tokenPlanKeyEnv` tries `OPENMONTAGE_GENERATION_API_KEY`, then `QWEN_TOKEN_PLAN_CN_API_KEY`, `QWEN_TOKEN_PLAN_API_KEY`, and `DASHSCOPE_API_KEY`. Named gateways cover OpenRouter, an OpenAI-compatible relay (`OPENAI_API_KEY`), SiliconFlow, DeepSeek, and Qwen Token Plan / DashScope; any other POSIX name holds a purchased key. The secret itself is not a settings field: the Models page writes it through `credentials.set` on the selected writable ref, or on `OPENMONTAGE_GENERATION_API_KEY` when the select is Automatic or the selected ref is launch-environment locked. Known vendor refs infer their public origin; a relay or unknown ref does not. A committed settings change or a `credentials/updated` for a watched ref rewrites the checkout `.env` managed block immediately: `DASHSCOPE_API_KEY`, `TOKEN_PLAN_KEY_ENV`, a mirror of a non-DashScope ref, an origin only when one is known, and the four generation ids. Checkout `token_plan_*` tools still need a DashScope or Token Plan origin; OpenAI-family tools read `OPENAI_API_KEY`. Token Plan has no music-generation model, so this page does not add one.

`dsh-host-apiproxy` adds `openmontage` to the Web settings allowlist. `credentials.describe` includes an optional `hint` mask (first four and last four characters) so the Models page can show which key is loaded without echoing the secret. The page lists the checkout Token Plan video, image, speech, and voice ids (HappyHorse, Wan, Qwen-Audio-TTS system voices) and still accepts a custom id. Selecting a named gateway writes its ref and, when known, its origin. The status line and key placeholder show the hint when a ref is configured.

## Alternatives considered

**Reuse `agent-default-model` / the chat catalog.** Rejected because HappyHorse, Wan, and Qwen-Audio TTS are checkout pipeline tools, not pi-ai chat models, and `llm.models` does not list them.

**Enum the current Token Plan ids in the UI.** Rejected because a new plan id would require a client change; a text field accepts the id the checkout tools already take.

**A third settings namespace per modality.** Rejected because one checkout `.env` write owns the whole binding.

**Keep the key and origin on plugin config only.** Rejected because the Models page would then name generation ids that cannot spend credits without a second, hidden edit.

**Store the API key in the `openmontage` settings section.** Rejected because settings responses are redacted and the Models page already writes secrets through `credentials.set`.

**Keep a Qwen-only plan select and write Automatic keys to China Token Plan.** Rejected because a launch-environment Qwen key locked the field, and OpenRouter / OpenAI / a custom POSIX name could not be named.

**Always write typed keys to the selected ref.** Rejected as the only path: an env-shadowed Qwen ref would lock the input. The page-owned ref is the fallback when the selected ref is not writable.

## Consequences

A stored video or speech id, origin, or generation key is written to the OpenMontage checkout `.env` on the next settings or credential commit. Clearing a model or origin field restores the plugin default. Automatic resolution still accepts a DashScope-only credential after the page-owned ref. The Models page hides the group when OpenMontage is not mounted or the host does not expose `openmontage`. A composition without a settings provider still syncs once from plugin config at load. Pointing the binding at OpenRouter does not make `token_plan_*` speak OpenRouter; the checkout tool and origin must match.

## Testing

`packages/openmontage/openmontage/tests/openmontage.spec.ts` pins a settings replace rewriting `TOKEN_PLAN_VIDEO_MODEL` and `TOKEN_PLAN_TTS_MODEL`, and a `credentials/updated` rewriting `DASHSCOPE_API_KEY`, in the checkout `.env`. `packages/openmontage/openmontage/tests/token-plan-sync.spec.ts` pins settings-over-config merge, inferred OpenRouter / SiliconFlow origins, an empty origin for a relay or unknown ref, and mirroring `OPENAI_API_KEY`. `packages/host/apiproxy/tests/api-proxy-config.spec.ts` pins `openmontage` on the Web allowlist and a describe hint that is not the secret. `packages/host/apiproxy/tests/credential-hint.spec.ts` pins the mask. `packages/client/ui-settings-models/tests/token-plan-generation-fields.client.spec.tsx` pins hide-when-absent, an editable key beside a locked Qwen env with the loaded hint, `credentials.set` on the page-owned ref, a write to a selected OpenRouter ref, OpenRouter ref-plus-origin in one mutate, a custom credential name, a catalog video-id commit, and unset of a custom speech id.
