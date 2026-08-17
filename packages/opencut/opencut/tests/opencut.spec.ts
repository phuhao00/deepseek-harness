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
import * as OpenCut from '@deepseek-ai/dsh-opencut'

const resourcePath = fileURLToPath(new URL('../assets/', import.meta.url))
const temps: string[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(temps.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

async function fixtureOpenCut(options?: {
  moon?: boolean
  web?: boolean
}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-opencut-'))
  temps.push(dir)
  if (options?.moon !== false) await writeFile(join(dir, 'moon.yml'), 'fixture: true\n')
  if (options?.web !== false) await mkdir(join(dir, 'apps', 'web'), { recursive: true })
  return dir
}

async function fixtureOpenMontage(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-opencut-om-'))
  temps.push(dir)
  await writeFile(join(dir, 'AGENT_GUIDE.md'), 'fixture guide\n')
  await mkdir(join(dir, 'pipeline_defs'))
  return dir
}

function EnvCredentials(ctx: Context): void {
  ctx.provide('credentials', {
    resolve: async (ref: string) => {
      const value = process.env[ref]?.trim() ?? ''
      return value === '' ? undefined : { value, source: 'env' }
    },
  })
}

async function mount(root: string): Promise<{ ctx: Context; fiber: Awaited<ReturnType<Context['plugin']>> }> {
  const ctx = new Context()
  await ctx.plugin(SkillRegistry)
  await ctx.plugin(SystemPrompt)
  const fiber = await ctx.plugin(OpenCut, { root })
  return { ctx, fiber }
}

describe('@deepseek-ai/dsh-opencut', () => {
  it('rejects a missing root and unset OPENCUT_ROOT at load', async () => {
    vi.stubEnv('OPENCUT_ROOT', '')
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await expect(ctx.plugin(OpenCut, {})).rejects.toThrow(
      'opencut: set config.root or OPENCUT_ROOT to an absolute OpenCut rewrite checkout',
    )
  })

  it('resolves OPENCUT_ROOT at load when config.root is omitted', async () => {
    const root = await fixtureOpenCut()
    vi.stubEnv('OPENCUT_ROOT', root)
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(OpenCut, {})
    expect((await ctx.systemPrompt.assemble()).variables).toMatchObject({ opencut_root: root })
  })

  it('rejects a relative root', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await expect(ctx.plugin(OpenCut, { root: 'OpenCut' }))
      .rejects.toThrow('opencut: config.root must be an absolute path, got "OpenCut"')
    expect(await ctx.skills.list()).toEqual([])
  })

  it('rejects a missing directory', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    const missing = join(tmpdir(), 'dsh-opencut-missing', 'no-such-checkout')
    await expect(ctx.plugin(OpenCut, { root: missing }))
      .rejects.toThrow(`opencut: config.root is not an existing directory: ${missing}`)
  })

  it('rejects a directory without moon.yml', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    const root = await fixtureOpenCut({ moon: false })
    await expect(ctx.plugin(OpenCut, { root }))
      .rejects.toThrow(`opencut: ${root} is not an OpenCut rewrite checkout (missing moon.yml)`)
  })

  it('rejects a directory without apps/web/', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    const root = await fixtureOpenCut({ web: false })
    await expect(ctx.plugin(OpenCut, { root }))
      .rejects.toThrow(`opencut: ${root} is not an OpenCut rewrite checkout (missing apps/web/)`)
  })

  it('registers interpolated prompt section and gateway skills, then disposes them', async () => {
    const root = await fixtureOpenCut()
    const { ctx, fiber } = await mount(root)

    const assembly = await ctx.systemPrompt.assemble()
    expect(assembly.variables).toMatchObject({ opencut_root: root })
    expect(assembly.sections.map(section => section.name)).toContain('opencut')
    expect(renderPrompt(assembly)).toContain(
      OpenCut.OPENCUT_SECTION_TEXT.replaceAll('{{opencut_root}}', root),
    )

    const listed = await ctx.skills.list()
    expect(listed.map(skill => skill.name).sort()).toEqual(['opencut', 'opencut-openmontage'])
    expect(listed).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'opencut',
        provider: 'opencut',
        source: 'bundled',
        resourceBase: { kind: 'directory', path: resourcePath },
      }),
      expect.objectContaining({
        name: 'opencut-openmontage',
        provider: 'opencut',
        source: 'bundled',
        resourceBase: { kind: 'directory', path: resourcePath },
      }),
    ]))

    const editor = await ctx.skills.get('opencut')
    expect(editor?.content).toContain(`The OpenCut checkout is at \`${root}\`.`)
    expect(editor?.content).not.toContain('{{opencut_root}}')
    const handoff = await ctx.skills.get('opencut-openmontage')
    expect(handoff?.content).toContain('OPENMONTAGE_ROOT (plugin not mounted)')
    expect(handoff?.content).toContain(`OpenCut checkout: \`${root}\``)

    await fiber.dispose()
    expect(await ctx.skills.list()).toEqual([])
    const after = await ctx.systemPrompt.assemble()
    expect(after.sections.map(section => section.name)).not.toContain('opencut')
    expect(after.variables).not.toHaveProperty('opencut_root')
  })

  it('substitutes the mounted OpenMontage root into the handoff skill', async () => {
    const cut = await fixtureOpenCut()
    const montage = await fixtureOpenMontage()
    const ctx = new Context()
    EnvCredentials(ctx)
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(OpenMontage, { root: montage })
    await ctx.plugin(OpenCut, { root: cut })

    const assembly = await ctx.systemPrompt.assemble()
    expect(assembly.variables).toMatchObject({
      opencut_root: cut,
      openmontage_root: montage,
    })
    expect(assembly.sections.map(section => section.name)).toEqual(
      expect.arrayContaining(['openmontage', 'opencut']),
    )

    const handoff = await ctx.skills.get('opencut-openmontage')
    expect(handoff?.content).toContain(`OpenMontage checkout: \`${montage}\``)
    expect(handoff?.content).toContain(`OpenCut checkout: \`${cut}\``)
    expect(handoff?.content).not.toContain('{{openmontage_root}}')
    expect(handoff?.content).not.toContain('OpenMontage checkout: `OPENMONTAGE_ROOT (plugin not mounted)`')
  })

  it('fast-forwards a clean OpenCut checkout that is behind origin', async () => {
    const { clone, marker } = await gitPair()
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(OpenCut, { root: clone, update: 'pull' })
    expect((await readFile(join(clone, 'behind.txt'), 'utf8')).replaceAll('\r\n', '\n')).toBe(marker)
  })

  it('fails load when update is check and the OpenCut checkout is behind', async () => {
    const { clone } = await gitPair()
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SystemPrompt)
    await expect(ctx.plugin(OpenCut, { root: clone, update: 'check' }))
      .rejects.toThrow(/is 1 commit\(s\) behind/)
  })
})

function git(root: string, args: string[]): void {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
}

async function gitPair(): Promise<{ clone: string; marker: string }> {
  const remote = await mkdtemp(join(tmpdir(), 'dsh-oc-remote-'))
  const clone = await mkdtemp(join(tmpdir(), 'dsh-oc-clone-'))
  temps.push(remote, clone)
  git(remote, ['init', '-b', 'main'])
  git(remote, ['config', 'user.email', 'adapter@test'])
  git(remote, ['config', 'user.name', 'adapter'])
  await writeFile(join(remote, 'moon.yml'), 'fixture: true\n')
  await mkdir(join(remote, 'apps', 'web'), { recursive: true })
  await writeFile(join(remote, 'apps', 'web', '.gitkeep'), '')
  git(remote, ['add', '.'])
  git(remote, ['commit', '-m', 'base'])
  git(clone, ['clone', remote, '.'])
  const marker = 'updated\n'
  await writeFile(join(remote, 'behind.txt'), marker)
  git(remote, ['add', 'behind.txt'])
  git(remote, ['commit', '-m', 'ahead'])
  return { clone, marker }
}
