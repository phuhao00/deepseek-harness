# @deepseek-ai/dsh-client-ui-openmontage-studio

English | [中文](README.zh.md)

Web video-studio center page. The sidebar-foot `sidebar.footer.action` trigger and the `shell.page` form register whenever those holes exist; the trigger renders nothing until `settings.describe` lists the `openmontage` namespace. The page fills the center column over `conversation` without covering the sidebar. Submit writes the chosen duration, generation resolution, and optional upscale target as `openmontage` settings defaults, creates a Workspace when the user picked a new directory, connects that Workspace's blank session through `ctx.workspaces.connectWorkspace`, opens it, and queues one structured user message. The Host OpenMontage adapter owns the operating prompt and skills; this package only formats the first user message. OpenWiki pages are the directory names under the selected Workspace's `openwiki/` (or `OpenWiki/`) tree, listed through the existing `host.listDirectory` verb. Markdown files are not listed; the paste field carries excerpts the listing cannot read.

## Model Experience

### Studio first user message

#### What the model sees

Each studio submission appends one `user/message` whose body is `formatStudioPrompt` output: a fixed Chinese instruction, the chosen duration and generation resolution, an optional upscale target, a generation profile, the Workspace path, the output directory, the brief, selected OpenWiki directory titles, and an optional pasted excerpt. The duration line is one of the two variants in the fence below: without upscale, or with `超分到` when the form selected a higher target. The output directory defaults to the Workspace path and is always written into the message. Generation profiles (`自动` / `极致性价比` / `成片优先` / `短剧量产`) are agent preferences over checkout Token Plan / pipeline tools; they do not switch unconnected vendor APIs.

##### Studio brief layout

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

#### Token effect

Conditional: one user message per submission. The instruction lines are fixed; duration, resolution, upscale, profile, paths, brief, titles, and pasted excerpt grow with the form.

#### KV Cache effect

Independent of earlier studio submissions. The new message appends to that session's history tail; later turns reuse the prefix that includes this message.

## Known Limitations and Deferred Work

- **Directory names only** — `host.listDirectory` returns directories, so OpenWiki entries are folder names, not Markdown titles or first-paragraph summaries.
- **No Goldfish wiki MCP** — the web profile does not mount Cursor's Goldfish tools; personal wiki text is pasted.
- **No in-app timeline** — OpenCut stays a later conversation handoff, not an embedded editor.
- **No assembled headless snapshot** — the studio is a web center page; the model-visible body is pinned by the `formatStudioPrompt` file snapshot instead of a headless example replay.
