import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

/**
 * Keyless smoke for SOURCE `dsh` execution: run `apps/cli/src/bin.ts`
 * with the exact production runtime vector (`node --import tsx/esm`, the
 * vector the root `dsh` script invokes directly) and assert the
 * required-config diagnostic. The Node compatibility matrix runs this
 * WHOLE file, so a Node release changing module hooks or TypeScript handling
 * breaks this gate instead of every developer's `pnpm dsh`; the built-bin
 * suite covers the published `lib/` entry, not this source chain.
 */

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const dshSourceBin = 'apps/cli/src/bin.ts'

describe('dsh SOURCE launcher (node --import tsx/esm)', () => {
  it('launches the source CLI without building', async () => {
    const rootPackage = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8')) as {
      readonly scripts?: Record<string, string>
    }
    expect(rootPackage.scripts?.dsh).toBe('node --import tsx/esm apps/cli/src/bin.ts')
  })

  it('boots the source entry and requires a profile', async () => {
    const result = await execa(process.execPath, ['--import', 'tsx/esm', dshSourceBin], {
      cwd: repoRoot,
      input: '',
      timeout: 25_000,
      killSignal: 'SIGKILL',
      reject: false,
    })
    if (result.timedOut) {
      throw new Error(`dsh source launch did not exit within 25s. stdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
    }
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('--profile <name> is required')
    expect(result.stdout).toBe('')
  }, 30_000)

  it('dumps the source acp profile without Host or browser layers', async () => {
    const dshHome = await mkdtemp(join(tmpdir(), 'dsh-acp-source-'))
    try {
      const result = await execa(
        process.execPath,
        ['--import', 'tsx/esm', dshSourceBin, '--profile', 'acp', '--dump-default-config'],
        {
          cwd: repoRoot,
          input: '',
          env: { DSH_HOME: dshHome },
          timeout: 25_000,
          killSignal: 'SIGKILL',
          reject: false,
        },
      )
      if (result.timedOut) {
        throw new Error(
          `dsh source acp dump did not exit within 25s. stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
        )
      }
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('@deepseek-ai/dsh-acp-app')
      expect(result.stdout).toContain("name: '@deepseek-ai/dsh-acp-app/startup'")
      expect(result.stdout).toContain("name: '@deepseek-ai/dsh-acp'")
      expect(result.stdout).not.toMatch(/name: '@deepseek-ai\/dsh-host-/)
      expect(result.stdout).not.toContain("name: '@deepseek-ai/dsh-web-app'")
      expect(result.stdout).not.toMatch(/name: '@deepseek-ai\/dsh-client-/)
    } finally {
      await rm(dshHome, { recursive: true, force: true })
    }
  }, 30_000)
})
