# Agent Note：OpenCut 薄适配与 OpenMontage 交接

Status: implemented

[English](2026-08-17-opencut-thin-adapter.md) | 中文

## 问题

用户希望把 [OpenCut](https://github.com/OpenCut-app/OpenCut) 接到 DeepSeek Harness，并与已有的 OpenMontage 适配器联用。OpenCut 是 MIT 的视频编辑器，正在重写。官方 Editor API、MCP 和无头渲染仍标为即将提供，还不是可加载的接口。把编辑器入库、包装第三方 Playwright MCP，或把 `opencut-classic` 当成官方树，要么交付 harness 并不拥有的整棵应用，要么把适配器绑到非官方的控制路径上。

## 决策

`@deepseek-ai/dsh-opencut` 是 `packages/opencut/opencut/` 下的可选函数插件兼 profile 组合包。它要求绝对路径 `Config.root`，拒绝不是官方重写版检出的路径（须有 `moon.yml` 和 `apps/web/`），并注册：

- 提示词变量 `opencut_root`
- 提示词段 `opencut`（`order` 为 160）
- 内置 skill `opencut` 与 `opencut-openmontage`

agent 通过现有的 bash 与文件系统工具启动重写版编辑器（`proto use`、`moon run web:dev`、`moon run api:dev`）。组合补丁读取 `OPENCUT_ROOT` 和 `OPENCUT_UPDATE`（默认 `pull`）。树校验通过后，`apply()` 会 fetch `origin`，并在干净工作区落后上游时快进；`check` 落后则失败；`off` 跳过 git；没有 `.git` 的树保持不动。随附的 `dsh-base`、`web` 和 `headless` 模板都不挂这一行。

联用是同时挂上两个适配器，而不是第三个包。OpenMontage 负责 pipeline 制作。OpenCut 负责编辑器。OpenMontage 的操作段在已注册 `opencut-openmontage` 时点名它。交接 skill 正文代入 `opencut_root`，并在已挂载 `@deepseek-ai/dsh-openmontage` 时代入当前的 `openmontage_root`；若 OpenMontage 未挂载，正文会写明插件未挂载。

适配器只随包提供 MIT 的 Harness 自有提示词文本和入口 skill。它不把 OpenCut 源码入库。

## 考虑过的替代方案

**把 OpenCut 放进 `vendor/` 或 git submodule。** 否决，因为该检出是完整编辑器（web、桌面、Rust 核心），harness 并不拥有它。

**把 RavenMeld/OpenCut-MCP 或其他 Playwright 控制器包成 dsh 工具。** 否决，因为那些服务针对 `opencut-classic`，不是官方 MCP，而且会把非官方的 page.evaluate 路径包成一百多个工具。

**把 `opencut-classic` 也认作 `Config.root`。** 否决，因为用户给出的是官方重写版，classic 标记会悄悄接受错误检出。

**把 OpenCut 并进 `@deepseek-ai/dsh-openmontage`。** 否决，因为只做编辑的用户不该被迫提供 OpenMontage 根目录，只做制作的用户也不该被迫提供 OpenCut 根目录。

**只等官方 MCP 和 Editor API。** 否决作为唯一适配方式：那些接口还不能加载，而用户在 OpenMontage 出片后已经需要本机编辑器交接。

## 后果

profile 必须添加 OpenCut 组合包（联用时再加上 OpenMontage 组合包），并提供绝对检出路径。用户自己克隆和设置每一棵树。默认 web 与 headless snapshot 不变。包测试钉住响亮失败的 `root` 检查、加载期 git 同步、提示词插值、skill dispose、未挂载与已挂载 OpenMontage 的代入，以及用 Loader 启动、同时挂上两个适配器的临时 `cordis.yml`（对着夹具检出）。

## 测试

包内单测拒绝缺失、相对或非重写版的 `root`，钉住插值后的 `assemble()` 文本和 skill dispose，分别钉住缺少与已挂载 `openmontage_root` 时的交接 skill，并用本地 git remote 钉住 `update` 模式（`off`/`check`/`pull`、脏工作区拒绝）。`tests/loader-composition.spec.ts` 用 Loader 启动临时 `cordis.yml`，对着两棵夹具树。
