# openmontage/ — OpenMontage 适配器

[English](README.md) | 中文

可选接入的薄适配层，把正在运行的 harness 指向本机 [OpenMontage](https://github.com/calesthio/OpenMontage) 检出。该适配器贡献一段系统提示词和两个入口 skill（技能）；agent（智能体）读取该检出，并通过现有的 bash 与文件系统工具运行其 Python 工具。OpenMontage 本身不入库。

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`openmontage/`](openmontage/README.md) | 校验检出，贡献操作提示词和入口 skill | 注册到 `ctx.skills` 与 `ctx.systemPrompt` |

该包是一个 profile 组合包。它不是 `dsh-base` 的一部分。用 `dsh plugin add` 或 profile 补丁启用。配置与许可证边界见[包 README](openmontage/README.md)。
