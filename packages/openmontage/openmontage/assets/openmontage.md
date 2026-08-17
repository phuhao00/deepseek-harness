# OpenMontage production

The OpenMontage checkout is at `{{openmontage_root}}`.

## When this skill applies

Use this skill when the user gives a specific, actionable video request (duration, topic, format, or footage).

## Required first reads

1. Read `{{openmontage_root}}/AGENT_GUIDE.md`. That file is the operating contract, including the rule that every production goes through a pipeline.
2. List `{{openmontage_root}}/pipeline_defs/` and read the matching pipeline YAML.
3. For each stage, read the stage director under `{{openmontage_root}}/skills/pipelines/` before doing that stage's work.

## How to run tools

Do not invent Python wrappers. Discover and call tools from the checkout, with cwd set to `{{openmontage_root}}` so imports resolve.

- Windows: `{{openmontage_root}}\.venv\Scripts\python.exe`
- Unix: `{{openmontage_root}}/.venv/bin/python`

Ask the checkout's tool registry for the support envelope and provider menu before calling a paid or consequential tool.

When the checkout `.env` has a generation key (the adapter copies the selected credential — page-owned `OPENMONTAGE_GENERATION_API_KEY`, Qwen Token Plan, DashScope, OpenAI, OpenRouter, or any other POSIX ref), prefer the checkout tools that match that protocol. Use `token_plan_video`, `token_plan_image`, and `token_plan_tts` when `TOKEN_PLAN_BASE_URL` is a DashScope or Token Plan origin. Use the checkout's OpenAI-family image/TTS tools when `TOKEN_PLAN_KEY_ENV` names `OPENAI_API_KEY` or an OpenAI-compatible origin. Do not ask the user for FAL_KEY, RUNWAY_API_KEY, HEYGEN_API_KEY, or ELEVENLABS_API_KEY first. Route generation through `video_selector` / `image_selector` / `tts_selector` with the matching `preferred_provider`. Token Plan has no music-generation model; a music preflight that offers only Pixabay is expected — use `pixabay_music` or `music_library` for beds.

## After a render

If the `opencut-openmontage` skill is registered, load it and hand the pipeline output to the OpenCut editor. Do not start timeline editing until the pipeline's documented review steps are done.

## Do not

- Skip the pipeline and call generation APIs directly
- Write ad-hoc scripts that bypass registered tools
- Present a render that skipped the checkout's documented preflight, checkpoints, or review steps
