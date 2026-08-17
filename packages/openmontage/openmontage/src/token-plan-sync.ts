/**
 * Copy a Qwen Token Plan / DashScope key into the OpenMontage checkout `.env`
 * so pipeline tools can generate video, images, and speech from that plan.
 * @module @deepseek-ai/dsh-openmontage/token-plan-sync
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Env refs tried in order when `config.tokenPlanKeyEnv` is omitted. */
export const DEFAULT_TOKEN_PLAN_KEY_ENVS = [
  'QWEN_TOKEN_PLAN_CN_API_KEY',
  'QWEN_TOKEN_PLAN_API_KEY',
  'DASHSCOPE_API_KEY',
] as const

/** Beijing Token Plan exclusive endpoint. */
export const TOKEN_PLAN_CN_BASE_URL = 'https://token-plan.cn-beijing.maas.aliyuncs.com'
/** Singapore Token Plan exclusive endpoint. */
export const TOKEN_PLAN_INTL_BASE_URL = 'https://token-plan.ap-southeast-1.maas.aliyuncs.com'
/** Generic DashScope Beijing endpoint. */
export const DASHSCOPE_CN_BASE_URL = 'https://dashscope.aliyuncs.com'

const MANAGED_BEGIN = '# dsh-openmontage token-plan (managed)'
const MANAGED_KEYS = [
  'DASHSCOPE_API_KEY',
  'TOKEN_PLAN_BASE_URL',
  'TOKEN_PLAN_VIDEO_MODEL',
  'TOKEN_PLAN_IMAGE_MODEL',
  'TOKEN_PLAN_TTS_MODEL',
  'TOKEN_PLAN_TTS_VOICE',
] as const

/** Fields that select which Token Plan key and models to sync. */
export interface TokenPlanSyncConfig {
  /** Single env ref to resolve. When omitted, {@link DEFAULT_TOKEN_PLAN_KEY_ENVS} is tried. */
  tokenPlanKeyEnv?: string
  /** DashScope / Token Plan API origin. Inferred from the resolved ref when omitted. */
  tokenPlanBaseUrl?: string
  /** Default text-to-video model id written to the checkout. */
  tokenPlanVideoModel?: string
  /** Default text-to-image model id written to the checkout. */
  tokenPlanImageModel?: string
  /** Default text-to-speech model id written to the checkout. */
  tokenPlanTtsModel?: string
  /** Default Qwen-Audio-TTS voice id written to the checkout. */
  tokenPlanTtsVoice?: string
}

/** A resolved Token Plan binding ready to write into the checkout. */
export interface TokenPlanBinding {
  /** Env ref that supplied the key. */
  keyEnv: string
  /** Secret value; callers must not log it. */
  apiKey: string
  /** API origin without a trailing slash. */
  baseUrl: string
  /** Default video model id. */
  videoModel: string
  /** Default image model id. */
  imageModel: string
  /** Default speech model id. */
  ttsModel: string
  /** Default Qwen-Audio-TTS voice id. */
  ttsVoice: string
}

/** Minimal credentials face used when the service is mounted. */
export interface TokenPlanCredentialLookup {
  resolve(ref: string): Promise<{ value: string } | undefined>
}

/**
 * Pick the Token Plan exclusive or DashScope origin for one resolved ref.
 * @param keyEnv - env ref that supplied the key.
 * @param apiKey - secret value; used only to detect a Token Plan `sk-sp-` key.
 * @param configured - explicit origin from config or `TOKEN_PLAN_BASE_URL`.
 * @returns origin without a trailing slash.
 */
export function inferTokenPlanBaseUrl(keyEnv: string, apiKey: string, configured?: string): string {
  const explicit = configured?.trim() || process.env.TOKEN_PLAN_BASE_URL?.trim() || ''
  if (explicit !== '') return explicit.replace(/\/$/, '')
  if (keyEnv === 'QWEN_TOKEN_PLAN_API_KEY') return TOKEN_PLAN_INTL_BASE_URL
  if (keyEnv === 'DASHSCOPE_API_KEY' && !apiKey.startsWith('sk-sp-')) return DASHSCOPE_CN_BASE_URL
  return TOKEN_PLAN_CN_BASE_URL
}

/**
 * Resolve a Token Plan / DashScope key from the process env, then credentials.
 * @param config - optional ref and model overrides.
 * @param credentials - `ctx.credentials` when the web profile mounted it.
 * @returns the binding, or `undefined` when no key is configured.
 */
export async function resolveTokenPlanBinding(
  config: TokenPlanSyncConfig,
  credentials?: TokenPlanCredentialLookup,
): Promise<TokenPlanBinding | undefined> {
  const refs = config.tokenPlanKeyEnv?.trim()
    ? [config.tokenPlanKeyEnv.trim()]
    : [...DEFAULT_TOKEN_PLAN_KEY_ENVS]
  for (const keyEnv of refs) {
    const fromEnv = process.env[keyEnv]?.trim() ?? ''
    const fromStore = fromEnv === '' && credentials !== undefined
      ? (await credentials.resolve(keyEnv))?.value.trim() ?? ''
      : ''
    const apiKey = fromEnv !== '' ? fromEnv : fromStore
    if (apiKey === '') continue
    return {
      keyEnv,
      apiKey,
      baseUrl: inferTokenPlanBaseUrl(keyEnv, apiKey, config.tokenPlanBaseUrl),
      videoModel: config.tokenPlanVideoModel?.trim() || process.env.TOKEN_PLAN_VIDEO_MODEL?.trim() || 'happyhorse-1.1-t2v',
      imageModel: config.tokenPlanImageModel?.trim() || process.env.TOKEN_PLAN_IMAGE_MODEL?.trim() || 'wan2.7-image',
      ttsModel: config.tokenPlanTtsModel?.trim() || process.env.TOKEN_PLAN_TTS_MODEL?.trim() || 'qwen-audio-3.0-tts-plus',
      ttsVoice: config.tokenPlanTtsVoice?.trim() || process.env.TOKEN_PLAN_TTS_VOICE?.trim() || 'longanhuan_v3.6',
    }
  }
  return undefined
}

/**
 * Replace or append the managed Token Plan block in a dotenv document.
 * @param existing - current file text, or empty when the file is missing.
 * @param binding - resolved binding.
 * @returns the rewritten document, ending with one newline.
 */
export function renderTokenPlanEnvBlock(existing: string, binding: TokenPlanBinding): string {
  const lines = existing.replaceAll('\r\n', '\n').split('\n')
  const kept: string[] = []
  let skipping = false
  for (const line of lines) {
    if (line.trim() === MANAGED_BEGIN) {
      skipping = true
      continue
    }
    const key = line.split('=', 1)[0]?.trim() ?? ''
    if (skipping && (MANAGED_KEYS as readonly string[]).includes(key)) continue
    if (skipping && line.trim() === '') {
      skipping = false
      continue
    }
    skipping = false
    if ((MANAGED_KEYS as readonly string[]).includes(key)) continue
    kept.push(line)
  }
  while (kept.length > 0 && kept[kept.length - 1] === '') kept.pop()
  const block = [
    MANAGED_BEGIN,
    `DASHSCOPE_API_KEY=${binding.apiKey}`,
    `TOKEN_PLAN_BASE_URL=${binding.baseUrl}`,
    `TOKEN_PLAN_VIDEO_MODEL=${binding.videoModel}`,
    `TOKEN_PLAN_IMAGE_MODEL=${binding.imageModel}`,
    `TOKEN_PLAN_TTS_MODEL=${binding.ttsModel}`,
    `TOKEN_PLAN_TTS_VOICE=${binding.ttsVoice}`,
  ]
  const body = [...kept, ...block].join('\n').replace(/\n+$/u, '')
  return `${body}\n`
}

/**
 * Write the Token Plan binding into `root/.env` and mirror it on `process.env`
 * for children of this process. No-op when no key resolves.
 * @param root - validated OpenMontage checkout.
 * @param config - optional ref and model overrides.
 * @param credentials - `ctx.credentials` when mounted.
 * @returns the binding that was written, or `undefined` when nothing was synced.
 */
export async function syncTokenPlanCheckout(
  root: string,
  config: TokenPlanSyncConfig,
  credentials?: TokenPlanCredentialLookup,
): Promise<TokenPlanBinding | undefined> {
  const binding = await resolveTokenPlanBinding(config, credentials)
  if (binding === undefined) return undefined
  const envPath = join(root, '.env')
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
  writeFileSync(envPath, renderTokenPlanEnvBlock(existing, binding), 'utf8')
  if (!process.env.DASHSCOPE_API_KEY) process.env.DASHSCOPE_API_KEY = binding.apiKey
  if (!process.env.TOKEN_PLAN_BASE_URL) process.env.TOKEN_PLAN_BASE_URL = binding.baseUrl
  if (!process.env.TOKEN_PLAN_VIDEO_MODEL) process.env.TOKEN_PLAN_VIDEO_MODEL = binding.videoModel
  if (!process.env.TOKEN_PLAN_IMAGE_MODEL) process.env.TOKEN_PLAN_IMAGE_MODEL = binding.imageModel
  if (!process.env.TOKEN_PLAN_TTS_MODEL) process.env.TOKEN_PLAN_TTS_MODEL = binding.ttsModel
  if (!process.env.TOKEN_PLAN_TTS_VOICE) process.env.TOKEN_PLAN_TTS_VOICE = binding.ttsVoice
  return binding
}
