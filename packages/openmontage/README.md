# openmontage/ — OpenMontage adapter

English | [中文](README.zh.md)

Opt-in thin adapter that points a running harness at a local [OpenMontage](https://github.com/calesthio/OpenMontage) checkout. The adapter contributes a system-prompt section and two gateway skills; the agent reads that checkout and runs its Python tools through the existing bash and filesystem tools. OpenMontage itself is not vendored.

| Package | Role | ctx key |
|---|---|---|
| [`openmontage/`](openmontage/README.md) | Validates the checkout, contributes the operating prompt and gateway skills | registers on `ctx.skills` and `ctx.systemPrompt` |

The package is a profile bundle. It is not part of `dsh-base`. Enable it with `dsh plugin add` or a profile patch. The [package README](openmontage/README.md) owns configuration and the license boundary.
