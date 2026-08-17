# @deepseek-ai/dsh-openmontage

English | [中文](README.zh.md)

Opt-in adapter that points DeepSeek Harness at a local [OpenMontage](https://github.com/calesthio/OpenMontage) checkout. The plugin validates that checkout, contributes one system-prompt section and two gateway skills, and leaves production work to the agent using the existing bash and filesystem tools. It does not vendor OpenMontage, wrap its Python tools, or join `dsh-base`.

The package is also a profile bundle (`dsh.bundle.patch`). Enable it with `dsh plugin --profile <name> add @deepseek-ai/dsh-openmontage`, or insert the same row in a profile `cordis.patch.yml`. From a source checkout, `dsh plugin --profile <name> add ./packages/openmontage/openmontage` links the workspace package.

## Prerequisites

Clone and set up OpenMontage on the machine that will run the agent. The adapter never installs that tree.

```sh
git clone https://github.com/calesthio/OpenMontage.git
cd OpenMontage
make setup
```

Windows PowerShell without `make`: `py -3 -m venv .venv; .\.venv\Scripts\Activate.ps1; python -m pip install -r requirements.txt; cd remotion-composer; npm install; cd ..; python -m pip install piper-tts; Copy-Item .env.example .env`.

OpenMontage remains [AGPL-3.0](https://github.com/calesthio/OpenMontage/blob/main/LICENSE). This adapter is MIT and ships only Harness-owned prompt text and gateway skills.

## Config

| Field | Default | Meaning |
|---|---|---|
| `root` | `OPENMONTAGE_ROOT` | Absolute path to the OpenMontage checkout. Must contain `AGENT_GUIDE.md` and `pipeline_defs/`. Omitted `root` is resolved from the environment at load, then the tree is validated. |
| `update` | `pull` | Load-time git sync: `pull` fetches and fast-forwards a clean tree that is behind upstream; `check` fails when behind; `off` skips git. Override with `OPENMONTAGE_UPDATE`. |
| `tokenPlanKeyEnv` | first of `QWEN_TOKEN_PLAN_CN_API_KEY`, `QWEN_TOKEN_PLAN_API_KEY`, `DASHSCOPE_API_KEY` | Env ref whose value is copied into the checkout `.env` as `DASHSCOPE_API_KEY` so HappyHorse / Wan / Qwen-Audio TTS tools can run. |
| `tokenPlanBaseUrl` | inferred from the resolved ref | DashScope / Token Plan API origin. |
| `tokenPlanVideoModel` | `happyhorse-1.1-t2v` | Default Token Plan video model written to the checkout. |
| `tokenPlanImageModel` | `wan2.7-image` | Default Token Plan image model written to the checkout. |
| `tokenPlanTtsModel` | `qwen-audio-3.0-tts-plus` | Default Token Plan speech model written to the checkout. |
| `tokenPlanTtsVoice` | `longanhuan_v3.6` | Default Qwen-Audio-TTS voice id written to the checkout. |

The shipped bundle patch reads `OPENMONTAGE_ROOT`:

```yaml
- insert:
    - id: openmontage
      name: '@deepseek-ai/dsh-openmontage'
      config:
        root: !!js process.env.OPENMONTAGE_ROOT
        update: !!js process.env.OPENMONTAGE_UPDATE ?? 'pull'
```

A missing env var and omitted `config.root` fail `apply()` at load. A relative path, a missing directory, or a directory that is not an OpenMontage checkout also fails `apply()` with an `openmontage:` error. The plugin does not skip a bad `root`. After the tree validates, `update: pull` fetches `origin` and fast-forwards a clean worktree that is behind upstream; a dirty tree that is behind fails load. `check` fails when behind without merging. A directory without `.git` is left unchanged so fixture trees still load.

After setup, export `OPENMONTAGE_ROOT` to the absolute checkout path, or restate `config.root` in the profile patch. A configured Qwen Token Plan key is copied into that checkout's `.env` on load so `token_plan_video`, `token_plan_image`, and `token_plan_tts` can spend plan credits. Token Plan has no music-generation model. Other vendor keys stay in the checkout `.env` and are not proxied.

## Plugin

`inject: ['skills', 'systemPrompt', 'credentials']`. On load it registers:

- prompt variable `openmontage_root` → `config.root`
- prompt section `openmontage` (`order` 150)
- bundled skill provider `openmontage` with `openmontage` and `openmontage-onboarding`

The production skill points the agent at `{root}/AGENT_GUIDE.md`, `pipeline_defs/`, and stage directors. The onboarding skill points at `{root}/skills/meta/onboarding.md` for vague requests. Skill bodies substitute the checkout path; they do not copy OpenMontage instruction files.

After a pipeline render, the operating section names `opencut-openmontage` when that skill is registered. [`@deepseek-ai/dsh-opencut`](../../opencut/opencut/README.md) owns the skill and the editor checkout.

## Model Experience

### OpenMontage operating section

#### What the model sees

Every assembly in this plugin's registration scope receives the operating section below. The interpolated checkout path is the configured `root`.

##### OpenMontage operating guidance

```markdown
Video production uses the OpenMontage checkout at {{openmontage_root}}. When the user asks to make, create, produce, or generate a video, load the `openmontage` skill before any production work. When the request is vague or exploratory, load `openmontage-onboarding` first. Every video request must go through an OpenMontage pipeline: read AGENT_GUIDE.md, pick a pipeline under pipeline_defs/, then execute each stage from that checkout. Use the existing bash and filesystem tools. Run Python from that checkout's `.venv` (`Scripts/python.exe` on Windows, `bin/python` on Unix). Do not write ad-hoc generation scripts or call provider APIs outside the pipeline tools. After a pipeline render, if the `opencut-openmontage` skill is registered, load it to continue timeline editing in OpenCut.
```

#### Token effect

Small fixed guidance cost per request while the plugin is mounted, plus the interpolated path length.

#### KV Cache effect

Prefix-stable while the plugin stays mounted and `root` is unchanged. Changing `root`, or mounting or disposing the plugin, may invalidate reuse from this section.

### Gateway skills

#### What the model sees

`@deepseek-ai/dsh-tool-skill` renders the two catalog entries and a selected skill body with the checkout path already substituted.

#### Token effect

Catalog descriptions are a small fixed cost when the skill tool is visible. A loaded body is retained tool history for later steps.

#### KV Cache effect

The catalog is prefix-stable while both skills remain registered. Loading a skill appends its body; later body-only edits of the packaged templates do not rewrite earlier results.

## Known Limitations and Deferred Work

- **OpenMontage is a separate checkout** — this package does not install Python, FFmpeg, Remotion, or OpenMontage API keys, and it does not vendor that repository.
- **No first-party OpenMontage tools** — the model uses the existing bash and filesystem tools; there is no `openmontage` tool and no MCP wrap of the Python registry.
- **Not in shipped profiles** — `dsh-base`, `web`, and `headless` do not mount this row; a profile must add the bundle or insert the plugin.
- **OpenCut handoff is a sibling adapter** — `opencut-openmontage` is registered by `@deepseek-ai/dsh-opencut`; this package only names the skill.
