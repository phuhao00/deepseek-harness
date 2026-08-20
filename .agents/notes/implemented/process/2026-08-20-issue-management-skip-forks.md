# Agent Note: Skip Issue Management CI on forks

Status: implemented

English | [中文](2026-08-20-issue-management-skip-forks.zh.md)

## Problem

`Issue policy` and `Issue lifecycle` workflows always run on pull requests. On a fork they call `deepseek-harness/deepseek-harness` (from [config.json](../../../.github/issue-management/config.json)) and need the Issue Management GitHub App secrets. Forks lack that org access and those secrets, so every PR fails those checks even when product CI is green.

## Decision

Both workflows run only when the repository is not a fork and equals `deepseek-harness/deepseek-harness`. Fork and unrelated-clone PRs skip the jobs. Canonical Issue Management behavior is unchanged.

## Alternatives considered

**Point policy.mjs at `GITHUB_REPOSITORY`.** Rejected because Issue references, Project status, and audit comments still belong to the canonical inventory; a fork with Issues disabled cannot satisfy that policy.

**Require App secrets and fail open when missing.** Rejected because a misconfigured canonical repo would silently skip enforcement.

**Disable the workflows on this fork only via GitHub UI.** Rejected because every clone would need the same manual step; the workflow condition travels with the tree.

## Consequences

Fork CI no longer fails Issue Management for missing org or App credentials. Maintainers on the canonical repository still get full policy and lifecycle enforcement.

## Testing

Workflow `if` conditions are reviewed against the fork PR event shape (`repository.fork` true). Policy unit tests in `.github/issue-management/policy.test.mjs` stay unchanged.
