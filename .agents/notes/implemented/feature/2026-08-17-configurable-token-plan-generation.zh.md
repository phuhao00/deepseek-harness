# Agent Note: 可配置的 Token Plan 生成模型

Status: implemented

[English](2026-08-17-configurable-token-plan-generation.md) | 中文

## Problem

OpenMontage 的 Token Plan 视频、图片和语音 id 只存在于插件 `Config` 和加载期写入检出 `.env` 的同步里。已经能在模型页选择对话看图模型的用户（[2026-08-17-configurable-vision-model.md](2026-08-17-configurable-vision-model.md)）还需要能在同一页点名 HappyHorse / 万相 / 千问语音合成 id，未点名时仍用插件默认值。若该组只填模型 id、不配密钥或源站，检出在有人手改插件配置或 `.credentials.yaml` 之前无法扣额度。只提供通义套餐、再加上启动环境里的 `QWEN_TOKEN_PLAN_CN_API_KEY`，会把密钥框锁成只读，OpenRouter、OpenAI 或页面上新键入的密钥都存不进去。

## Decision

`@deepseek-ai/dsh-openmontage` 注册实时的 `openmontage` Settings 分节，字段为 `tokenPlanKeyEnv`、`tokenPlanBaseUrl`、`tokenPlanVideoModel`、`tokenPlanImageModel`、`tokenPlanTtsModel` 和 `tokenPlanTtsVoice`。组合条目是底层，用户层覆盖其中一个或多个字段。空的 `tokenPlanKeyEnv` 依次尝试 `OPENMONTAGE_GENERATION_API_KEY`、`QWEN_TOKEN_PLAN_CN_API_KEY`、`QWEN_TOKEN_PLAN_API_KEY` 和 `DASHSCOPE_API_KEY`。具名网关覆盖 OpenRouter、OpenAI 兼容中转站（`OPENAI_API_KEY`）、硅基流动、DeepSeek，以及通义 Token Plan / DashScope；其他 POSIX 名可放自己买的密钥。密钥本身不是 settings 字段：模型页经 `credentials.set` 写入所选可写引用；套餐为自动或所选引用被启动环境锁住时，写入 `OPENMONTAGE_GENERATION_API_KEY`。已知厂商引用会推断其公开源站；中转站或未知引用不推断。settings 提交，或被监视引用上的 `credentials/updated`，会立即重写检出 `.env` 里由本适配器管理的块：`DASHSCOPE_API_KEY`、`TOKEN_PLAN_KEY_ENV`、非 DashScope 引用的镜像、已知时才写的源站，以及四个生成 id。检出的 `token_plan_*` 工具仍需要 DashScope 或 Token Plan 源站；OpenAI 系工具读取 `OPENAI_API_KEY`。Token Plan 没有音乐生成模型，本页也不增加该项。

`dsh-host-apiproxy` 把 `openmontage` 加入 Web settings allowlist。`credentials.describe` 带可选的 `hint` 掩码（前四后四字符），模型页据此显示已加载哪把密钥，而不回显完整值。模型页列出检出 Token Plan 的视频、图片、语音和音色 id（HappyHorse、万相、千问语音合成系统音色），并仍接受自定义 id。选择具名网关会写入其引用，已知时一并写入源站。已配置引用会在状态行和密钥占位符里显示掩码。

## Alternatives considered

**复用 `agent-default-model` / 对话目录。** 否决，因为 HappyHorse、万相和千问语音合成是检出 pipeline 工具，不是 pi-ai 对话模型，`llm.models` 也不会列出它们。

**在 UI 里枚举当前 Token Plan id。** 否决，因为套餐新增 id 会逼客户端改代码；文本框接受检出工具已经认识的 id。

**按模态拆成三个 Settings namespace。** 否决，因为一次检出 `.env` 写入就持有整套绑定。

**密钥和源站只留在插件配置里。** 否决，因为那样模型页只能点名生成 id，扣额度还得去改另一处隐藏配置。

**把 API 密钥存在 `openmontage` Settings 分节。** 否决，因为 settings 响应会脱敏，模型页已经通过 `credentials.set` 写密钥。

**只留通义套餐，自动时把密钥写到国内 Token Plan。** 否决，因为启动环境里的通义密钥会锁死输入框，也无法点名 OpenRouter / OpenAI / 自定义 POSIX 名。

**键入的密钥一律写到当前选中的引用。** 否决作为唯一路径：被环境影子锁住的通义引用会锁死输入框。所选引用不可写时，回退到页面自有引用。

## Consequences

已存储的视频或语音 id、源站或生成密钥会在下一次 settings 或凭据提交时写入 OpenMontage 检出 `.env`。清空模型或源站字段则恢复插件默认值。自动解析在页面自有引用之后仍接受只配了 DashScope 的凭据。未挂载 OpenMontage 或宿主未暴露 `openmontage` 时，模型页隐藏该组。没有 settings 提供方的组合仍在加载时按插件配置同步一次。把绑定指到 OpenRouter 并不会让 `token_plan_*` 改说 OpenRouter 协议；检出工具和源站必须匹配。

## Testing

`packages/openmontage/openmontage/tests/openmontage.spec.ts` 钉住 settings replace 会改写检出 `.env` 里的 `TOKEN_PLAN_VIDEO_MODEL` 与 `TOKEN_PLAN_TTS_MODEL`，以及 `credentials/updated` 会改写 `DASHSCOPE_API_KEY`。`packages/openmontage/openmontage/tests/token-plan-sync.spec.ts` 钉住 settings 覆盖插件配置的合并、OpenRouter / 硅基流动会推断源站、中转站或未知引用不推断，以及镜像 `OPENAI_API_KEY`。`packages/host/apiproxy/tests/api-proxy-config.spec.ts` 钉住 Web allowlist 含 `openmontage`，以及 describe 的 hint 不是完整密钥。`packages/host/apiproxy/tests/credential-hint.spec.ts` 钉住掩码。`packages/client/ui-settings-models/tests/token-plan-generation-fields.client.spec.tsx` 钉住无 namespace 时隐藏、通义环境密钥只读时密钥框仍可编辑并显示已加载掩码、对页面自有引用做 `credentials.set`、写入所选 OpenRouter 引用、一次 mutate 同时写 OpenRouter 引用和源站、自定义凭据名、目录视频 id 提交，以及清空自定义语音 id。
