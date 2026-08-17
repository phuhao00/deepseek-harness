# @deepseek-ai/dsh-opencut

English | [中文](README.zh.md)

Opt-in adapter that points DeepSeek Harness at a local [OpenCut](https://github.com/OpenCut-app/OpenCut) rewrite checkout. The plugin validates that checkout, contributes one system-prompt section and two gateway skills, and leaves editor work to the agent using the existing bash and filesystem tools. It does not vendor OpenCut, wrap a Playwright MCP, or join `dsh-base`.

The package is also a profile bundle (`dsh.bundle.patch`). Enable it with `dsh plugin --profile <name> add @deepseek-ai/dsh-opencut`, or insert the same row in a profile `cordis.patch.yml`. From a source checkout, `dsh plugin --profile <name> add ./packages/opencut/opencut` links the workspace package.

## Prerequisites

Clone the official rewrite on the machine that will run the agent. The adapter never installs that tree. Official MCP, headless rendering, and Editor API are listed as upcoming in that README and are not a loadable surface yet.

```sh
git clone https://github.com/OpenCut-app/OpenCut.git
cd OpenCut
proto use
```

This adapter targets the rewrite (`moon.yml` plus `apps/web/`). It rejects [opencut-classic](https://github.com/OpenCut-app/opencut-classic). OpenCut is [MIT](https://github.com/OpenCut-app/OpenCut/blob/main/LICENSE). This adapter is MIT and ships only Harness-owned prompt text and gateway skills.

## With OpenMontage

Mount both adapters when the user wants generation and timeline editing in one session. OpenMontage owns pipeline production; OpenCut owns the editor.

```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-openmontage
dsh plugin --profile <name> add @deepseek-ai/dsh-opencut
```

Export both absolute roots (`OPENMONTAGE_ROOT` and `OPENCUT_ROOT`). After a pipeline render, the model loads `opencut-openmontage` to start the rewrite editor and import that output. The OpenMontage operating section names that skill; this package owns the skill body.

## Config

| Field | Default | Meaning |
|---|---|---|
| `root` | `OPENCUT_ROOT` | Absolute path to the OpenCut rewrite checkout. Must contain `moon.yml` and `apps/web/`. Omitted `root` is resolved from the environment at load, then the tree is validated. |
| `update` | `pull` | Load-time git sync: `pull` fetches and fast-forwards a clean tree that is behind upstream; `check` fails when behind; `off` skips git. Override with `OPENCUT_UPDATE`. |

The shipped bundle patch reads `OPENCUT_ROOT`:

```yaml
- insert:
    - id: opencut
      name: '@deepseek-ai/dsh-opencut'
      config:
        root: !!js process.env.OPENCUT_ROOT
        update: !!js process.env.OPENCUT_UPDATE ?? 'pull'
```

A missing env var and omitted `config.root` fail `apply()` at load. A relative path, a missing directory, or a directory that is not an OpenCut rewrite checkout also fails `apply()` with an `opencut:` error. The plugin does not skip a bad `root`. After the tree validates, `update: pull` fetches `origin` and fast-forwards a clean worktree that is behind upstream; a dirty tree that is behind fails load. `check` fails when behind without merging. A directory without `.git` is left unchanged so fixture trees still load.

After setup, export `OPENCUT_ROOT` to the absolute checkout path, or restate `config.root` in the profile patch.

## Plugin

`inject: ['skills', 'systemPrompt']`. On load it registers:

- prompt variable `opencut_root` → `config.root`
- prompt section `opencut` (`order` 160)
- bundled skill provider `opencut` with `opencut` and `opencut-openmontage`

The editor skill points the agent at `{root}/README.md` and the `moon run web:dev` / `moon run api:dev` commands. The handoff skill substitutes `opencut_root` and, when `@deepseek-ai/dsh-openmontage` is mounted, the live `openmontage_root` value. Skill bodies do not copy OpenCut sources.

## Model Experience

### OpenCut operating section

#### What the model sees

Every assembly in this plugin's registration scope receives the operating section below. The interpolated checkout path is the configured `root`.

##### OpenCut operating guidance

```markdown
Timeline editing uses the OpenCut checkout at {{opencut_root}}. When the user asks to edit, trim, caption, arrange, or polish a video on a timeline, load the `opencut` skill. After OpenMontage has produced a render and the next step is the editor, load `opencut-openmontage`. Start the rewrite editor from that checkout with `proto use`, then `moon run web:dev` (http://localhost:5173) and `moon run api:dev` (http://localhost:8787). Official Editor API, MCP, and headless rendering are not available in this checkout yet. Use the existing bash and filesystem tools. Do not wrap third-party Playwright MCP servers or treat this tree as opencut-classic.
```

#### Token effect

Small fixed guidance cost per request while the plugin is mounted, plus the interpolated path length.

#### KV Cache effect

Prefix-stable while the plugin stays mounted and `root` is unchanged. Changing `root`, or mounting or disposing the plugin, may invalidate reuse from this section.

### Gateway skills

#### What the model sees

`@deepseek-ai/dsh-tool-skill` renders the two catalog entries and a selected skill body with checkout paths already substituted.

#### Token effect

Catalog descriptions are a small fixed cost when the skill tool is visible. A loaded body is retained tool history for later steps.

#### KV Cache effect

The catalog is prefix-stable while both skills remain registered. Loading a skill appends its body; later body-only edits of the packaged templates do not rewrite earlier results.

## Known Limitations and Deferred Work

- **OpenCut is a separate checkout** — this package does not install proto, moon, Rust, or the rewrite toolchain, and it does not vendor that repository.
- **No first-party OpenCut tools** — official MCP, headless export, and Editor API are not in the checkout yet; the model uses the existing bash and filesystem tools.
- **Rewrite only** — `opencut-classic` and hosted opencut.app are out of scope.
- **Not in shipped profiles** — `dsh-base`, `web`, and `headless` do not mount this row; a profile must add the bundle or insert the plugin.
