import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GENERATION_PROFILE,
  DEFAULT_OUTPUT_DURATION_SECONDS,
  DEFAULT_OUTPUT_RESOLUTION,
  DEFAULT_OUTPUT_UPSCALE_TO,
  GENERATION_PROFILES,
  isGenerationProfile,
  isOutputResolution,
  isUpscaleTarget,
  isValidUpscalePair,
  normalizeUpscaleTo,
  openMontageSettingsEntry,
  OUTPUT_RESOLUTIONS,
  UPSCALE_TARGETS,
} from '../src/token-plan-settings.ts'

describe('openMontageSettingsEntry studio defaults', () => {
  it('uses Config duration, resolution, upscale, and profile when provided', () => {
    expect(openMontageSettingsEntry({})).toMatchObject({
      outputDurationSeconds: DEFAULT_OUTPUT_DURATION_SECONDS,
      outputResolution: DEFAULT_OUTPUT_RESOLUTION,
      outputUpscaleTo: DEFAULT_OUTPUT_UPSCALE_TO,
      generationProfile: DEFAULT_GENERATION_PROFILE,
    })
    expect(openMontageSettingsEntry({
      outputDurationSeconds: 60,
      outputResolution: '480p',
      outputUpscaleTo: '4k',
      generationProfile: 'cost',
    })).toMatchObject({
      outputDurationSeconds: 60,
      outputResolution: '480p',
      outputUpscaleTo: '4k',
      generationProfile: 'cost',
    })
  })

  it('rejects a non-positive duration, unknown resolution, and non-higher upscale', () => {
    expect(openMontageSettingsEntry({
      outputDurationSeconds: 0,
      outputResolution: 'bogus' as never,
      outputUpscaleTo: '720p',
      generationProfile: 'nope' as never,
    })).toMatchObject({
      outputDurationSeconds: DEFAULT_OUTPUT_DURATION_SECONDS,
      outputResolution: DEFAULT_OUTPUT_RESOLUTION,
      outputUpscaleTo: DEFAULT_OUTPUT_UPSCALE_TO,
      generationProfile: DEFAULT_GENERATION_PROFILE,
    })
    expect(normalizeUpscaleTo('1080p', '720p')).toBe('')
    expect(normalizeUpscaleTo('480p', '720p')).toBe('720p')
  })

  it('names the Config resolution, upscale, and profile enums', () => {
    expect(OUTPUT_RESOLUTIONS).toEqual(['480p', '720p', '1080p', '4k'])
    expect(UPSCALE_TARGETS).toEqual(['720p', '1080p', '4k'])
    expect(GENERATION_PROFILES).toEqual(['auto', 'cost', 'quality', 'drama'])
    expect(isOutputResolution('480p')).toBe(true)
    expect(isOutputResolution('8k')).toBe(false)
    expect(isUpscaleTarget('1080p')).toBe(true)
    expect(isGenerationProfile('drama')).toBe(true)
    expect(isGenerationProfile('kling')).toBe(false)
    expect(isValidUpscalePair('480p', '720p')).toBe(true)
    expect(isValidUpscalePair('4k', '1080p')).toBe(false)
  })
})
