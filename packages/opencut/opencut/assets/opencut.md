# OpenCut editor

The OpenCut checkout is at `{{opencut_root}}`.

## When this skill applies

Use this skill when the user asks to edit, trim, caption, arrange, or polish a video on a timeline. For a new video that still needs generation or a pipeline render, load `openmontage` first. After an OpenMontage render is ready, load `opencut-openmontage` instead.

## Required first reads

1. Read `{{opencut_root}}/README.md`. That file is the current editor contract, including the rewrite status.
2. Confirm the checkout has `moon.yml` and `apps/web/`. This adapter targets the official [OpenCut](https://github.com/OpenCut-app/OpenCut) rewrite, not `opencut-classic`.

## How to run the editor

Do not invent an Editor API, MCP server, or headless renderer. Those are listed as upcoming in the checkout README and are not a loadable surface yet.

From `{{opencut_root}}`:

1. `proto use` (installs the tools pinned in `.prototools`)
2. `moon run web:dev` — web editor at http://localhost:5173
3. `moon run api:dev` — API at http://localhost:8787

Use the existing bash and filesystem tools. Place media the user wants to edit where the running editor can import it. Do not wrap third-party Playwright MCP servers.

## Do not

- Treat this checkout as `opencut-classic` or point at opencut.app
- Claim MCP, headless export, or a public Editor API is available
- Skip OpenMontage when the user still needs generated footage or a pipeline render
