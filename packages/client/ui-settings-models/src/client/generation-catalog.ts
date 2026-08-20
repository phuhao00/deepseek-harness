/**
 * Token Plan / DashScope generation ids the OpenMontage checkout tools accept.
 * Keep aligned with `VIDEO_MODELS` / `IMAGE_MODELS` / `TTS_MODELS` in the
 * checkout. A custom id is always allowed beside this catalog.
 */

/** One selectable generation id. */
export interface GenerationChoice {
  /** Wire / checkout model or voice id. */
  id: string
  /** Optional display name when it differs from the id. */
  label?: string
}

/** Select value that reveals a free-text id field. */
export const CUSTOM_GENERATION_ID = '__custom_generation__'

/** HappyHorse / Wan video ids from the checkout `token_plan_video` tool. */
export const TOKEN_PLAN_VIDEO_MODELS: readonly GenerationChoice[] = [
  { id: 'happyhorse-1.1-t2v', label: 'HappyHorse 1.1 text-to-video' },
  { id: 'happyhorse-1.1-i2v', label: 'HappyHorse 1.1 image-to-video' },
  { id: 'happyhorse-1.1-r2v', label: 'HappyHorse 1.1 reference-to-video' },
  { id: 'wan2.7-t2v', label: 'Wan 2.7 text-to-video' },
  { id: 'wan2.7-i2v', label: 'Wan 2.7 image-to-video' },
  { id: 'wan2.7-t2v-2026-06-12', label: 'Wan 2.7 text-to-video (2026-06-12)' },
  { id: 'wan2.7-i2v-2026-04-25', label: 'Wan 2.7 image-to-video (2026-04-25)' },
]

/** Wan image ids from the checkout `token_plan_image` tool. */
export const TOKEN_PLAN_IMAGE_MODELS: readonly GenerationChoice[] = [
  { id: 'wan2.7-image', label: 'Wan 2.7 image' },
  { id: 'wan2.7-image-pro', label: 'Wan 2.7 image pro' },
  { id: 'wan2.6-image', label: 'Wan 2.6 image' },
]

/** Qwen-Audio-TTS ids from the checkout `token_plan_tts` tool. */
export const TOKEN_PLAN_TTS_MODELS: readonly GenerationChoice[] = [
  { id: 'qwen-audio-3.0-tts-plus', label: 'Qwen-Audio-TTS 3.0 Plus' },
  { id: 'qwen-audio-3.0-tts-flash', label: 'Qwen-Audio-TTS 3.0 Flash' },
]

/**
 * Current Qwen-Audio-TTS system voices (Plus flagship + Flash premium).
 * A cloned or otherwise unpublished id is entered as custom.
 */
export const TOKEN_PLAN_TTS_VOICES: readonly GenerationChoice[] = [
  { id: 'longanlingxin', label: 'Long An Ling Xin' },
  { id: 'longanlufeng', label: 'Long An Lu Feng' },
  { id: 'longanhuan_v3.6', label: 'Long An Huan' },
  { id: 'longanfengyue', label: 'Long An Feng Yue' },
  { id: 'longanyuanfei', label: 'Long An Yuan Fei' },
  { id: 'longanlingxi', label: 'Long An Ling Xi' },
  { id: 'longanxiaoxin', label: 'Long An Xiao Xin' },
  { id: 'longjielidou_v3.6', label: 'Long Jie Li Dou' },
  { id: 'longpaopao_v3.6', label: 'Long Pao Pao' },
  { id: 'longhuohuo_v3.6', label: 'Long Huo Huo' },
  { id: 'longchuanshu_v3.6', label: 'Long Chuan Shu' },
  { id: 'loongmary', label: 'loongmary' },
  { id: 'loongeva_v3.6', label: 'loongeva' },
  { id: 'loongjohn', label: 'loongjohn' },
]

/** Catalog keyed by the `openmontage` settings field. */
export const GENERATION_CATALOG = {
  tokenPlanVideoModel: TOKEN_PLAN_VIDEO_MODELS,
  tokenPlanImageModel: TOKEN_PLAN_IMAGE_MODELS,
  tokenPlanTtsModel: TOKEN_PLAN_TTS_MODELS,
  tokenPlanTtsVoice: TOKEN_PLAN_TTS_VOICES,
} as const

/** Settings fields that have a generation catalog. */
export type GenerationCatalogField = keyof typeof GENERATION_CATALOG

/**
 * Whether `id` is a catalog row for `field`.
 * @param field - generation settings field.
 * @param id - stored or draft id.
 * @returns true when `id` matches a catalog choice for `field`.
 */
export function isCatalogGenerationId(field: GenerationCatalogField, id: string): boolean {
  return GENERATION_CATALOG[field].some(choice => choice.id === id)
}

/**
 * Select value for a stored generation id.
 * @param field - generation settings field.
 * @param id - stored or draft id.
 * @returns the id when it is in the catalog, otherwise {@link CUSTOM_GENERATION_ID}.
 */
export function generationSelectValue(field: GenerationCatalogField, id: string): string {
  return isCatalogGenerationId(field, id) ? id : CUSTOM_GENERATION_ID
}

/**
 * Option label for one catalog row.
 * @param choice - catalog row.
 * @returns `id`, or `label (id)` when label differs from id.
 */
export function generationChoiceLabel(choice: GenerationChoice): string {
  return choice.label === undefined || choice.label === choice.id
    ? choice.id
    : `${choice.label} (${choice.id})`
}
