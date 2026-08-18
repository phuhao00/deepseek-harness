/**
 * User-layer Token Plan generation models for the OpenMontage checkout.
 * @module @deepseek-ai/dsh-openmontage/token-plan-settings
 */

import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { TokenPlanSyncConfig } from './token-plan-sync.ts'
import {
  DEFAULT_TOKEN_PLAN_IMAGE_MODEL,
  DEFAULT_TOKEN_PLAN_KEY_ENVS,
  DEFAULT_TOKEN_PLAN_TTS_MODEL,
  DEFAULT_TOKEN_PLAN_TTS_VOICE,
  DEFAULT_TOKEN_PLAN_VIDEO_MODEL,
} from './token-plan-sync.ts'

/** Settings namespace the Models page edits when this plugin is mounted. */
export const OPENMONTAGE_SETTINGS_NAMESPACE = settingsNamespace('openmontage')

/** Allowed studio output resolutions (Config / settings enum). */
export const OUTPUT_RESOLUTIONS = ['480p', '720p', '1080p', '4k'] as const
/** One allowed studio output resolution. */
export type OpenMontageOutputResolution = (typeof OUTPUT_RESOLUTIONS)[number]
/** Allowed studio upscale targets (strictly higher than the generation resolution). */
export const UPSCALE_TARGETS = ['720p', '1080p', '4k'] as const
/** One allowed studio upscale target. */
export type OpenMontageUpscaleTarget = (typeof UPSCALE_TARGETS)[number]
/**
 * Studio generation-profile ids. Phase-1 preferences for the agent / first
 * user message; they do not switch vendor SDKs. New provider APIs stay deferred.
 */
export const GENERATION_PROFILES = ['auto', 'cost', 'quality', 'drama'] as const
/** One studio generation-profile id. */
export type OpenMontageGenerationProfile = (typeof GENERATION_PROFILES)[number]
/** Pixel rank used to compare generation resolution vs upscale target. */
export const RESOLUTION_RANK: Record<OpenMontageOutputResolution, number> = {
  '480p': 480,
  '720p': 720,
  '1080p': 1080,
  '4k': 2160,
}
/** Default studio duration in seconds when Config omits the field. */
export const DEFAULT_OUTPUT_DURATION_SECONDS = 30
/** Default studio resolution when Config omits the field. */
export const DEFAULT_OUTPUT_RESOLUTION: OpenMontageOutputResolution = '1080p'
/** Default studio upscale target: empty means no upscale. */
export const DEFAULT_OUTPUT_UPSCALE_TO = '' as const
/** Default studio generation profile when Config omits the field. */
export const DEFAULT_GENERATION_PROFILE: OpenMontageGenerationProfile = 'auto'

/** Optional Token Plan binding stored in the user settings layer. */
export interface OpenMontageSettings {
  /** Single credential ref. Empty means try {@link DEFAULT_TOKEN_PLAN_KEY_ENVS}. */
  tokenPlanKeyEnv?: string
  /** API origin. Empty means infer only for known Qwen Token Plan / DashScope refs. */
  tokenPlanBaseUrl?: string
  /** Token Plan text-to-video model id. */
  tokenPlanVideoModel?: string
  /** Token Plan text-to-image model id. */
  tokenPlanImageModel?: string
  /** Token Plan text-to-speech model id. */
  tokenPlanTtsModel?: string
  /** Qwen-Audio-TTS voice id. */
  tokenPlanTtsVoice?: string
  /** Default studio output duration in seconds. */
  outputDurationSeconds?: number
  /** Default studio generation resolution. */
  outputResolution?: OpenMontageOutputResolution
  /** Default upscale target after generation. Empty means no upscale. */
  outputUpscaleTo?: OpenMontageUpscaleTarget | ''
  /** Default studio generation profile (agent preference; not a vendor switch). */
  generationProfile?: OpenMontageGenerationProfile
}

/** Schema of the OpenMontage settings section. */
export const OPENMONTAGE_SETTINGS_SCHEMA: z<OpenMontageSettings> = z.object({
  tokenPlanKeyEnv: z.string(),
  tokenPlanBaseUrl: z.string(),
  tokenPlanVideoModel: z.string(),
  tokenPlanImageModel: z.string(),
  tokenPlanTtsModel: z.string(),
  tokenPlanTtsVoice: z.string(),
  outputDurationSeconds: z.number(),
  outputResolution: z.union(['480p', '720p', '1080p', '4k'] as const),
  outputUpscaleTo: z.union(['', '720p', '1080p', '4k'] as const),
  generationProfile: z.union(['auto', 'cost', 'quality', 'drama'] as const),
})

/** Composition fields that seed the settings entry beyond Token Plan sync. */
export interface OpenMontageSettingsSeed extends TokenPlanSyncConfig {
  /** Default studio duration in seconds. */
  outputDurationSeconds?: number
  /** Default studio generation resolution. */
  outputResolution?: OpenMontageOutputResolution
  /** Default upscale target; empty or omitted means no upscale. */
  outputUpscaleTo?: OpenMontageUpscaleTarget | ''
  /** Default studio generation profile. */
  generationProfile?: OpenMontageGenerationProfile
}

/**
 * Whether a value is one of the Config resolution literals.
 * @param value - candidate resolution.
 * @returns true when the value is an allowed resolution.
 */
export function isOutputResolution(value: unknown): value is OpenMontageOutputResolution {
  return typeof value === 'string' && (OUTPUT_RESOLUTIONS as readonly string[]).includes(value)
}

/**
 * Whether a value is one of the Config upscale-target literals.
 * @param value - candidate upscale target.
 * @returns true when the value is an allowed upscale target.
 */
export function isUpscaleTarget(value: unknown): value is OpenMontageUpscaleTarget {
  return typeof value === 'string' && (UPSCALE_TARGETS as readonly string[]).includes(value)
}

/**
 * Whether a value is one of the Config generation-profile literals.
 * @param value - candidate profile id.
 * @returns true when the value is an allowed profile.
 */
export function isGenerationProfile(value: unknown): value is OpenMontageGenerationProfile {
  return typeof value === 'string' && (GENERATION_PROFILES as readonly string[]).includes(value)
}

/**
 * Whether an upscale target is strictly higher than the generation resolution.
 * @param source - generation resolution.
 * @param target - requested upscale target.
 * @returns true when the target is a valid higher resolution.
 */
export function isValidUpscalePair(
  source: OpenMontageOutputResolution,
  target: OpenMontageUpscaleTarget,
): boolean {
  return RESOLUTION_RANK[target] > RESOLUTION_RANK[source]
}

/**
 * Normalize an optional upscale target against a generation resolution.
 * @param source - generation resolution.
 * @param value - candidate upscale target (empty means none).
 * @returns a valid higher target, or empty when none / invalid.
 */
export function normalizeUpscaleTo(
  source: OpenMontageOutputResolution,
  value: unknown,
): OpenMontageUpscaleTarget | '' {
  if (value === undefined || value === null || value === '') return ''
  if (!isUpscaleTarget(value)) return ''
  return isValidUpscalePair(source, value) ? value : ''
}

/**
 * Composition defaults written when a settings field is omitted.
 * @param config - plugin Config fields that seed the `openmontage` section.
 * @returns duration, resolution, upscale, and Token Plan strings ready for settings.
 */
export function openMontageSettingsEntry(config: OpenMontageSettingsSeed): OpenMontageSettings {
  const duration = config.outputDurationSeconds
  const resolution = isOutputResolution(config.outputResolution)
    ? config.outputResolution
    : DEFAULT_OUTPUT_RESOLUTION
  return {
    tokenPlanKeyEnv: config.tokenPlanKeyEnv?.trim() || '',
    tokenPlanBaseUrl: config.tokenPlanBaseUrl?.trim() || '',
    tokenPlanVideoModel: config.tokenPlanVideoModel?.trim() || DEFAULT_TOKEN_PLAN_VIDEO_MODEL,
    tokenPlanImageModel: config.tokenPlanImageModel?.trim() || DEFAULT_TOKEN_PLAN_IMAGE_MODEL,
    tokenPlanTtsModel: config.tokenPlanTtsModel?.trim() || DEFAULT_TOKEN_PLAN_TTS_MODEL,
    tokenPlanTtsVoice: config.tokenPlanTtsVoice?.trim() || DEFAULT_TOKEN_PLAN_TTS_VOICE,
    outputDurationSeconds: typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? duration
      : DEFAULT_OUTPUT_DURATION_SECONDS,
    outputResolution: resolution,
    outputUpscaleTo: normalizeUpscaleTo(resolution, config.outputUpscaleTo),
    generationProfile: isGenerationProfile(config.generationProfile)
      ? config.generationProfile
      : DEFAULT_GENERATION_PROFILE,
  }
}

/**
 * Credential refs whose `credentials/updated` should rewrite the checkout `.env`.
 * @param config - composition Token Plan fields.
 * @param settings - resolved settings section, or the composition entry.
 * @returns one explicit ref, or the default try-order.
 */
export function watchedTokenPlanKeyRefs(
  config: TokenPlanSyncConfig,
  settings: OpenMontageSettings,
): readonly string[] {
  const explicit = settings.tokenPlanKeyEnv?.trim() || config.tokenPlanKeyEnv?.trim() || ''
  return explicit === '' ? DEFAULT_TOKEN_PLAN_KEY_ENVS : [explicit]
}

/**
 * Merge plugin config (key/origin) with the live settings model ids.
 * @param config - composition Token Plan fields, including the key ref.
 * @param settings - resolved settings section, or the composition entry.
 * @returns the binding input {@link resolveTokenPlanBinding} reads.
 */
export function mergeTokenPlanSyncConfig(
  config: TokenPlanSyncConfig,
  settings: OpenMontageSettings,
): TokenPlanSyncConfig {
  type TokenPlanStringKey =
    | 'tokenPlanKeyEnv'
    | 'tokenPlanBaseUrl'
    | 'tokenPlanVideoModel'
    | 'tokenPlanImageModel'
    | 'tokenPlanTtsModel'
    | 'tokenPlanTtsVoice'
  const pick = (key: TokenPlanStringKey): string | undefined => {
    const fromSettings = settings[key]?.trim()
    if (fromSettings !== undefined && fromSettings !== '') return fromSettings
    const fromConfig = config[key]?.trim()
    return fromConfig === undefined || fromConfig === '' ? undefined : fromConfig
  }
  const keyEnv = pick('tokenPlanKeyEnv')
  const baseUrl = pick('tokenPlanBaseUrl')
  const video = pick('tokenPlanVideoModel')
  const image = pick('tokenPlanImageModel')
  const tts = pick('tokenPlanTtsModel')
  const voice = pick('tokenPlanTtsVoice')
  return {
    ...keyEnv === undefined ? {} : { tokenPlanKeyEnv: keyEnv },
    ...baseUrl === undefined ? {} : { tokenPlanBaseUrl: baseUrl },
    ...video === undefined ? {} : { tokenPlanVideoModel: video },
    ...image === undefined ? {} : { tokenPlanImageModel: image },
    ...tts === undefined ? {} : { tokenPlanTtsModel: tts },
    ...voice === undefined ? {} : { tokenPlanTtsVoice: voice },
  }
}
