# Agent Note: OpenMontage thin adapter

Status: implemented

[English](2026-08-14-openmontage-thin-adapter.md) | 中文

## Problem

用户希望把 [OpenMontage](https://github.com/calesthio/OpenMontage) 做成 DeepSeek Harness 插件。OpenMontage 是一套 agent（智能体）优先的视频生产树：YAML pipeline 清单、Markdown 阶段 skill（技能），以及 Python 工具注册表。它是 AGPL-3.0。把那棵树 vendor 进来，或把它一百多个工具重写成 Cordis 工具，要么会把 harness 卷进该许可证，要么会和 OpenMontage 自己的操作约定对着干。

## Decision

`@deepseek-ai/dsh-openmontage` 是 `packages/openmontage/openmontage/` 下的可选函数插件兼 profile 组合包。它要求绝对路径 `Config.root`，拒绝不是 OpenMontage 检出的路径（须有 `AGENT_GUIDE.md` 和 `pipeline_defs/`），并注册：

- 提示词变量 `openmontage_root`
- 提示词段 `openmontage`（`order` 为 150）
- 内置 skill `openmontage` 与 `openmontage-onboarding`

agent 读取该检出，并通过现有的 bash 与文件系统工具运行其 Python 工具。组合包补丁读取 `OPENMONTAGE_ROOT` 和 `OPENMONTAGE_UPDATE`（默认 `pull`）。树校验通过后，`apply()` 会 fetch `origin`，并在干净工作区落后上游时快进；`check` 落后则失败；`off` 跳过 git；没有 `.git` 的树保持不动。随附的 `dsh-base`、`web` 和 `headless` 模板都不包含这一行。

适配器只随包提供 MIT 许可的、Harness 自有的提示词文本和入口 skill。它不把 OpenMontage 源码入库。

## Alternatives considered

**把 OpenMontage vendor 进 `vendor/` 或做成 git submodule。** 否决，因为 AGPL-3.0 会附着到随附树，而且该检出是 harness 并不拥有的完整制作工作室。

**把每个 Python 工具包成 dsh 工具或 MCP 服务器。** 否决，因为 OpenMontage 的智能在 pipeline 和阶段 skill，不在固定工具清单；一百多个包装会和那个注册表脱节。

**让 `dsh-skill-filesystem` 指向 OpenMontage 嵌套的 `skills/` 树。** 否决，因为文件系统发现只扫一层，而且 700 个文件的目录会淹没面向模型的 skill 列表。

**在 `dsh-base` 里以 disabled 挂载该插件。** 否决，因为必填的 `root` 没有安全的随附默认值，而且可选能力不进随附 profile。

## Consequences

profile 必须添加该组合包或插入该行，并提供检出的绝对路径。用户自己克隆并设置 OpenMontage；API 密钥留在该检出的 `.env`。默认的 web 和 headless snapshot 不变。包测试钉住 `root` 的响亮失败、加载期 git 同步、提示词插值、skill 卸载，以及用夹具检出通过 Loader 启动的 `cordis.yml`。根 `AGENTS.md` 的布局行是必要的现行清单；其 `verify-doc-budgets` 上限为 2100，以便在加入该行后仍保留 5% 余量。

## Testing

包内单测拒绝缺失、相对或非检出的 `root`，钉住插值后的 `assemble()` 文本以及 skill 卸载，并用本地 git remote 钉住 `update` 模式（`off`/`check`/`pull`、脏工作区拒绝）。`tests/loader-composition.spec.ts` 通过 Loader 启动临时 `cordis.yml`，夹具树只含 `AGENT_GUIDE.md` 和 `pipeline_defs/`。
