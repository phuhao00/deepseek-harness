# OpenMontage → OpenCut handoff

OpenMontage checkout: `{{openmontage_root}}`
OpenCut checkout: `{{opencut_root}}`

## When this skill applies

Use this skill after OpenMontage has produced a render (or a reviewed checkpoint the user wants on a timeline) and the next step is editing in OpenCut. If production is not finished, load `openmontage` first. If there is no OpenMontage work and the user only wants the editor, load `opencut`.

## Handoff

1. Confirm the OpenMontage pipeline finished. The render path comes from that checkout's pipeline, not from an ad-hoc script.
2. If `{{openmontage_root}}` is the literal `OPENMONTAGE_ROOT (plugin not mounted)`, stop and tell the user to add `@deepseek-ai/dsh-openmontage` with `OPENMONTAGE_ROOT` set. Do not invent a production tree.
3. Copy or leave the render and its companion assets at a stable path the editor can import. Do not re-encode unless the pipeline already required it.
4. From `{{opencut_root}}`, start the rewrite editor if it is not already running: `proto use`, then `moon run web:dev` (http://localhost:5173) and `moon run api:dev` (http://localhost:8787).
5. Import the OpenMontage output into the OpenCut timeline and continue with trim, captions, arrangement, or export from the editor UI.

## Do not

- Re-run generation APIs from OpenCut
- Bypass the OpenMontage pipeline to "just edit" footage that still needs production stages
- Use `opencut-classic`, a hosted opencut.app session, or a third-party Playwright MCP as this adapter
