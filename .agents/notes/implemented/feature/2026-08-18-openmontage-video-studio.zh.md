# Agent Note: OpenMontage 视频制作页

Status: implemented

[English](2026-08-18-openmontage-video-studio.md) | 中文

## 问题

挂载 [OpenMontage 薄适配器](2026-08-14-openmontage-thin-adapter.md) 的用户仍靠自由聊天开制作。时长与清晰度已有 Host settings，但没有 Web 表单去绑定 Workspace、附上 OpenWiki 标题，并发送 pipeline 必须遵守的首条用户消息。

## 决策

`@deepseek-ai/dsh-client-ui-openmontage-studio` 是 `dsh-web-app` 里的 Web 客户端插件。它注册 `sidebar.footer.action` 触发器和 `shell.page` 中心栏表单。对应 hole 存在时两个 slot 都会注册；在 `settings.describe` 列出 `openmontage` namespace 之前，触发器返回 null，因此未挂载 Host 适配器的默认 Web profile 不会出现按钮。`shell.page` 由 `ui-layout` 声明，盖住中心栏的 `conversation`，不遮挡侧栏。

提交只走既有动词：`settings.mutate` 写入 `outputDurationSeconds` / `outputResolution` / `outputUpscaleTo` / `generationProfile`，必要时 `workspaces.create`，然后 `workspaces.connectWorkspace`、`sessions.open` 和 `session.prompt(..., 'queue')`。生成清晰度包含 `480p`；可选超分目标必须严格更高（`720p` / `1080p` / `4k`）。表单显示所选 Workspace 绝对路径，以及默认同该路径（或另选）的输出目录；两条路径都写入首条用户消息。生成方案（`auto` / `cost` / `quality` / `drama`）是对 checkout 已有 Token Plan / 管线工具的偏好，不会切换未对接的供应商 API（MiniMax / Seedance / Kling 延后）。首条用户消息是 `formatStudioPrompt` 的输出，因此是已记录的 `user/message`。OpenWiki 上下文是通过 `host.listDirectory` 对所选 Workspace 下 `openwiki/` 或 `OpenWiki/` 目录做仅名称遍历。粘贴栏承载列表读不到的文本。Goldfish wiki MCP 不进入 `dsh --profile web`。

Host 适配器仍拥有操作提示词和 skill。当用户消息给出输出目录或生成方案时，操作段要求 pipeline 仅用 checkout 已配置工具遵守它们。时长、清晰度、超分与方案不写入 OpenMontage 检出 `.env`。

## 考虑过的替代方案

**只有 Settings 字段、没有页面。** 否决，因为开制作需要简报、Workspace 和首条用户消息，而不是模型页再加一组字段。

**继续用 `shell.overlay` 弹层。** 否决，因为产品要求中心栏 SPA 表面；于是在 `ui-layout` 增加 `shell.page`，侧栏仍可操作。

**从 harness 仓库 `openwiki/` 捆绑 slug/标题/摘要目录。** 否决，因为制作 Workspace 常常是 OpenMontage 检出，其 sandbox 读不到 harness 树；列出该 Workspace 自己的 `openwiki/` 目录才与 agent 将使用的目录一致。

**嵌入 OpenCut 时间线。** 否决，因为薄适配器约定把 OpenMontage/OpenCut 留在 Web shell 之外；工作室把会话交给既有 skill pipeline。

**把 Host 插件写进随包 `web` / `headless` / `dsh-base`。** 否决，因为 `root` 仍无安全默认；客户端行可进 `dsh-web-app`，按钮在未挂载时保持隐藏。

**工作室自造第二套会话创建 RPC。** 否决，因为 `connectWorkspace` 已经复用或创建 Workspace 空白会话。

## 后果

在 Web host 上挂载 OpenMontage 的 profile 会在侧栏脚显示「视频制作」。打开后中心栏换成工作室页，直到关闭或提交成功。模型可见简报由本客户端包 README 的 Model Experience 和 `formatStudioPrompt` 文件快照拥有。默认的无密钥 headless snapshot 保持不变。

## 测试

包测试钉住 apply 注册与挂载信号、提交动词顺序、仅名称 wiki 遍历、中心页校验（含 480p + 超分），以及 `formatStudioPrompt` 文件快照。`ui-layout` 测试钉住 `shell.page` 声明。没有组装后的 headless example 回放，因为工作室是 Web 中心页。
