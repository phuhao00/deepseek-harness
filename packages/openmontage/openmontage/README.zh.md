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
| `root` | 无（必填） | OpenMontage 检出的绝对路径。必须包含 `AGENT_GUIDE.md` 和 `pipeline_defs/`。 |

随包组合补丁读取 `OPENMONTAGE_ROOT`：

```yaml
- insert:
    - id: openmontage
      name: '@deepseek-ai/dsh-openmontage'
      config:
        root: !!js process.env.OPENMONTAGE_ROOT
```

缺少该环境变量，或 profile 补丁省略 `root`，会在加载时让 Config 校验失败。相对路径、缺失目录、或不是 OpenMontage 检出的目录，会让 `apply()` 抛出带 `openmontage:` 前缀的错误。插件不会跳过错误的 `root`。

设置完成后，把 `OPENMONTAGE_ROOT` 导出为检出的绝对路径，或在 profile 补丁中重写 `config.root`。OpenMontage 的 API 密钥留在该检出的 `.env` 里；本插件不代理它们。

## 插件

`inject: ['skills', 'systemPrompt']`。加载时它会注册：

- 提示词变量 `openmontage_root` → `config.root`
- 提示词段 `openmontage`（`order` 为 150）
- 内置 skill 提供方 `openmontage`，含 `openmontage` 与 `openmontage-onboarding`

制作 skill 把 agent 指向 `{root}/AGENT_GUIDE.md`、`pipeline_defs/` 和各阶段导演。入门 skill 在请求含糊时指向 `{root}/skills/meta/onboarding.md`。skill 正文会代入检出路径；它们不复制 OpenMontage 的指令文件。

## 模型体验

### OpenMontage 操作段

#### 模型看到什么

在该插件的注册作用域内，每次组装都会收到下面的操作段。插值后的检出路径就是已配置的 `root`。

##### OpenMontage 操作指引

```markdown
Video production uses the OpenMontage checkout at {{openmontage_root}}. When the user asks to make, create, produce, or generate a video, load the `openmontage` skill before any production work. When the request is vague or exploratory, load `openmontage-onboarding` first. Every video request must go through an OpenMontage pipeline: read AGENT_GUIDE.md, pick a pipeline under pipeline_defs/, then execute each stage from that checkout. Use the existing bash and filesystem tools. Run Python from that checkout's `.venv` (`Scripts/python.exe` on Windows, `bin/python` on Unix). Do not write ad-hoc generation scripts or call provider APIs outside the pipeline tools.
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
