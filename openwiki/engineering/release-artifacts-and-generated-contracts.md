---
type: 发布与制品设计
title: 发布制品、生成契约与分发闭包
description: 说明 npm、native 和 Python 三类发布闭包，以及生成目录、打包验证和 release family 的变更面。
tags: [engineering, release, artifacts, codegen, npm, python]
---

# 发布制品、生成契约与分发闭包

源码工作区不等于发布产物。`pnpm-workspace.yaml` 把 examples 标记为仅依赖解析成员；`python/sdk-runtime` 是单可执行分发的依赖闭包。发布修改必须确认消费者实际拿到的 exports、二进制和生成契约。

## 生成与验证

根 scripts 负责 Cordis/client/tool/config/persistence/module graph/catalog：`gen-cordis-catalog`、`gen-cordis-api`、`gen-client-catalog`、`gen-tool-catalog`、`gen-config-catalog`、`gen-persistence-catalog`、`gen-module-graph` 及同名 `verify-*`。生成物的 source of truth 是 TypeScript types、package manifests、Cordis config 和生成脚本，不是手改产物。相关变更先运行相应 `gen-*`，再运行 `verify-*`；完整文档同步用 `pnpm run doc-sync`。

## 三种分发面

| 面 | 闭包与入口 | 发布验证 |
|---|---|---|
| npm dsh family | `apps/cli` 的 `dsh` bin 加其 profile/bundle closure；构建产物为 `lib`/Web dist | `release:dsh`、`release:verify`、`release:pack`、`release:verify-packed-install`、`release:publish` |
| Landlock native | `native/landlock-run` 独立 workspace，TS wrapper + 平台 prebuild | `release:assemble-prebuilds`、`release:verify`、`release:pack`、`release:verify-packed-install`、`release:publish` |
| Python | `python/sdk` wheel 与同版本 `python/sdk-runtime` platform wheel；hatch build 注入可执行且排除 Node closure | Python build/tests 与 runtime payload/tag 验证 |

`scripts/release/pack.ts` 的 tarball 是无凭据、单提交边界；不要将本地秘密、缓存或未声明文件带入 payload。`hygiene` 包含 package exports、NodeNext 类型、runtime closure、vendor/link 及 workspace constraints 检查。

## Vendor 与版本族

vendor Cordis 依赖通过 workspace overrides 指向 pinned source；更改 vendor 源码时同时更新其 manifest/README，遵守 vendor guard。release 使用 family（`dsh`、`vendor`）而非任意单包随意发布，以保持 workspace versions 与闭包匹配。

选择最小工程验证见[构建与测试](build-and-test.md)。