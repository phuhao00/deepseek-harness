/**
 * Load-time git fetch/fast-forward for a local checkout the adapter does not own.
 * @module @deepseek-ai/dsh-openmontage/checkout-sync
 */

/* jscpd:ignore-start */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

/** How `apply()` treats a checkout that is behind its upstream. */
export type CheckoutUpdateMode = 'off' | 'check' | 'pull'

const FETCH_TIMEOUT_MS = 120_000

/**
 * Run one git command in `root` and return trimmed stdout.
 * @param root - checkout directory.
 * @param prefix - error prefix (`openmontage:` / `opencut:`).
 * @param args - git arguments after `git -C <root>`.
 * @returns trimmed stdout.
 */
function runGit(root: string, prefix: string, args: readonly string[]): string {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    timeout: FETCH_TIMEOUT_MS,
  })
  if (result.error !== undefined) {
    throw new Error(`${prefix}: git ${args[0]} failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim()
    throw new Error(`${prefix}: git ${args.join(' ')} failed${detail === '' ? '' : `: ${detail}`}`)
  }
  return result.stdout.trim()
}

/**
 * Resolve the remote-tracking ref used to decide whether `root` is behind.
 * @param root - checkout directory.
 * @param prefix - error prefix.
 * @returns a ref such as `origin/main`.
 */
function resolveUpstream(root: string, prefix: string): string {
  try {
    return runGit(root, prefix, ['rev-parse', '--abbrev-ref', '@{upstream}'])
  } catch {
    try {
      const head = runGit(root, prefix, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'])
      return head.replace(/^refs\/remotes\//, '')
    } catch {
      throw new Error(`${prefix}: ${root} has no upstream or origin/HEAD to check for updates`)
    }
  }
}

/**
 * Fetch origin and optionally fast-forward `root` when it is behind upstream.
 * A tree without `.git` is left unchanged so fixture checkouts still load.
 * @param root - validated checkout directory.
 * @param prefix - error prefix.
 * @param mode - `off` skips git; `check` fails when behind; `pull` fast-forwards a clean tree.
 */
export function syncGitCheckout(root: string, prefix: string, mode: CheckoutUpdateMode): void {
  if (mode === 'off') return
  if (!existsSync(join(root, '.git'))) return
  runGit(root, prefix, ['fetch', '--prune', 'origin'])
  const upstream = resolveUpstream(root, prefix)
  const behind = Number(runGit(root, prefix, ['rev-list', '--count', `HEAD..${upstream}`]))
  if (!Number.isFinite(behind) || behind <= 0) return
  if (mode === 'check') {
    throw new Error(
      `${prefix}: ${root} is ${behind} commit(s) behind ${upstream}; pull the checkout or set config.update to pull`,
    )
  }
  const dirty = runGit(root, prefix, ['status', '--porcelain'])
  if (dirty !== '') {
    throw new Error(
      `${prefix}: ${root} is ${behind} commit(s) behind ${upstream} but the worktree is dirty; commit, stash, or discard before load`,
    )
  }
  runGit(root, prefix, ['merge', '--ff-only', upstream])
}
/* jscpd:ignore-end */
