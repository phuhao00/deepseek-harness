# opencut/ — OpenCut 适配器

[English](README.md) | 中文

可选接入的薄适配层，把正在运行的 harness 指向本机 [OpenCut](https://github.com/OpenCut-app/OpenCut) 重写版检出。该适配器贡献一段系统提示词和两个入口 skill（技能）；agent（智能体）启动该编辑器，并通过现有的 bash 与文件系统工具把 OpenMontage 成片交到时间线。OpenCut 本身不入库。

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`opencut/`](opencut/README.md) | 校验检出，贡献操作提示词、编辑器 skill，以及 OpenMontage 交接 skill | 注册到 `ctx.skills` 与 `ctx.systemPrompt` |

该包是一个 profile 组合包。它不是 `dsh-base` 的一部分。用 `dsh plugin add` 或 profile 补丁启用。配置以及与 OpenMontage 的联合使用约定见[包 README](opencut/README.md)。
