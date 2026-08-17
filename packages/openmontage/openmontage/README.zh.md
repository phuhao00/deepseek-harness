# @deepseek-ai/dsh-openmontage

[English](README.md) | 中文

可选接入的适配器，把 DeepSeek Harness 指向本机 [OpenMontage](https://github.com/calesthio/OpenMontage) 检出。插件校验该检出，贡献一段系统提示词和两个入口 skill（技能），并把制作工作留给 agent（智能体），由其使用现有的 bash 与文件系统工具完成。它不把 OpenMontage 入库，不包装其 Python 工具，也不加入 `dsh-base`。

该包同时也是 profile 组合包（`dsh.bundle.patch`）。用 `dsh plugin --profile <name> add @deepseek-ai/dsh-openmontage` 启用，或在 profile 的 `cordis.patch.yml` 中插入同一行。从源码检出安装时，`dsh plugin --profile <name> add ./packages/openmontage/openmontage` 会链接该 workspace 包。

## 前置条件

在将要运行 agent 的机器上克隆并设置 OpenMontage。适配器从不安装那棵目录树。

```sh
git clone https://github.com/calesthio/OpenMontage.git
cd OpenMontage
make setup
```

没有 `make` 的 Windows PowerShell：`py -3 -m venv .venv; .\.venv\Scripts\Activate.ps1; python -m pip install -r requirements.txt; cd remotion-composer; npm install; cd ..; python -m pip install piper-tts; Copy-Item .env.example .env`。

OpenMontage 仍是 [AGPL-3.0](https://github.com/calesthio/OpenMontage/blob/main/LICENSE)。本适配器是 MIT，只随包提供 Harness 自有的提示词文本和入口 skill。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `root` | `OPENMONTAGE_ROOT` | OpenMontage 检出的绝对路径。必须包含 `AGENT_GUIDE.md` 和 `pipeline_defs/`。省略 `root` 时在加载期从环境变量解析，然后校验该目录树。 |
| `update` | `pull` | 加载期 git 同步：`pull` 在干净工作区落后上游时 fetch 并快进；`check` 落后则失败；`off` 跳过 git。可用 `OPENMONTAGE_UPDATE` 覆盖。 |
| `tokenPlanKeyEnv` | 依次尝试 `OPENMONTAGE_GENERATION_API_KEY`，然后是通义 Token Plan / DashScope 引用 | 写入检出 `.env` 的 POSIX 凭据名：先作为 `DASHSCOPE_API_KEY`，若本身不是该名再镜像一份，以便 OpenAI 系工具能读到 `OPENAI_API_KEY`。任意提供方引用均可。 |
| `tokenPlanBaseUrl` | 对已知的通义 Token Plan / DashScope / OpenRouter / 硅基流动 / DeepSeek 引用推断 | API 源站。OpenAI 兼容中转站（`OPENAI_API_KEY`）和其他未知引用留空，除非显式填写。 |
| `tokenPlanVideoModel` | `happyhorse-1.1-t2v` | 写入检出的默认 Token Plan 视频模型。 |
| `tokenPlanImageModel` | `wan2.7-image` | 写入检出的默认 Token Plan 图片模型。 |
| `tokenPlanTtsModel` | `qwen-audio-3.0-tts-plus` | 写入检出的默认 Token Plan 语音合成模型。 |
| `tokenPlanTtsVoice` | `longanhuan_v3.6` | 写入检出的默认千问语音合成音色。 |

同一套绑定同时也是实时的 `openmontage` Settings 分节。挂载本插件时，模型页可以改密钥引用、源站和四个生成 id。状态行会标出当前解析到的引用、已存密钥的掩码，以及它来自启动环境还是已保存凭据。具名网关（OpenRouter、OpenAI 兼容中转站、硅基流动、DeepSeek、通义 Token Plan / DashScope）会写入引用，已知时一并写入源站。键入的密钥经 `credentials.set` 写入所选可写引用；套餐为自动或所选引用被启动环境锁住时，写入 `OPENMONTAGE_GENERATION_API_KEY`。模型或源站留空则恢复组合默认值并立即重写检出 `.env`。被监视引用上的 `credentials/updated` 会重写同一块。检出的 `token_plan_*` 工具仍需要 DashScope 或 Token Plan 源站；OpenAI 系工具读取 `OPENAI_API_KEY`。

随包组合补丁读取 `OPENMONTAGE_ROOT`：

```yaml
- insert:
    - id: openmontage
      name: '@deepseek-ai/dsh-openmontage'
      config:
        root: !!js process.env.OPENMONTAGE_ROOT
        update: !!js process.env.OPENMONTAGE_UPDATE ?? 'pull'
```

环境变量缺失且省略 `config.root` 时，`apply()` 在加载期失败。相对路径、缺失目录、或不是 OpenMontage 检出的目录，也会让 `apply()` 抛出带 `openmontage:` 前缀的错误。插件不会跳过错误的 `root`。树校验通过后，`update: pull` 会 fetch `origin`，并在干净工作区落后上游时快进；落后且工作区脏则加载失败。`check` 在落后时失败且不合并。没有 `.git` 的目录保持不动，以便夹具树仍能加载。

设置完成后，把 `OPENMONTAGE_ROOT` 导出为检出的绝对路径，或在 profile 补丁中重写 `config.root`。已配置的生成密钥会在加载时写入该检出的 `.env`。Token Plan 没有音乐生成模型。其他厂商密钥仍留在检出 `.env`，本插件不代理。

## 插件

`inject: ['skills', 'systemPrompt', 'credentials']`。Settings 是可选的：有提供方时，`apply()` 会注册 `openmontage` 分节。加载时它会注册：

- 提示词变量 `openmontage_root` → `config.root`
- 提示词段 `openmontage`（`order` 为 150）
- 内置 skill 提供方 `openmontage`，含 `openmontage` 与 `openmontage-onboarding`

制作 skill 把 agent 指向 `{root}/AGENT_GUIDE.md`、`pipeline_defs/` 和各阶段导演。入门 skill 在请求含糊时指向 `{root}/skills/meta/onboarding.md`。skill 正文会代入检出路径；它们不复制 OpenMontage 的指令文件。

pipeline 出片后，若已注册 `opencut-openmontage`，操作段会点名它。[`@deepseek-ai/dsh-opencut`](../../opencut/opencut/README.md) 持有该 skill 和编辑器检出。

## 模型体验

### OpenMontage 操作段

#### 模型看到什么

在该插件的注册作用域内，每次组装都会收到下面的操作段。插值后的检出路径就是已配置的 `root`。

##### OpenMontage 操作指引

```markdown
Video production uses the OpenMontage checkout at {{openmontage_root}}. When the user asks to make, create, produce, or generate a video, load the `openmontage` skill before any production work. When the request is vague or exploratory, load `openmontage-onboarding` first. Every video request must go through an OpenMontage pipeline: read AGENT_GUIDE.md, pick a pipeline under pipeline_defs/, then execute each stage from that checkout. Use the existing bash and filesystem tools. Run Python from that checkout's `.venv` (`Scripts/python.exe` on Windows, `bin/python` on Unix). When the checkout `.env` has a generation key, prefer the checkout tools that match that protocol: `token_plan_video`, `token_plan_image`, and `token_plan_tts` for a DashScope or Token Plan origin, and the checkout's OpenAI-family image/TTS tools when `TOKEN_PLAN_KEY_ENV` names `OPENAI_API_KEY` or an OpenAI-compatible origin. Do not require FAL_KEY, ELEVENLABS_API_KEY, or other vendor keys first. Token Plan has no music-generation model; keep Pixabay or the local music library for beds. Do not write ad-hoc generation scripts or call provider APIs outside the pipeline tools. After a pipeline render, if the `opencut-openmontage` skill is registered, load it to continue timeline editing in OpenCut.
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

- **OpenMontage 是单独的检出** — 本包不安装 Python、FFmpeg、Remotion 或 OpenMontage API 密钥，也不把该仓库入库。
- **没有一等 OpenMontage 工具** — 模型使用现有的 bash 与文件系统工具；没有 `openmontage` 工具，也不把 Python registry 包成 MCP。
- **不在随附 profile 中** — `dsh-base`、`web` 和 `headless` 不挂载这一行；profile 必须添加该组合包或插入该插件。
- **OpenCut 交接是兄弟适配器** — `opencut-openmontage` 由 `@deepseek-ai/dsh-opencut` 注册；本包只点名该 skill。
