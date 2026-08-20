/**
 * Seat-scoped OpenMontage preferences that an ACP parent (Buzz or otherwise)
 * injects via process env. These must not be written into a shared checkout
 * `.env`, or parallel seats in one channel would clobber each other.
 * @module @deepseek-ai/dsh-openmontage/seat-env
 */

import {
  DEFAULT_GENERATION_PROFILE,
  isGenerationProfile,
  type OpenMontageGenerationProfile,
} from './token-plan-settings.ts'

/** Seat-pinned generation scheme (`auto` / `cost` / `quality` / `drama`). */
export const GENERATION_PROFILE_ENV = 'OPENMONTAGE_GENERATION_PROFILE'
/** Seat-pinned pipeline stage (`script` / `storyboard` / `motion` / `tts` / `edit`). */
export const PIPELINE_STAGE_ENV = 'OPENMONTAGE_PIPELINE_STAGE'
/**
 * When truthy, skip rewriting the checkout `.env`. Keys stay in the process
 * environment the ACP parent already injected.
 */
export const ISOLATE_CHECKOUT_ENV = 'OPENMONTAGE_ISOLATE_CHECKOUT_ENV'

/** Pipeline stages a seat may pin. Empty / unknown means the full pipeline. */
export const PIPELINE_STAGES = ['script', 'storyboard', 'motion', 'tts', 'edit'] as const
/** One pipeline stage id. */
export type OpenMontagePipelineStage = (typeof PIPELINE_STAGES)[number]

/**
 * Whether a string is a known pipeline stage.
 * @param value - candidate stage id.
 * @returns true when `value` is one of {@link PIPELINE_STAGES}.
 */
export function isPipelineStage(value: unknown): value is OpenMontagePipelineStage {
  return typeof value === 'string' && (PIPELINE_STAGES as readonly string[]).includes(value)
}

function envFlag(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase() ?? ''
  return raw === '1' || raw === 'true' || raw === 'yes'
}

/**
 * Generation profile for this process: seat env wins over plugin config.
 * @param configured - plugin `generationProfile`, if any.
 * @returns seat env profile, then configured, else the package default.
 */
export function resolveSeatGenerationProfile(
  configured?: OpenMontageGenerationProfile,
): OpenMontageGenerationProfile {
  const fromEnv = process.env[GENERATION_PROFILE_ENV]?.trim()
  if (isGenerationProfile(fromEnv)) return fromEnv
  return isGenerationProfile(configured) ? configured : DEFAULT_GENERATION_PROFILE
}

/**
 * Pipeline stage for this process, or `undefined` when the seat runs the full pipeline.
 * @returns seat-pinned stage from env, or `undefined` for the full pipeline.
 */
export function resolvePipelineStage(): OpenMontagePipelineStage | undefined {
  const fromEnv = process.env[PIPELINE_STAGE_ENV]?.trim()
  return isPipelineStage(fromEnv) ? fromEnv : undefined
}

/**
 * True when this process must not rewrite a shared OpenMontage checkout `.env`.
 *
 * A seat env profile or stage is enough: those pins belong to the agent, not
 * the checkout. An explicit isolate flag covers ACP parents that only set that.
 * @returns true when isolate flag, seat profile, or seat stage is set.
 */
export function shouldIsolateCheckoutEnv(): boolean {
  if (envFlag(ISOLATE_CHECKOUT_ENV)) return true
  const profile = process.env[GENERATION_PROFILE_ENV]?.trim()
  if (isGenerationProfile(profile)) return true
  return resolvePipelineStage() !== undefined
}

/**
 * Operating text appended after the shared OpenMontage section so the model
 * sees the seat pin without reading a checkout `.env`.
 * @param profile - resolved generation profile.
 * @param stage - optional pipeline stage.
 * @returns one or more sentences of seat-scoped operating guidance.
 */
export function seatOperatingText(
  profile: OpenMontageGenerationProfile,
  stage?: OpenMontagePipelineStage,
): string {
  const lines = [
    `This ACP seat pins generation profile ${profile}. Do not change it and do not write it into the checkout .env.`,
  ]
  if (stage === 'edit') {
    lines.push(
      'This seat owns only the edit stage. Do not run OpenMontage production stages. If an OpenCut skill is registered, use it; otherwise assemble from the clip/audio paths in the user message.',
    )
  } else if (stage !== undefined) {
    lines.push(
      `This seat owns only the ${stage} pipeline stage. Read that stage director under skills/pipelines/ and stop. Do not execute later stages.`,
    )
  }
  return lines.join(' ')
}

/**
 * Whether a bundled gateway skill should load for this seat's stage.
 * @param skillName - bundled skill id.
 * @param stage - optional pipeline stage.
 * @returns false for edit-only seats; otherwise true for the OpenMontage gateway skills.
 */
export function skillAllowedForStage(skillName: string, stage?: OpenMontagePipelineStage): boolean {
  if (stage === 'edit') return false
  return skillName === 'openmontage' || skillName === 'openmontage-onboarding'
}
