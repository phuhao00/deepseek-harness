import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resolvePipelineStage,
  resolveSeatGenerationProfile,
  seatOperatingText,
  shouldIsolateCheckoutEnv,
  skillAllowedForStage,
} from '../src/seat-env.ts'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('openmontage seat env', () => {
  it('prefers the seat generation profile over plugin config', () => {
    vi.stubEnv('OPENMONTAGE_GENERATION_PROFILE', 'drama')
    expect(resolveSeatGenerationProfile('cost')).toBe('drama')
  })

  it('isolates checkout env when a seat profile or stage is pinned', () => {
    expect(shouldIsolateCheckoutEnv()).toBe(false)
    vi.stubEnv('OPENMONTAGE_GENERATION_PROFILE', 'cost')
    expect(shouldIsolateCheckoutEnv()).toBe(true)
    vi.unstubAllEnvs()
    vi.stubEnv('OPENMONTAGE_PIPELINE_STAGE', 'script')
    expect(shouldIsolateCheckoutEnv()).toBe(true)
    expect(resolvePipelineStage()).toBe('script')
  })

  it('hides production skills on the edit seat', () => {
    expect(skillAllowedForStage('openmontage', 'edit')).toBe(false)
    expect(skillAllowedForStage('openmontage', 'script')).toBe(true)
    expect(seatOperatingText('cost', 'edit')).toContain('edit stage')
    expect(seatOperatingText('quality', 'motion')).toContain('motion pipeline stage')
  })
})
