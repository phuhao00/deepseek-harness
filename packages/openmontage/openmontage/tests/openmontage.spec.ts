import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import * as OpenMontage from '@deepseek-ai/dsh-openmontage'

const resourcePath = fileURLToPath(new URL('../assets/', import.meta.url))
const temps: string[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(temps.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

async function fixtureCheckout(options?: {
  guide?: boolean
  pipelines?: boolean
}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-openmontage-'))
  temps.push(dir)
  if (options?.guide !== false) await writeFile(join(dir, 'AGENT_GUIDE.md'), 'fixture guide\n')
  if (options?.pipelines !== false) await mkdir(join(dir, 'pipeline_defs'))
  return dir
}

async function mount(root: string): Promise<{ ctx: Context; fiber: Awaited<ReturnType<Context['plugin']>> }> {
  const ctx = new Context()
  await ctx.plugin(SkillRegistry)
  await ctx.plugin(SystemPrompt)
  const fiber = await ctx.plugin(OpenMontage, { root })
  return { ctx, fiber }
}

describe('@deepseek-ai/dsh-openmontage', () => {
  it('rejects a missing root and unset OPENMONTAGE_ROOT at load', async () => {
    vi.stubEnv('OPENMONTAGE_ROOT', '')
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await expect(ctx.plugin(OpenMontage, {})).rejects.toThrow(
      'openmontage: set config.root or OPENMONTAGE_ROOT to an absolute OpenMontage checkout',
    )
  })

  it('resolves OPENMONTAGE_ROOT at load when config.root is omitted', async () => {
    const root = await fixtureCheckout()
    vi.stubEnv('OPENMONTAGE_ROOT', root)
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(OpenMontage, {})
    expect((await ctx.systemPrompt.assemble()).variables).toMatchObject({ openmontage_root: root })
  })

  it('rejects a relative root', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await expect(ctx.plugin(OpenMontage, { root: 'OpenMontage' }))
      .rejects.toThrow('openmontage: config.root must be an absolute path, got "OpenMontage"')
    expect(await ctx.skills.list()).toEqual([])
  })

  it('rejects a missing directory', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    const missing = join(tmpdir(), 'dsh-openmontage-missing', 'no-such-checkout')
    await expect(ctx.plugin(OpenMontage, { root: missing }))
      .rejects.toThrow(`openmontage: config.root is not an existing directory: ${missing}`)
  })

  it('rejects a directory without AGENT_GUIDE.md', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    const root = await fixtureCheckout({ guide: false })
    await expect(ctx.plugin(OpenMontage, { root }))
      .rejects.toThrow(`openmontage: ${root} is not an OpenMontage checkout (missing AGENT_GUIDE.md)`)
  })

  it('rejects a directory without pipeline_defs/', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    const root = await fixtureCheckout({ pipelines: false })
    await expect(ctx.plugin(OpenMontage, { root }))
      .rejects.toThrow(`openmontage: ${root} is not an OpenMontage checkout (missing pipeline_defs/)`)
  })

  it('registers interpolated prompt section and gateway skills, then disposes them', async () => {
    const root = await fixtureCheckout()
    const { ctx, fiber } = await mount(root)

    const assembly = await ctx.systemPrompt.assemble()
    expect(assembly.variables).toMatchObject({ openmontage_root: root })
    expect(assembly.sections.map(section => section.name)).toContain('openmontage')
    expect(renderPrompt(assembly)).toContain(
      OpenMontage.OPENMONTAGE_SECTION_TEXT.replaceAll('{{openmontage_root}}', root),
    )

    const listed = await ctx.skills.list()
    expect(listed.map(skill => skill.name).sort()).toEqual(['openmontage', 'openmontage-onboarding'])
    expect(listed).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'openmontage',
        provider: 'openmontage',
        source: 'bundled',
        resourceBase: { kind: 'directory', path: resourcePath },
      }),
      expect.objectContaining({
        name: 'openmontage-onboarding',
        provider: 'openmontage',
        source: 'bundled',
        resourceBase: { kind: 'directory', path: resourcePath },
      }),
    ]))

    const production = await ctx.skills.get('openmontage')
    expect(production?.content).toContain(`The OpenMontage checkout is at \`${root}\`.`)
    expect(production?.content).toContain('opencut-openmontage')
    expect(production?.content).not.toContain('{{openmontage_root}}')
    const onboarding = await ctx.skills.get('openmontage-onboarding')
    expect(onboarding?.content).toContain(`${root}/skills/meta/onboarding.md`)

    await fiber.dispose()
    expect(await ctx.skills.list()).toEqual([])
    const after = await ctx.systemPrompt.assemble()
    expect(after.sections.map(section => section.name)).not.toContain('openmontage')
    expect(after.variables).not.toHaveProperty('openmontage_root')
  })

  it('fast-forwards a clean checkout that is behind origin', async () => {
    const { clone, marker } = await gitPair()
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(OpenMontage, { root: clone, update: 'pull' })
    expect((await readFile(join(clone, 'behind.txt'), 'utf8')).replaceAll('\r\n', '\n')).toBe(marker)
  })

  it('fails load when update is check and the checkout is behind', async () => {
    const { clone } = await gitPair()
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await expect(ctx.plugin(OpenMontage, { root: clone, update: 'check' }))
      .rejects.toThrow(/is 1 commit\(s\) behind/)
  })

  it('fails load when a dirty checkout is behind and update is pull', async () => {
    const { clone } = await gitPair()
    await writeFile(join(clone, 'dirty.txt'), 'local\n')
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await expect(ctx.plugin(OpenMontage, { root: clone, update: 'pull' }))
      .rejects.toThrow(/worktree is dirty/)
  })
})

function git(root: string, args: string[]): void {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
}

async function gitPair(): Promise<{ clone: string; marker: string }> {
  const remote = await mkdtemp(join(tmpdir(), 'dsh-om-remote-'))
  const clone = await mkdtemp(join(tmpdir(), 'dsh-om-clone-'))
  temps.push(remote, clone)
  git(remote, ['init', '-b', 'main'])
  git(remote, ['config', 'user.email', 'adapter@test'])
  git(remote, ['config', 'user.name', 'adapter'])
  await writeFile(join(remote, 'AGENT_GUIDE.md'), 'guide\n')
  await mkdir(join(remote, 'pipeline_defs'))
  await writeFile(join(remote, 'pipeline_defs', '.gitkeep'), '')
  git(remote, ['add', '.'])
  git(remote, ['commit', '-m', 'base'])
  git(clone, ['clone', remote, '.'])
  const marker = 'updated\n'
  await writeFile(join(remote, 'behind.txt'), marker)
  git(remote, ['add', 'behind.txt'])
  git(remote, ['commit', '-m', 'ahead'])
  return { clone, marker }
}
