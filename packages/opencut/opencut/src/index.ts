/**
 * Opt-in OpenCut adapter: validates a local rewrite checkout, then contributes
 * an operating prompt section and two gateway skills. Timeline work uses the
 * existing bash and filesystem tools against that checkout. Official Editor
 * API, MCP, and headless rendering are not vendored and are not wrapped.
 *
 * @module @deepseek-ai/dsh-opencut
 */

import { statSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import {
  BUNDLED_SKILL_RANK,
  type SkillCandidate,
  type SkillDefinition,
  type SkillProvider,
} from '@deepseek-ai/dsh-skill'
// Declaration merge only: makes ctx.systemPrompt visible for the section registration.
import type {} from '@deepseek-ai/dsh-system-prompt'
import { syncGitCheckout, type CheckoutUpdateMode } from './checkout-sync.ts'

export type { CheckoutUpdateMode }

const PROVIDER_NAME = 'opencut'
const RESOURCE_BASE = {
  kind: 'directory',
  path: fileURLToPath(new URL('../assets/', import.meta.url)),
} as const
const INVOCATION = { modelInvocable: true, userInvocable: true } as const
const OPENCUT_PLACEHOLDER = '{{opencut_root}}'
const OPENMONTAGE_PLACEHOLDER = '{{openmontage_root}}'
const OPENMONTAGE_UNMOUNTED = 'OPENMONTAGE_ROOT (plugin not mounted)'

/** Model-visible OpenCut operating section. Interpolates `{{opencut_root}}`. */
export const OPENCUT_SECTION_TEXT = 'Timeline editing uses the OpenCut checkout at {{opencut_root}}. When the user asks to edit, trim, caption, arrange, or polish a video on a timeline, load the `opencut` skill. After OpenMontage has produced a render and the next step is the editor, load `opencut-openmontage`. Start the rewrite editor from that checkout with `proto use`, then `moon run web:dev` (http://localhost:5173) and `moon run api:dev` (http://localhost:8787). Official Editor API, MCP, and headless rendering are not available in this checkout yet. Use the existing bash and filesystem tools. Do not wrap third-party Playwright MCP servers or treat this tree as opencut-classic.'

const EDITOR_DESCRIPTION = 'Open the local OpenCut rewrite editor for timeline work. Use when the user asks to edit, trim, caption, arrange, or polish a video that already exists.'
const HANDOFF_DESCRIPTION = 'Hand an OpenMontage pipeline render to the local OpenCut editor. Use after production has a render or reviewed checkpoint and the user wants timeline editing next.'

const SKILLS = [
  {
    name: 'opencut',
    description: EDITOR_DESCRIPTION,
    locator: new URL('../assets/opencut.md', import.meta.url),
  },
  {
    name: 'opencut-openmontage',
    description: HANDOFF_DESCRIPTION,
    locator: new URL('../assets/opencut-openmontage.md', import.meta.url),
  },
] as const

/** Environment variable read at load when `config.root` is omitted. */
export const OPENCUT_ROOT_ENV = 'OPENCUT_ROOT'

/** Absolute path to a local OpenCut rewrite checkout. */
export interface Config {
  /**
   * Absolute filesystem path of the OpenCut checkout.
   * When omitted, `apply()` reads `OPENCUT_ROOT` and then validates the tree.
   */
  root?: string
  /**
   * Load-time git sync. `pull` fetches and fast-forwards a clean tree that is
   * behind upstream; `check` fails when behind; `off` skips git.
   */
  update?: CheckoutUpdateMode
}

/** Config schema: `root` is optional; `apply()` resolves it from the environment. */
export const Config: z<Config> = z.object({
  root: z.string(),
  update: z.union(['off', 'check', 'pull'] as const).default('pull'),
})

/**
 * Resolve the OpenCut checkout path from plugin config or `OPENCUT_ROOT`.
 * @param config - plugin config, possibly with `root` omitted.
 * @returns the first non-empty absolute-candidate string; callers still validate it.
 * @throws when neither `config.root` nor `OPENCUT_ROOT` is set.
 */
export function resolveOpenCutRoot(config: Config): string {
  const configured = typeof config.root === 'string' ? config.root.trim() : ''
  if (configured !== '') return configured
  const fromEnv = process.env[OPENCUT_ROOT_ENV]?.trim() ?? ''
  if (fromEnv !== '') return fromEnv
  throw new Error(
    `opencut: set config.root or ${OPENCUT_ROOT_ENV} to an absolute OpenCut rewrite checkout`,
  )
}

/** Cordis plugin name. */
export const name = 'opencut'
/** Services required before the adapter can register. */
export const inject = ['skills', 'systemPrompt']

/**
 * Return the stat for an existing path, or `undefined` when the path is missing
 * or unreadable.
 * @param path - filesystem path to probe.
 * @returns the stat when the path exists, otherwise `undefined`.
 */
function existingStat(path: string): ReturnType<typeof statSync> | undefined {
  try {
    return statSync(path)
  } catch {
    // Missing and unreadable paths are the same load failure: not a checkout.
    return undefined
  }
}

/**
 * Reject a `root` that is not an absolute OpenCut rewrite checkout.
 * @param root - candidate checkout path from Config.
 * @throws when the path is relative, missing, or lacks `moon.yml` / `apps/web/`.
 */
function assertOpenCutRoot(root: string): void {
  if (typeof root !== 'string' || !isAbsolute(root)) {
    throw new Error(`opencut: config.root must be an absolute path, got ${JSON.stringify(root)}`)
  }
  const rootStat = existingStat(root)
  if (rootStat === undefined || !rootStat.isDirectory()) {
    throw new Error(`opencut: config.root is not an existing directory: ${root}`)
  }
  const moon = join(root, 'moon.yml')
  const moonStat = existingStat(moon)
  if (moonStat === undefined || !moonStat.isFile()) {
    throw new Error(`opencut: ${root} is not an OpenCut rewrite checkout (missing moon.yml)`)
  }
  const web = join(root, 'apps', 'web')
  const webStat = existingStat(web)
  if (webStat === undefined || !webStat.isDirectory()) {
    throw new Error(`opencut: ${root} is not an OpenCut rewrite checkout (missing apps/web/)`)
  }
}

/**
 * Build the bundled gateway-skill provider for one validated checkout.
 * @param ctx - Cordis context used to resolve `openmontage_root` when mounted.
 * @param root - absolute OpenCut checkout path substituted into skill bodies.
 * @returns a skill provider that lists and loads the two gateway skills.
 */
function createProvider(ctx: Context, root: string): SkillProvider {
  const candidates: SkillCandidate[] = SKILLS.map(skill => ({
    name: skill.name,
    description: skill.description,
    invocation: INVOCATION,
    provider: PROVIDER_NAME,
    source: 'bundled',
    resourceBase: RESOURCE_BASE,
    rank: BUNDLED_SKILL_RANK,
    locator: skill.locator,
  }))
  return {
    name: PROVIDER_NAME,
    list: () => Promise.resolve(candidates),
    async get(candidate): Promise<SkillDefinition> {
      const locator = candidate.locator
      if (!(locator instanceof URL)) {
        throw new Error(`opencut: unexpected skill locator for ${candidate.name}`)
      }
      const template = await readFile(locator, 'utf8')
      let content = template.replaceAll(OPENCUT_PLACEHOLDER, root)
      if (content.includes(OPENMONTAGE_PLACEHOLDER)) {
        const montageRoot = (await ctx.systemPrompt.assemble()).variables.openmontage_root
        content = content.replaceAll(OPENMONTAGE_PLACEHOLDER, montageRoot ?? OPENMONTAGE_UNMOUNTED)
      }
      return {
        name: candidate.name,
        description: candidate.description,
        invocation: candidate.invocation,
        provider: candidate.provider,
        source: candidate.source,
        resourceBase: RESOURCE_BASE,
        content,
      }
    },
  }
}

/**
 * Validate the OpenCut checkout and register the operating prompt plus gateway skills.
 * @param ctx - Cordis context with `skills` and `systemPrompt`.
 * @param config - resolved plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  const root = resolveOpenCutRoot(config)
  assertOpenCutRoot(root)
  syncGitCheckout(root, 'opencut', config.update ?? 'pull')
  ctx.systemPrompt.variable('opencut_root', () => root)
  ctx.systemPrompt.section({
    name: 'opencut',
    order: 160,
    text: OPENCUT_SECTION_TEXT,
  })
  ctx.skills.registerProvider(() => createProvider(ctx, root))
}
