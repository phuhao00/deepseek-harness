# @deepseek-ai/dsh-opencut

[English](README.md) | 中文

可选接入的适配器，把 DeepSeek Harness 指向本机 [OpenCut](https://github.com/OpenCut-app/OpenCut) 重写版检出。插件校验该检出，贡献一段系统提示词和两个入口 skill（技能），并把编辑工作留给 agent（智能体），由其使用现有的 bash 与文件系统工具完成。它不把 OpenCut 入库，不包装 Playwright MCP，也不加入 `dsh-base`。

该包同时也是 profile 组合包（`dsh.bundle.patch`）。用 `dsh plugin --profile <name> add @deepseek-ai/dsh-opencut` 启用，或在 profile 的 `cordis.patch.yml` 中插入同一行。从源码检出安装时，`dsh plugin --profile <name> add ./packages/opencut/opencut` 会链接该 workspace 包。

## 前置条件

在将要运行 agent 的机器上克隆官方重写版。适配器从不安装那棵目录树。该 README 里列出的官方 MCP、无头渲染和 Editor API 仍是即将提供的能力，还不是可加载的接口。

```sh
git clone https://github.com/OpenCut-app/OpenCut.git
cd OpenCut
proto use
```

本适配器只认重写版（须有 `moon.yml` 和 `apps/web/`）。它拒绝 [opencut-classic](https://github.com/OpenCut-app/opencut-classic)。OpenCut 是 [MIT](https://github.com/OpenCut-app/OpenCut/blob/main/LICENSE)。本适配器是 MIT，只随包提供 Harness 自有的提示词文本和入口 skill。

## 与 OpenMontage 联用

用户要在同一次会话里既做生成又做时间线精剪时，同时挂上两个适配器。OpenMontage 负责 pipeline 制作；OpenCut 负责编辑器。

```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-openmontage
dsh plugin --profile <name> add @deepseek-ai/dsh-opencut
```

导出两个绝对路径（`OPENMONTAGE_ROOT` 和 `OPENCUT_ROOT`）。pipeline 出片后，模型加载 `opencut-openmontage`，启动重写版编辑器并导入该成片。OpenMontage 的操作段会点名这个 skill；skill 正文由本包持有。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `root` | `OPENCUT_ROOT` | OpenCut 重写版检出的绝对路径。必须包含 `moon.yml` 和 `apps/web/`。省略 `root` 时在加载期从环境变量解析，然后校验该目录树。 |
| `update` | `pull` | 加载期 git 同步：`pull` 在干净工作区落后上游时 fetch 并快进；`check` 落后则失败；`off` 跳过 git。可用 `OPENCUT_UPDATE` 覆盖。 |

随包组合补丁读取 `OPENCUT_ROOT`：

```yaml
- insert:
    - id: opencut
      name: '@deepseek-ai/dsh-opencut'
      config:
        root: !!js process.env.OPENCUT_ROOT
        update: !!js process.env.OPENCUT_UPDATE ?? 'pull'
```

环境变量缺失且省略 `config.root` 时，`apply()` 在加载期失败。相对路径、缺失目录、或不是 OpenCut 重写版检出的目录，也会让 `apply()` 抛出带 `opencut:` 前缀的错误。插件不会跳过错误的 `root`。树校验通过后，`update: pull` 会 fetch `origin`，并在干净工作区落后上游时快进；落后且工作区脏则加载失败。`check` 在落后时失败且不合并。没有 `.git` 的目录保持不动，以便夹具树仍能加载。

设置完成后，把 `OPENCUT_ROOT` 导出为检出的绝对路径，或在 profile 补丁中重写 `config.root`。

## 插件

`inject: ['skills', 'systemPrompt']`。加载时它会注册：

- 提示词变量 `opencut_root` → `config.root`
- 提示词段 `opencut`（`order` 为 160）
- 内置 skill 提供方 `opencut`，含 `opencut` 与 `opencut-openmontage`

编辑器 skill 把 agent 指向 `{root}/README.md` 以及 `moon run web:dev` / `moon run api:dev`。交接 skill 会代入 `opencut_root`，并在已挂载 `@deepseek-ai/dsh-openmontage` 时代入当前的 `openmontage_root`。skill 正文不复制 OpenCut 源码。

## 模型体验

### OpenCut 操作段

#### 模型看到什么

在该插件的注册作用域内，每次组装都会收到下面的操作段。插值后的检出路径就是已配置的 `root`。

##### OpenCut 操作指引

```markdown
Timeline editing uses the OpenCut checkout at {{opencut_root}}. When the user asks to edit, trim, caption, arrange, or polish a video on a timeline, load the `opencut` skill. After OpenMontage has produced a render and the next step is the editor, load `opencut-openmontage`. Start the rewrite editor from that checkout with `proto use`, then `moon run web:dev` (http://localhost:5173) and `moon run api:dev` (http://localhost:8787). Official Editor API, MCP, and headless rendering are not available in this checkout yet. Use the existing bash and filesystem tools. Do not wrap third-party Playwright MCP servers or treat this tree as opencut-classic.
```

#### Token 影响

插件挂载期间，每次请求都有一小段固定指引开销，外加插值路径的长度。

#### KV Cache 影响

在插件保持挂载且 `root` 不变时，前缀稳定。更改 `root`，或挂载／卸载插件，可能使该段无法继续复用。

### 入口 skill

#### 模型看到什么

`@deepseek-ai/dsh-tool-skill` 渲染两条目录条目，以及已代入检出路径的所选 skill 正文。

#### Token 影响

skill 工具可见时，目录描述是一小段固定开销。已加载的正文会作为工具历史保留到后续步骤。

#### KV Cache 影响

两个 skill 保持注册时，目录前缀稳定。加载某个 skill 会追加其正文；之后只改随包模板正文不会改写旧结果。

## 已知限制与暂缓事项

- **OpenCut 是单独的检出** — 本包不安装 proto、moon、Rust 或重写版工具链，也不把该仓库入库。
- **没有一等 OpenCut 工具** — 官方 MCP、无头导出和 Editor API 还不在该检出里；模型使用现有的 bash 与文件系统工具。
- **只认重写版** — `opencut-classic` 和托管的 opencut.app 不在范围内。
- **不在随附 profile 中** — `dsh-base`、`web` 和 `headless` 不挂载这一行；profile 必须添加该组合包或插入该插件。
