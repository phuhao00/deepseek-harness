/**
 * Submit the studio form through existing workspace/session verbs.
 * @module @deepseek-ai/dsh-client-ui-openmontage-studio/submit
 */

import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-api-remotes/client'
import {
  formatStudioPrompt,
  type StudioGenerationProfile,
  type StudioPromptInput,
  type StudioResolution,
  type StudioUpscaleTarget,
} from './studio-prompt.ts'

/** One Workspace the studio can target. */
export interface StudioWorkspace {
  /** Registry id. */
  workspaceId: WorkspaceId
  /** Canonical directory path. */
  path: string
}

/** Studio form values after local validation. */
export interface StudioSubmitInput {
  /** Duration in seconds (positive finite). */
  durationSeconds: number
  /** Generation resolution literal. */
  resolution: StudioResolution
  /** Optional upscale target after generation. */
  upscaleTo?: StudioUpscaleTarget
  /** Generation-profile preference. */
  generationProfile: StudioGenerationProfile
  /** Settings revision at the last describe. */
  expectedRevision: number
  /** Existing Workspace, or a path to create. */
  workspace: StudioWorkspace | { createPath: string }
  /** Absolute directory for finished renders. */
  outputPath: string
  /** Topic / brief. */
  brief: string
  /** Selected OpenWiki titles. */
  wikiPages: StudioPromptInput['wikiPages']
  /** Optional pasted excerpt. */
  pastedExcerpt: string
}

/** Host and runtime verbs the submit path calls, in order. */
export interface StudioSubmitDeps {
  /**
   * Persist the chosen duration, resolution, upscale, and profile as the `openmontage` defaults.
   * @param durationSeconds - next default duration.
   * @param resolution - next default generation resolution.
   * @param upscaleTo - next default upscale target, or empty for none.
   * @param generationProfile - next default generation profile.
   * @param expectedRevision - settings revision from the last describe.
   */
  mutateSettings: (
    durationSeconds: number,
    resolution: StudioResolution,
    upscaleTo: StudioUpscaleTarget | '',
    generationProfile: StudioGenerationProfile,
    expectedRevision: number,
  ) => Promise<void>
  /**
   * Register an existing directory as a Workspace.
   * @param path - absolute directory.
   */
  createWorkspace: (path: string) => Promise<StudioWorkspace>
  /**
   * Reuse or create the Workspace's blank session (existing New Session path).
   * @param workspaceId - target Workspace.
   */
  connectWorkspace: (workspaceId: WorkspaceId) => Promise<SessionId>
  /**
   * Select the created session as current.
   * @param sessionId - session to open.
   */
  openSession: (sessionId: SessionId) => void
  /**
   * Send the formatted brief as the first user message.
   * @param sessionId - target session.
   * @param text - model-visible prompt body.
   */
  prompt: (sessionId: SessionId, text: string) => Promise<void>
}

/**
 * Mutate settings, ensure a Workspace, open a session, then prompt.
 * @param input - validated form.
 * @param deps - runtime verbs.
 * @returns the formatted prompt text that was sent.
 */
export async function submitStudioProduction(
  input: StudioSubmitInput,
  deps: StudioSubmitDeps,
): Promise<string> {
  await deps.mutateSettings(
    input.durationSeconds,
    input.resolution,
    input.upscaleTo ?? '',
    input.generationProfile,
    input.expectedRevision,
  )
  const workspace = 'createPath' in input.workspace
    ? await deps.createWorkspace(input.workspace.createPath)
    : input.workspace
  const sessionId = await deps.connectWorkspace(workspace.workspaceId)
  deps.openSession(sessionId)
  const text = formatStudioPrompt({
    durationSeconds: input.durationSeconds,
    resolution: input.resolution,
    ...(input.upscaleTo === undefined ? {} : { upscaleTo: input.upscaleTo }),
    generationProfile: input.generationProfile,
    workspacePath: workspace.path,
    outputPath: input.outputPath,
    brief: input.brief,
    wikiPages: input.wikiPages,
    pastedExcerpt: input.pastedExcerpt,
  })
  await deps.prompt(sessionId, text)
  return text
}
