/**
 * Opt-in OpenMontage adapter: validates a local checkout, then contributes an
 * operating prompt section and two gateway skills. The agent reads that
 * checkout and runs its Python tools through the existing bash and filesystem
 * tools. OpenMontage itself is not vendored.
 *
 * @module @deepseek-ai/dsh-openmontage
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
// Declaration merge only: makes ctx.systemPrompt and ctx.credentials visible.
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-credentials'
import { installSettingsSection } from '@deepseek-ai/dsh-settings'
import { syncGitCheckout, type CheckoutUpdateMode } from './checkout-sync.ts'
import {
  DEFAULT_TOKEN_PLAN_IMAGE_MODEL,
  DEFAULT_TOKEN_PLAN_TTS_MODEL,
  DEFAULT_TOKEN_PLAN_TTS_VOICE,
  DEFAULT_TOKEN_PLAN_VIDEO_MODEL,
  syncTokenPlanCheckout,
} from './token-plan-sync.ts'
import {
  mergeTokenPlanSyncConfig,
  OPENMONTAGE_SETTINGS_NAMESPACE,
  OPENMONTAGE_SETTINGS_SCHEMA,
  openMontageSettingsEntry,
  watchedTokenPlanKeyRefs,
  type OpenMontageSettings,
} from './token-plan-settings.ts'

export type { CheckoutUpdateMode }
export type { TokenPlanBinding, TokenPlanSyncConfig } from './token-plan-sync.ts'
export {
  DEFAULT_TOKEN_PLAN_IMAGE_MODEL,
  DEFAULT_TOKEN_PLAN_TTS_MODEL,
  DEFAULT_TOKEN_PLAN_TTS_VOICE,
  DEFAULT_TOKEN_PLAN_VIDEO_MODEL,
  OPENMONTAGE_GENERATION_API_KEY,
} from './token-plan-sync.ts'
export {
  OPENMONTAGE_SETTINGS_NAMESPACE,
  OPENMONTAGE_SETTINGS_SCHEMA,
} from './token-plan-settings.ts'

const PROVIDER_NAME = 'openmontage'
const RESOURCE_BASE = {
  kind: 'directory',
  path: fileURLToPath(new URL('../assets/', import.meta.url)),
} as const
const INVOCATION = { modelInvocable: true, userInvocable: true } as const
const ROOT_PLACEHOLDER = '{{openmontage_root}}'

/** Model-visible OpenMontage operating section. Interpolates `{{openmontage_root}}`. */
export const OPENMONTAGE_SECTION_TEXT = 'Video production uses the OpenMontage checkout at {{openmontage_root}}. When the user asks to make, create, produce, or generate a video, load the `openmontage` skill before any production work. When the request is vague or exploratory, load `openmontage-onboarding` first. Every video request must go through an OpenMontage pipeline: read AGENT_GUIDE.md, pick a pipeline under pipeline_defs/, then execute each stage from that checkout. Use the existing bash and filesystem tools. Run Python from that checkout\'s `.venv` (`Scripts/python.exe` on Windows, `bin/python` on Unix). When the checkout `.env` has a generation key, prefer the checkout tools that match that protocol: `token_plan_video`, `token_plan_image`, and `token_plan_tts` for a DashScope or Token Plan origin, and the checkout\'s OpenAI-family image/TTS tools when `TOKEN_PLAN_KEY_ENV` names `OPENAI_API_KEY` or an OpenAI-compatible origin. Do not require FAL_KEY, ELEVENLABS_API_KEY, or other vendor keys first. Token Plan has no music-generation model; keep Pixabay or the local music library for beds. Do not write ad-hoc generation scripts or call provider APIs outside the pipeline tools. After a pipeline render, if the `opencut-openmontage` skill is registered, load it to continue timeline editing in OpenCut.'

const PRODUCTION_DESCRIPTION = 'Run an OpenMontage video production pipeline from a specific brief. Use when the user asks to make, create, produce, or generate a video with a concrete topic, duration, format, or footage.'
const ONBOARDING_DESCRIPTION = 'Introduce OpenMontage capabilities when the user is exploring video production without a specific brief. Use for vague requests such as making a video or asking what the agent can produce.'

const SKILLS = [
  {
    name: 'openmontage',
    description: PRODUCTION_DESCRIPTION,
    locator: new URL('../assets/openmontage.md', import.meta.url),
  },
  {
    name: 'openmontage-onboarding',
    description: ONBOARDING_DESCRIPTION,
    locator: new URL('../assets/openmontage-onboarding.md', import.meta.url),
  },
] as const

/** Environment variable read at load when `config.root` is omitted. */
export const OPENMONTAGE_ROOT_ENV = 'OPENMONTAGE_ROOT'

/** Absolute path to a local OpenMontage checkout. */
export interface Config {
  /**
   * Absolute filesystem path of the OpenMontage checkout.
   * When omitted, `apply()` reads `OPENMONTAGE_ROOT` and then validates the tree.
   */
  root?: string
  /**
   * Load-time git sync. `pull` fetches and fast-forwards a clean tree that is
   * behind upstream; `check` fails when behind; `off` skips git.
   */
  update?: CheckoutUpdateMode
  /**
   * POSIX credential ref copied into the checkout `.env`. Any provider name is
   * accepted (`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, Qwen Token Plan, DashScope).
   * When omitted, `OPENMONTAGE_GENERATION_API_KEY`, then the Qwen / DashScope
   * refs, are tried.
   */
  tokenPlanKeyEnv?: string
  /** API origin. Inferred only for known Qwen Token Plan / DashScope refs. */
  tokenPlanBaseUrl?: string
  /** Default Token Plan video model written to the checkout. */
  tokenPlanVideoModel?: string
  /** Default Token Plan image model written to the checkout. */
  tokenPlanImageModel?: string
  /** Default Token Plan speech model written to the checkout. */
  tokenPlanTtsModel?: string
  /** Default Qwen-Audio-TTS voice id written to the checkout. */
  tokenPlanTtsVoice?: string
}

/** Config schema: `root` is optional; `apply()` resolves it from the environment. */
export const Config: z<Config> = z.object({
  root: z.string(),
  update: z.union(['off', 'check', 'pull'] as const).default('pull'),
  tokenPlanKeyEnv: z.string(),
  tokenPlanBaseUrl: z.string(),
  tokenPlanVideoModel: z.string().default(DEFAULT_TOKEN_PLAN_VIDEO_MODEL),
  tokenPlanImageModel: z.string().default(DEFAULT_TOKEN_PLAN_IMAGE_MODEL),
  tokenPlanTtsModel: z.string().default(DEFAULT_TOKEN_PLAN_TTS_MODEL),
  tokenPlanTtsVoice: z.string().default(DEFAULT_TOKEN_PLAN_TTS_VOICE),
})

/**
 * Resolve the OpenMontage checkout path from plugin config or `OPENMONTAGE_ROOT`.
 * @param config - plugin config, possibly with `root` omitted.
 * @returns the first non-empty absolute-candidate string; callers still validate it.
 * @throws when neither `config.root` nor `OPENMONTAGE_ROOT` is set.
 */
export function resolveOpenMontageRoot(config: Config): string {
  const configured = typeof config.root === 'string' ? config.root.trim() : ''
  if (configured !== '') return configured
  const fromEnv = process.env[OPENMONTAGE_ROOT_ENV]?.trim() ?? ''
  if (fromEnv !== '') return fromEnv
  throw new Error(
    `openmontage: set config.root or ${OPENMONTAGE_ROOT_ENV} to an absolute OpenMontage checkout`,
  )
}

/** Cordis plugin name. */
export const name = 'openmontage'
/** Services required before the adapter can register. */
export const inject = ['skills', 'systemPrompt', 'credentials']

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
 * Reject a `root` that is not an absolute OpenMontage checkout.
 * @param root - candidate checkout path from Config.
 * @throws when the path is relative, missing, or lacks AGENT_GUIDE.md / pipeline_defs/.
 */
function assertOpenMontageRoot(root: string): void {
  if (typeof root !== 'string' || !isAbsolute(root)) {
    throw new Error(`openmontage: config.root must be an absolute path, got ${JSON.stringify(root)}`)
  }
  const rootStat = existingStat(root)
  if (rootStat === undefined || !rootStat.isDirectory()) {
    throw new Error(`openmontage: config.root is not an existing directory: ${root}`)
  }
  const guide = join(root, 'AGENT_GUIDE.md')
  const guideStat = existingStat(guide)
  if (guideStat === undefined || !guideStat.isFile()) {
    throw new Error(`openmontage: ${root} is not an OpenMontage checkout (missing AGENT_GUIDE.md)`)
  }
  const pipelines = join(root, 'pipeline_defs')
  const pipelinesStat = existingStat(pipelines)
  if (pipelinesStat === undefined || !pipelinesStat.isDirectory()) {
    throw new Error(`openmontage: ${root} is not an OpenMontage checkout (missing pipeline_defs/)`)
  }
}

/**
 * Build the bundled gateway-skill provider for one validated checkout.
 * @param root - absolute OpenMontage checkout path substituted into skill bodies.
 * @returns a skill provider that lists and loads the two gateway skills.
 */
function createProvider(root: string): SkillProvider {
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
        throw new Error(`openmontage: unexpected skill locator for ${candidate.name}`)
      }
      const template = await readFile(locator, 'utf8')
      return {
        name: candidate.name,
        description: candidate.description,
        invocation: candidate.invocation,
        provider: candidate.provider,
        source: candidate.source,
        resourceBase: RESOURCE_BASE,
        content: template.replaceAll(ROOT_PLACEHOLDER, root),
      }
    },
  }
}

/**
 * Validate the OpenMontage checkout, sync a Token Plan key into its `.env`,
 * and register the operating prompt plus gateway skills.
 * @param ctx - Cordis context with `skills`, `systemPrompt`, and `credentials`.
 *   `settings` is optional; when mounted, the Models page can override the
 *   Token Plan key ref, origin, and generation ids, and the checkout `.env`
 *   is rewritten live. A `credentials/updated` for a watched Token Plan ref
 *   rewrites the same block.
 * @param config - resolved plugin config.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const root = resolveOpenMontageRoot(config)
  assertOpenMontageRoot(root)
  syncGitCheckout(root, 'openmontage', config.update ?? 'pull')
  const entry = openMontageSettingsEntry(config)
  let settings = (): OpenMontageSettings => entry
  let live = false
  const writeTokenPlan = (): void => {
    if (!live) return
    void syncTokenPlanCheckout(
      root,
      mergeTokenPlanSyncConfig(config, settings()),
      ctx.credentials,
    ).catch(() => {
      // The checkout .env keeps the last successful Token Plan sync; a later
      // settings write retries.
    })
  }
  installSettingsSection(ctx, OPENMONTAGE_SETTINGS_NAMESPACE, OPENMONTAGE_SETTINGS_SCHEMA, entry, {
    setSource: (current) => { settings = current },
    onChange: writeTokenPlan,
  })
  ctx.on('credentials/updated', (ref) => {
    if (!live) return
    if (!watchedTokenPlanKeyRefs(config, settings()).includes(ref)) return
    writeTokenPlan()
  })
  live = true
  await syncTokenPlanCheckout(root, mergeTokenPlanSyncConfig(config, settings()), ctx.credentials)
  ctx.systemPrompt.variable('openmontage_root', () => root)
  ctx.systemPrompt.section({
    name: 'openmontage',
    order: 150,
    text: OPENMONTAGE_SECTION_TEXT,
  })
  ctx.skills.registerProvider(() => createProvider(root))
}
