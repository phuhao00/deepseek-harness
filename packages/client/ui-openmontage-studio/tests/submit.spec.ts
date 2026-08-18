import { describe, expect, it, vi } from 'vitest'
import { submitStudioProduction, type StudioSubmitDeps } from '../src/client/submit.ts'
import { formatStudioPrompt } from '../src/client/studio-prompt.ts'

function deps(): { calls: string[]; deps: StudioSubmitDeps } {
  const calls: string[] = []
  return {
    calls,
    deps: {
      mutateSettings: vi.fn(async () => { calls.push('mutate') }),
      createWorkspace: vi.fn(async (path) => {
        calls.push(`create:${path}`)
        return { workspaceId: 'ws-new' as never, path }
      }),
      connectWorkspace: vi.fn(async (workspaceId) => {
        calls.push(`connect:${workspaceId}`)
        return 'session-1' as never
      }),
      openSession: vi.fn((sessionId) => { calls.push(`open:${sessionId}`) }),
      prompt: vi.fn(async (sessionId, text) => { calls.push(`prompt:${sessionId}:${text.split('\n')[0]}`) }),
    },
  }
}

describe('submitStudioProduction', () => {
  it('mutates settings, connects an existing workspace, opens, then prompts', async () => {
    const { calls, deps: verbs } = deps()
    const text = await submitStudioProduction({
      durationSeconds: 30,
      resolution: '1080p',
      generationProfile: 'cost',
      expectedRevision: 4,
      workspace: { workspaceId: 'ws-1' as never, path: '/projects/film' },
      outputPath: '/exports/film',
      brief: '海边日落宣传片',
      wikiPages: [{ title: 'pipeline' }],
      pastedExcerpt: '',
    }, verbs)
    expect(verbs.mutateSettings).toHaveBeenCalledWith(30, '1080p', '', 'cost', 4)
    expect(verbs.createWorkspace).not.toHaveBeenCalled()
    expect(verbs.connectWorkspace).toHaveBeenCalledWith('ws-1')
    expect(verbs.openSession).toHaveBeenCalledWith('session-1')
    expect(verbs.prompt).toHaveBeenCalledWith('session-1', text)
    expect(text).toBe(formatStudioPrompt({
      durationSeconds: 30,
      resolution: '1080p',
      generationProfile: 'cost',
      workspacePath: '/projects/film',
      outputPath: '/exports/film',
      brief: '海边日落宣传片',
      wikiPages: [{ title: 'pipeline' }],
      pastedExcerpt: '',
    }))
    expect(calls).toEqual(['mutate', 'connect:ws-1', 'open:session-1', 'prompt:session-1:制作一条视频。'])
  })

  it('creates a workspace from a picked directory before connecting', async () => {
    const { calls, deps: verbs } = deps()
    await submitStudioProduction({
      durationSeconds: 15,
      resolution: '720p',
      generationProfile: 'auto',
      expectedRevision: 0,
      workspace: { createPath: '/tmp/new-film' },
      outputPath: '/tmp/new-film',
      brief: '片',
      wikiPages: [],
      pastedExcerpt: '',
    }, verbs)
    expect(calls[1]).toBe('create:/tmp/new-film')
    expect(calls[2]).toBe('connect:ws-new')
  })
})
