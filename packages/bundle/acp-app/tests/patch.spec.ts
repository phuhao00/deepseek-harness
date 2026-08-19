/**
 * The bundle's substance is its patch file: the `dsh.bundle.patch` manifest
 * field must name the ACP startup and transport rows.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as acpApp from '../src/index.ts'

describe('dsh-acp-app bundle', () => {
  it('exports no runtime API from the package root', () => {
    expect(Object.keys(acpApp)).toEqual([])
  })

  it('declares a patch that mounts acp-startup before the ACP transport', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    const patch = readFileSync(resolve(root, manifest.dsh!.bundle!.patch!), 'utf8')
    expect(patch).toContain('- id: acp-startup')
    expect(patch).toContain("name: '@deepseek-ai/dsh-acp-app/startup'")
    expect(patch).toContain('- id: acp')
    expect(patch).toContain("name: '@deepseek-ai/dsh-acp'")
    expect(patch).toContain('inject: [acpStartup, agentDefaultModel]')
    expect(patch).toContain('- id: hmr')
    expect(patch).toContain('disabled: true')
    expect(patch).toContain("name: '@deepseek-ai/dsh-code-runtime-worker-thread'")
    expect(patch).toContain('You are a coding agent')
    expect(patch.indexOf('- id: acp-startup'))
      .toBeLessThan(patch.indexOf('\n    - id: acp\n'))
    expect(patch).not.toContain('dsh-host-webserver')
    expect(patch).not.toContain('dsh-web-app')
    expect(patch).not.toContain('dsh-client-')
  })
})
