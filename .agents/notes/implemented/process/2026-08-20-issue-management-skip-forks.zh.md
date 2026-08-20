# Agent Note: 在 fork 上跳过 Issue Management CI

Status: implemented

[English](2026-08-20-issue-management-skip-forks.md) | 中文

## 问题

`Issue policy` 与 `Issue lifecycle` 工作流会在每个 pull request 上运行。在 fork 上它们会按 [config.json](../../../.github/issue-management/config.json) 调用 `deepseek-harness/deepseek-harness`，并需要 Issue Management GitHub App 密钥。fork 没有该 org 访问权限和这些密钥，因此即便产品 CI 已绿，每个 PR 仍会在这些检查上失败。

## 决策

两个工作流仅在仓库不是 fork、且等于 `deepseek-harness/deepseek-harness` 时运行。fork 与无关 clone 上的 PR 会跳过这些 job。规范仓库上的 Issue Management 行为不变。

## 考虑过的替代方案

**让 policy.mjs 使用 `GITHUB_REPOSITORY`。** 否决，因为 Issue 引用、Project 状态与审计评论仍属于规范清单；关闭 Issues 的 fork 无法满足该策略。

**要求 App 密钥，缺失时 fail open。** 否决，因为规范仓库配置错误时会静默跳过强制执行。

**仅在本 fork 的 GitHub UI 里禁用工作流。** 否决，因为每个 clone 都要手工操作；工作流条件应随代码树传播。

## 后果

fork CI 不再因缺少 org 或 App 凭据而在 Issue Management 上失败。规范仓库上的维护者仍获得完整策略与生命周期强制执行。

## 测试

对照 fork PR 事件形状（`repository.fork` 为 true）审阅工作流 `if` 条件。`.github/issue-management/policy.test.mjs` 中的策略单元测试保持不变。
