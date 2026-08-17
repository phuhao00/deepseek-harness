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
}

/** Schema of the OpenMontage settings section. */
export const OPENMONTAGE_SETTINGS_SCHEMA: z<OpenMontageSettings> = z.object({
  tokenPlanKeyEnv: z.string(),
  tokenPlanBaseUrl: z.string(),
  tokenPlanVideoModel: z.string(),
  tokenPlanImageModel: z.string(),
  tokenPlanTtsModel: z.string(),
  tokenPlanTtsVoice: z.string(),
})

/** Composition defaults written when a settings field is omitted. */
export function openMontageSettingsEntry(config: TokenPlanSyncConfig): OpenMontageSettings {
  return {
    tokenPlanKeyEnv: config.tokenPlanKeyEnv?.trim() || '',
    tokenPlanBaseUrl: config.tokenPlanBaseUrl?.trim() || '',
    tokenPlanVideoModel: config.tokenPlanVideoModel?.trim() || DEFAULT_TOKEN_PLAN_VIDEO_MODEL,
    tokenPlanImageModel: config.tokenPlanImageModel?.trim() || DEFAULT_TOKEN_PLAN_IMAGE_MODEL,
    tokenPlanTtsModel: config.tokenPlanTtsModel?.trim() || DEFAULT_TOKEN_PLAN_TTS_MODEL,
    tokenPlanTtsVoice: config.tokenPlanTtsVoice?.trim() || DEFAULT_TOKEN_PLAN_TTS_VOICE,
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
  const pick = (key: keyof OpenMontageSettings): string | undefined => {
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
