/**
 * Fixed first-user-message layout for the video studio.
 * @module @deepseek-ai/dsh-client-ui-openmontage-studio/studio-prompt
 */

/** Studio generation resolutions; Host Config owns the same enum. */
export const STUDIO_RESOLUTIONS = ['480p', '720p', '1080p', '4k'] as const
/** One studio generation resolution. */
export type StudioResolution = (typeof STUDIO_RESOLUTIONS)[number]
/** Studio upscale targets; must be strictly higher than the generation resolution. */
export const STUDIO_UPSCALE_TARGETS = ['720p', '1080p', '4k'] as const
/** One studio upscale target. */
export type StudioUpscaleTarget = (typeof STUDIO_UPSCALE_TARGETS)[number]
/**
 * Studio generation-profile ids (match Host `generationProfile`).
 * Preferences for the agent; they do not switch vendor SDKs.
 */
export const STUDIO_GENERATION_PROFILES = ['auto', 'cost', 'quality', 'drama'] as const
/** One studio generation-profile id. */
export type StudioGenerationProfile = (typeof STUDIO_GENERATION_PROFILES)[number]
/** Chinese labels written into the first user message for each profile. */
export const STUDIO_GENERATION_PROFILE_LABELS: Record<StudioGenerationProfile, string> = {
  auto: '自动',
  cost: '极致性价比',
  quality: '成片优先',
  drama: '短剧量产',
}
/** Pixel rank used to compare generation resolution vs upscale target. */
export const STUDIO_RESOLUTION_RANK: Record<StudioResolution, number> = {
  '480p': 480,
  '720p': 720,
  '1080p': 1080,
  '4k': 2160,
}
/** Duration chips on the studio form (seconds). The default still comes from settings. */
export const DURATION_PRESETS = [15, 30, 60, 90] as const

/** One OpenWiki page title (and optional pasted or listed summary) in the brief. */
export interface StudioWikiExcerpt {
  /** Display title (directory name under workspace `openwiki/`). */
  title: string
  /** Optional summary; names-only listing leaves this empty. */
  summary?: string
}

/** Fields the studio formats into the first user message. */
export interface StudioPromptInput {
  /** Output duration in seconds. */
  durationSeconds: number
  /** Generation resolution literal. */
  resolution: StudioResolution
  /** Optional upscale target after generation. */
  upscaleTo?: StudioUpscaleTarget
  /** Generation-profile preference for the agent. */
  generationProfile: StudioGenerationProfile
  /** Workspace directory used as the production root. */
  workspacePath: string
  /** Directory where finished renders should be written. */
  outputPath: string
  /** User brief / topic. */
  brief: string
  /** Selected OpenWiki page titles. */
  wikiPages: readonly StudioWikiExcerpt[]
  /** Optional pasted excerpt (Goldfish or pages browse cannot read). */
  pastedExcerpt?: string
}

/**
 * Whether a value is a studio resolution literal.
 * @param value - candidate resolution.
 * @returns true when the value is one of {@link STUDIO_RESOLUTIONS}.
 */
export function isStudioResolution(value: unknown): value is StudioResolution {
  return typeof value === 'string' && (STUDIO_RESOLUTIONS as readonly string[]).includes(value)
}

/**
 * Whether a value is a studio upscale-target literal.
 * @param value - candidate upscale target.
 * @returns true when the value is one of {@link STUDIO_UPSCALE_TARGETS}.
 */
export function isStudioUpscaleTarget(value: unknown): value is StudioUpscaleTarget {
  return typeof value === 'string' && (STUDIO_UPSCALE_TARGETS as readonly string[]).includes(value)
}

/**
 * Whether a value is a studio generation-profile literal.
 * @param value - candidate profile id.
 * @returns true when the value is one of {@link STUDIO_GENERATION_PROFILES}.
 */
export function isStudioGenerationProfile(value: unknown): value is StudioGenerationProfile {
  return typeof value === 'string' && (STUDIO_GENERATION_PROFILES as readonly string[]).includes(value)
}

/**
 * Whether an upscale target is strictly higher than the generation resolution.
 * @param source - generation resolution.
 * @param target - requested upscale target.
 * @returns true when the target is a valid higher resolution.
 */
export function isValidStudioUpscale(
  source: StudioResolution,
  target: StudioUpscaleTarget,
): boolean {
  return STUDIO_RESOLUTION_RANK[target] > STUDIO_RESOLUTION_RANK[source]
}

/**
 * Upscale chips that are strictly higher than the chosen generation resolution.
 * @param source - generation resolution.
 * @returns allowed upscale targets for the form.
 */
export function upscaleTargetsFor(source: StudioResolution): readonly StudioUpscaleTarget[] {
  return STUDIO_UPSCALE_TARGETS.filter(target => isValidStudioUpscale(source, target))
}

/** Duration, resolution, upscale, and profile read from a redacted `openmontage` settings value. */
export interface StudioSettingsDefaults {
  /** Seconds from the settings section. */
  durationSeconds: number | undefined
  /** Generation resolution from the settings section. */
  resolution: StudioResolution | undefined
  /** Upscale target from the settings section; undefined when none. */
  upscaleTo: StudioUpscaleTarget | undefined
  /** Generation profile from the settings section. */
  generationProfile: StudioGenerationProfile | undefined
  /** Settings revision for a later mutate. */
  revision: number
}

/**
 * Read studio defaults from a redacted settings namespace value.
 * @param value - `openmontage` resolved section.
 * @param revision - namespace revision from `settings.describe`.
 * @returns parsed duration/resolution/upscale/profile, omitting invalid fields.
 */
export function readStudioSettings(value: unknown, revision: number): StudioSettingsDefaults {
  if (typeof value !== 'object' || value === null) {
    return {
      durationSeconds: undefined,
      resolution: undefined,
      upscaleTo: undefined,
      generationProfile: undefined,
      revision,
    }
  }
  const record = value as Record<string, unknown>
  const duration = record.outputDurationSeconds
  const resolution = isStudioResolution(record.outputResolution)
    ? record.outputResolution
    : undefined
  const upscaleRaw = record.outputUpscaleTo
  const upscaleTo = resolution !== undefined
    && isStudioUpscaleTarget(upscaleRaw)
    && isValidStudioUpscale(resolution, upscaleRaw)
    ? upscaleRaw
    : undefined
  return {
    durationSeconds: typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? duration
      : undefined,
    resolution,
    upscaleTo,
    generationProfile: isStudioGenerationProfile(record.generationProfile)
      ? record.generationProfile
      : undefined,
    revision,
  }
}

/**
 * Format the model-visible first user message for one studio submission.
 * @param input - duration, resolution, optional upscale, profile, paths, brief, and wiki excerpts.
 * @returns the exact user-message text the session logs.
 */
export function formatStudioPrompt(input: StudioPromptInput): string {
  const spec = input.upscaleTo === undefined
    ? `时长：${String(input.durationSeconds)} 秒。清晰度：${input.resolution}。`
    : `时长：${String(input.durationSeconds)} 秒。清晰度：${input.resolution}。超分到：${input.upscaleTo}。`
  const lines = [
    '制作一条视频。',
    '先 load `openmontage` skill，再按 pipeline 执行；用户给出的时长、清晰度、超分目标、输出目录与生成方案必须遵守，不得自行改规格。',
    spec,
    `生成方案：${STUDIO_GENERATION_PROFILE_LABELS[input.generationProfile]}。`,
    `工作区目录：${input.workspacePath}。`,
    `输出目录：${input.outputPath}。`,
    '简报：',
    input.brief.trim(),
  ]
  const pasted = input.pastedExcerpt?.trim() ?? ''
  if (input.wikiPages.length > 0 || pasted !== '') {
    lines.push('', 'OpenWiki 上下文：')
    for (const page of input.wikiPages) {
      lines.push(`## ${page.title}`)
      const summary = page.summary?.trim() ?? ''
      if (summary !== '') lines.push(summary)
    }
    if (pasted !== '') {
      lines.push('## 粘贴摘录')
      lines.push(pasted)
    }
  }
  return `${lines.join('\n')}\n`
}
