import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import * as OpenMontage from '@deepseek-ai/dsh-openmontage'

const resourcePath = fileURLToPath(new URL('../assets/', import.meta.url))
const temps: string[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(temps.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

beforeEach(() => {
  vi.stubEnv('OPENMONTAGE_GENERATION_API_KEY', '')
  vi.stubEnv('QWEN_TOKEN_PLAN_CN_API_KEY', '')
  vi.stubEnv('QWEN_TOKEN_PLAN_API_KEY', '')
  vi.stubEnv('DASHSCOPE_API_KEY', '')
  vi.stubEnv('TOKEN_PLAN_BASE_URL', '')
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

/** In-memory settings document so a live section write can rewrite checkout `.env`. */
class MemorySettings extends SettingsProvider {
  doc: Record<string, unknown> = {}

  get writable(): boolean {
    return true
  }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc = { ...this.doc, [ns]: structuredClone(section) }
    return Promise.resolve()
  }
}

async function waitForEnv(root: string, needle: string): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < 2_000) {
    try {
      const env = await readFile(join(root, '.env'), 'utf8')
      if (env.includes(needle)) return env
    } catch {
      // The async settings onChange has not rewritten `.env` yet.
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error(`checkout .env never contained ${needle}`)
}

function EnvCredentials(ctx: Context, store?: Map<string, string>): void {
  ctx.provide('credentials', {
    resolve: async (ref: string) => {
      const value = store?.get(ref)?.trim() || process.env[ref]?.trim() || ''
      return value === '' ? undefined : { value, source: store === undefined ? 'env' : 'memory' }
    },
  })
}

async function withServices(store?: Map<string, string>): Promise<Context> {
  const ctx = new Context()
  EnvCredentials(ctx, store)
  await ctx.plugin(SkillRegistry)
  await ctx.plugin(SystemPrompt)
  return ctx
}

async function mount(root: string): Promise<{ ctx: Context; fiber: Awaited<ReturnType<Context['plugin']>> }> {
  const ctx = await withServices()
  const fiber = await ctx.plugin(OpenMontage, { root })
  return { ctx, fiber }
}

describe('@deepseek-ai/dsh-openmontage', () => {
  it('rejects a missing root and unset OPENMONTAGE_ROOT at load', async () => {
    vi.stubEnv('OPENMONTAGE_ROOT', '')
    const ctx = await withServices()
    await expect(ctx.plugin(OpenMontage, {})).rejects.toThrow(
      'openmontage: set config.root or OPENMONTAGE_ROOT to an absolute OpenMontage checkout',
    )
  })

  it('resolves OPENMONTAGE_ROOT at load when config.root is omitted', async () => {
    const root = await fixtureCheckout()
    vi.stubEnv('OPENMONTAGE_ROOT', root)
    const ctx = await withServices()
    await ctx.plugin(OpenMontage, {})
    expect((await ctx.systemPrompt.assemble()).variables).toMatchObject({ openmontage_root: root })
  })

  it('rejects a relative root', async () => {
    const ctx = await withServices()
    await expect(ctx.plugin(OpenMontage, { root: 'OpenMontage' }))
      .rejects.toThrow('openmontage: config.root must be an absolute path, got "OpenMontage"')
    expect(await ctx.skills.list()).toEqual([])
  })

  it('rejects a missing directory', async () => {
    const ctx = await withServices()
    const missing = join(tmpdir(), 'dsh-openmontage-missing', 'no-such-checkout')
    await expect(ctx.plugin(OpenMontage, { root: missing }))
      .rejects.toThrow(`openmontage: config.root is not an existing directory: ${missing}`)
  })

  it('rejects a directory without AGENT_GUIDE.md', async () => {
    const ctx = await withServices()
    const root = await fixtureCheckout({ guide: false })
    await expect(ctx.plugin(OpenMontage, { root }))
      .rejects.toThrow(`openmontage: ${root} is not an OpenMontage checkout (missing AGENT_GUIDE.md)`)
  })

  it('rejects a directory without pipeline_defs/', async () => {
    const ctx = await withServices()
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
    expect(production?.content).toContain('token_plan_video')
    expect(production?.content).toContain('token_plan_tts')
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
    const ctx = await withServices()
    await ctx.plugin(OpenMontage, { root: clone, update: 'pull' })
    expect((await readFile(join(clone, 'behind.txt'), 'utf8')).replaceAll('\r\n', '\n')).toBe(marker)
  })

  it('fails load when update is check and the checkout is behind', async () => {
    const { clone } = await gitPair()
    const ctx = await withServices()
    await expect(ctx.plugin(OpenMontage, { root: clone, update: 'check' }))
      .rejects.toThrow(/is 1 commit\(s\) behind/)
  })

  it('copies a Token Plan key into the checkout .env on load', async () => {
    const root = await fixtureCheckout()
    vi.stubEnv('QWEN_TOKEN_PLAN_CN_API_KEY', 'sk-sp-test-key')
    await mount(root)
    const env = await readFile(join(root, '.env'), 'utf8')
    expect(env).toContain('DASHSCOPE_API_KEY=sk-sp-test-key')
    expect(env).toContain('TOKEN_PLAN_BASE_URL=https://token-plan.cn-beijing.maas.aliyuncs.com')
    expect(env).toContain('TOKEN_PLAN_VIDEO_MODEL=happyhorse-1.1-t2v')
    expect(env).toContain('TOKEN_PLAN_IMAGE_MODEL=wan2.7-image')
    expect(env).toContain('TOKEN_PLAN_TTS_MODEL=qwen-audio-3.0-tts-plus')
    expect(env).toContain('TOKEN_PLAN_TTS_VOICE=longanhuan_v3.6')
  })

  it('rewrites checkout Token Plan models when the openmontage settings section changes', async () => {
    const root = await fixtureCheckout()
    vi.stubEnv('QWEN_TOKEN_PLAN_CN_API_KEY', 'sk-sp-test-key')
    const ctx = await withServices()
    const settingsFiber = ctx.plugin(MemorySettings)
    await settingsFiber.await()
    await ctx.plugin(OpenMontage, { root })
    await settingsFiber.ctx.settings.replace(OpenMontage.OPENMONTAGE_SETTINGS_NAMESPACE, {
      tokenPlanVideoModel: 'happyhorse-2.0-t2v',
      tokenPlanTtsModel: 'qwen-audio-custom',
    })
    const env = await waitForEnv(root, 'TOKEN_PLAN_VIDEO_MODEL=happyhorse-2.0-t2v')
    expect(env).toContain('TOKEN_PLAN_TTS_MODEL=qwen-audio-custom')
    expect(env).toContain('TOKEN_PLAN_IMAGE_MODEL=wan2.7-image')
  })

  it('rewrites the checkout .env when a watched Token Plan credential arrives', async () => {
    const root = await fixtureCheckout()
    const store = new Map<string, string>()
    const ctx = await withServices(store)
    await ctx.plugin(OpenMontage, { root })
    await expect(readFile(join(root, '.env'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    store.set('QWEN_TOKEN_PLAN_CN_API_KEY', 'sk-sp-from-page')
    ctx.emit('credentials/updated', 'QWEN_TOKEN_PLAN_CN_API_KEY' as never)
    const env = await waitForEnv(root, 'DASHSCOPE_API_KEY=sk-sp-from-page')
    expect(env).toContain('TOKEN_PLAN_BASE_URL=https://token-plan.cn-beijing.maas.aliyuncs.com')
  })

  it('leaves the checkout .env unchanged when no Token Plan key is configured', async () => {
    const root = await fixtureCheckout()
    await mount(root)
    await expect(readFile(join(root, '.env'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('fails load when a dirty checkout is behind and update is pull', async () => {
    const { clone } = await gitPair()
    await writeFile(join(clone, 'dirty.txt'), 'local\n')
    const ctx = await withServices()
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
