# @deepseek-ai/dsh-client-ui-openmontage-studio

[English](README.md) | 中文

Web 视频制作中心页。侧栏脚的 `sidebar.footer.action` 触发器和 `shell.page` 表单在对应 hole 存在时就会注册；在 `settings.describe` 列出 `openmontage` namespace 之前，触发器不渲染。页面盖住中心栏的 `conversation`，不遮挡侧栏。提交会把所选时长、生成清晰度与可选超分目标写入 `openmontage` 设置默认值；若用户挑选了新目录则创建 Workspace，再通过 `ctx.workspaces.connectWorkspace` 连接该 Workspace 的空白会话并打开它，然后排队一条结构化用户消息。Host 上的 OpenMontage 适配器拥有操作提示词和 skill；本包只格式化首条用户消息。OpenWiki 页面是所选 Workspace 下 `openwiki/`（或 `OpenWiki/`）树中的目录名，通过既有的 `host.listDirectory` 列出。不会列出 Markdown 文件；粘贴栏承载列表读不到的摘录。

## 模型体验

### 工作室首条用户消息

#### 模型看到什么

每次工作室提交都会追加一条 `user/message`，正文是 `formatStudioPrompt` 的输出：固定中文指令、所选时长与生成清晰度、可选超分目标、生成方案、Workspace 路径、输出目录、简报、所选 OpenWiki 目录标题，以及可选的粘贴摘录。时长行是下面围栏中的两种之一：不超分时没有 `超分到`；表单选了更高目标时带上该字段。输出目录默认同 Workspace 路径，并始终写入首条消息。生成方案（`自动` / `极致性价比` / `成片优先` / `短剧量产`）是对 checkout 已有 Token Plan / 管线工具的偏好，不会切换未对接的供应商 API。

##### 工作室简报布局

```markdown
制作一条视频。
先 load `openmontage` skill，再按 pipeline 执行；用户给出的时长、清晰度、超分目标、输出目录与生成方案必须遵守，不得自行改规格。
时长：{n} 秒。清晰度：{480p|720p|1080p|4k}。
时长：{n} 秒。清晰度：{480p|720p|1080p|4k}。超分到：{720p|1080p|4k}。
生成方案：{自动|极致性价比|成片优先|短剧量产}。
工作区目录：{workspacePath}。
输出目录：{outputPath}。
简报：
{brief}

OpenWiki 上下文：
## {title}
{summary}
## 粘贴摘录
{pasted}
```

#### Token 影响

条件性：每次提交一条用户消息。指令行固定；时长、清晰度、超分、方案、路径、简报、标题与粘贴摘录随表单增长。

#### KV Cache 影响

与更早的工作室提交无关。新消息追加在该会话历史尾部；后续回合复用包含该消息的前缀。

## 已知限制与延后工作

- **仅目录名** — `host.listDirectory` 只返回目录，因此 OpenWiki 条目是文件夹名，不是 Markdown 标题或首段摘要。
- **无 Goldfish wiki MCP** — web profile 不挂载 Cursor 的 Goldfish 工具；个人 wiki 文本靠粘贴。
- **无应用内时间线** — OpenCut 仍是后续对话交接，不是嵌入式编辑器。
- **没有组装后的 headless snapshot** — 工作室是 web 中心页；模型可见正文由 `formatStudioPrompt` 文件快照钉住，而不是 headless example 回放。
