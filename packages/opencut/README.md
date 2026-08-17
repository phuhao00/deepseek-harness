# opencut/ — OpenCut adapter

English | [中文](README.zh.md)

Opt-in thin adapter that points a running harness at a local [OpenCut](https://github.com/OpenCut-app/OpenCut) rewrite checkout. The adapter contributes a system-prompt section and two gateway skills; the agent starts that editor and hands OpenMontage renders onto its timeline through the existing bash and filesystem tools. OpenCut itself is not vendored.

| Package | Role | ctx key |
|---|---|---|
| [`opencut/`](opencut/README.md) | Validates the checkout, contributes the operating prompt, editor skill, and OpenMontage handoff skill | registers on `ctx.skills` and `ctx.systemPrompt` |

The package is a profile bundle. It is not part of `dsh-base`. Enable it with `dsh plugin add` or a profile patch. The [package README](opencut/README.md) owns configuration and the joint-use contract with OpenMontage.
