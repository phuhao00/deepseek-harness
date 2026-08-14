---
type: 工程工作流
title: 工作区构建、测试与质量门禁
description: 说明 pnpm 工作区、Host/Client TypeScript aggregate、构建顺序和选择最小验证集的方法。
tags: [engineering, build, testing, typescript, ci]
---

# 工作区构建、测试与质量门禁

根 `package.json` 固定 Node `^22.19.0 || >=24.0.0` 和 `pnpm@11.7.0`。工作区包含 `packages/*/*`、`apps/*`、vendor、native Landlock、website；`examples` 仅用于依赖解析，不是 tsdown build target。详情和制品闭包见[发布制品与生成契约](release-artifacts-and-generated-contracts.md)。

## 两个编译面

`tsconfig.host.json` 是 Host aggregate，包含 Host 包、脚本、tests、website；`tsconfig.client.json` 是 Client aggregate，包含 client packages 与 `apps/web`。二者不能合并，因为相同 Cordis `Context` key 的 declaration merge 可冲突。根 `tsconfig.json` 是 solution，不应用作生成 TypeScript program 的种子；`tsconfig.base.json` 只提供 paths，永不添加 include/files。

构建顺序：

```sh
tsc -b tsconfig.host.json
tsdown --env.DSH_BUILD_FACE host
tsc -b tsconfig.client.json
tsdown --env.DSH_BUILD_FACE client
pnpm run build:web
```

Host tsdown 执行 Typert generation；Client tsdown 不执行。`api/remotes` 是唯一拆为 Host/Client leaf tsconfig 的包。

## 验证选择

| 改动 | 最小检查 | 条件性扩大检查 |
|---|---|---|
| 类型/公开 API | `pnpm run typecheck` | built consumer 时 `pnpm run build` + `publint` |
| 单包行为 | `pnpm vitest run <相关目录>` | 跨包/浏览器时相关 integration tests |
| Web bundle | `pnpm --filter @deepseek-ai/dsh-web-frontend run build` | `pnpm run test:web:built` |
| 文档/目录 | `pnpm run doc-sync` | `pnpm run docs:check` |
| 全面本地预检 | 不作为默认 | `pnpm run check:all` |

Vitest 配置还区分普通、e2e、snapshot、web/perf/stress。真实 provider e2e 依赖外部凭据，未设置时自动跳过；不得把秘密加入测试输出。CI 当前 lane 以 `.github/workflows/ci.yml`、`scripts/run-gates.ts` 为准。

改 package public surface 时应同时更新 README/JSDoc、生成 catalog，并保持 Host/Client ownership。