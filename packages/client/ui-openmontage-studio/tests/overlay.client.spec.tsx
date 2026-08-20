// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { StudioOverlay, type StudioOverlayInjected, type StudioSettingsSnapshot } from '../src/client/StudioOverlay.tsx'
import { createStudioStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'
import type { WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'

afterEach(cleanup)

const t = makeTranslate(zh)

const workspace: WorkspaceView = {
  workspaceId: 'ws-1' as never,
  path: '/projects/film',
  title: 'film',
  sessionIds: [],
  createdAt: '0',
  updatedAt: '0',
}

function emptySessions() {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }))
}

function workspacesHook(items: readonly WorkspaceView[] = [workspace]) {
  return bindSnapshotSelector(createSnapshotStore<WorkspaceListState>({
    items: [...items], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  }))
}

function listing(path: string, names: readonly string[]) {
  return { path, entries: names.map(name => ({ name, path: `${path}/${name}` })) }
}

function injected(overrides: Partial<StudioOverlayInjected> = {}): StudioOverlayInjected {
  return {
    describeStudio: vi.fn(async () => ({
      mounted: true, durationSeconds: 30, resolution: '1080p' as const, upscaleTo: undefined, generationProfile: undefined, revision: 3,
    })),
    mutateSettings: vi.fn(async () => {}),
    pickDirectory: vi.fn(async () => null),
    listDirectory: vi.fn(async path => ({ path, entries: [] })),
    createWorkspace: vi.fn(async path => ({ workspaceId: 'ws-new' as never, path })),
    connectWorkspace: vi.fn(async () => 'session-1' as never),
    openSession: vi.fn(),
    prompt: vi.fn(async () => {}),
    ...overrides,
  }
}

function mount(options: {
  open?: boolean
  items?: readonly WorkspaceView[]
  injected?: StudioOverlayInjected
} = {}) {
  const store = createStudioStore().create()
  if (options.open !== false) store.actions.open()
  const verbs = options.injected ?? injected()
  render(<StudioOverlay
    useSessions={emptySessions()}
    useWorkspaces={workspacesHook(options.items)}
    useStore={bindSnapshotSelector(store)}
    actions={store.actions}
    t={t}
    {...verbs}
  />)
  return { store, verbs }
}

describe('StudioOverlay', () => {
  it('renders nothing while closed', () => {
    const { store } = mount({ open: false })
    expect(screen.queryByRole('region', { name: '视频制作' })).toBeNull()
    expect(store.getSnapshot()).toEqual({ open: false })
  })

  it('closes from the close button and Escape', () => {
    const first = mount()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(first.store.getSnapshot()).toEqual({ open: false })
    cleanup()
    const second = mount()
    fireEvent.keyDown(document, { key: 'Enter' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(second.store.getSnapshot()).toEqual({ open: false })
  })

  it('rejects an empty brief, missing duration, missing resolution, and missing workspace', async () => {
    const verbs = injected({
      describeStudio: vi.fn(async () => ({
        mounted: true, durationSeconds: undefined, resolution: undefined, upscaleTo: undefined, generationProfile: 'auto' as const, revision: 0,
      })),
    })
    mount({ items: [], injected: verbs })
    await waitFor(() => {
      expect(verbs.describeStudio).toHaveBeenCalled()
    })
    fireEvent.click(screen.getByText('开始制作'))
    expect(screen.getByRole('alert').textContent).toBe('请填写简报。')
    fireEvent.change(screen.getByPlaceholderText('主题、要点、参考画面或旁白。'), { target: { value: '片' } })
    fireEvent.click(screen.getByText('开始制作'))
    expect(screen.getByRole('alert').textContent).toBe('请输入正数秒数。')
    fireEvent.click(screen.getByText('30'))
    fireEvent.click(screen.getByText('开始制作'))
    expect(screen.getByRole('alert').textContent).toBe('请选择清晰度。')
    fireEvent.click(screen.getByText('1080p'))
    fireEvent.click(screen.getByText('开始制作'))
    expect(screen.getByRole('alert').textContent).toBe('请选择工作区或目录。')
  })

  it('loads settings defaults and submits an existing workspace', async () => {
    const verbs = injected({
      listDirectory: vi.fn(async (path) => {
        if (path === '/projects/film') return listing(path, ['openwiki'])
        if (path === '/projects/film/openwiki') return listing(path, ['pipeline'])
        return { path, entries: [] }
      }),
    })
    mount({ injected: verbs })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '30' }).getAttribute('aria-pressed')).toBe('true')
    })
    fireEvent.change(screen.getByPlaceholderText('主题、要点、参考画面或旁白。'), { target: { value: '海边日落' } })
    fireEvent.click(screen.getByRole('button', { name: '极致性价比' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    await waitFor(() => {
      expect(screen.getByText('pipeline')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByPlaceholderText('Goldfish 或其他 wiki 的摘录。'), { target: { value: '摘录' } })
    fireEvent.click(screen.getByText('开始制作'))
    await waitFor(() => {
      expect(verbs.mutateSettings).toHaveBeenCalledWith(30, '1080p', '', 'cost', 3)
    })
    expect(verbs.connectWorkspace).toHaveBeenCalledWith('ws-1')
    expect(verbs.prompt).toHaveBeenCalled()
    const text = (verbs.prompt as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string
    expect(text).toContain('工作区目录：/projects/film。')
    expect(text).toContain('输出目录：/projects/film。')
    expect(text).toContain('生成方案：极致性价比。')
  })

  it('shows the workspace path and lets the user pick a different output directory', async () => {
    const pickDirectory = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('/exports/renders')
    const verbs = injected({ pickDirectory })
    mount({ injected: verbs })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '30' }).getAttribute('aria-pressed')).toBe('true')
    })
    fireEvent.change(screen.getByPlaceholderText('主题、要点、参考画面或旁白。'), { target: { value: '片' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    await waitFor(() => {
      expect(screen.getByText('工作区路径: /projects/film')).toBeTruthy()
      expect(screen.getByText('与工作区相同')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '选择输出目录' }))
    await waitFor(() => {
      expect(pickDirectory).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByText('与工作区相同')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '选择输出目录' }))
    await waitFor(() => {
      expect(screen.getByText('/exports/renders')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '使用工作区目录' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '使用工作区目录' }).hasAttribute('disabled')).toBe(true)
      expect(screen.getByText('与工作区相同')).toBeTruthy()
    })
    pickDirectory.mockResolvedValueOnce('/exports/final')
    fireEvent.click(screen.getByRole('button', { name: '选择输出目录' }))
    await waitFor(() => {
      expect(screen.getByText('/exports/final')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('开始制作'))
    await waitFor(() => {
      expect(verbs.prompt).toHaveBeenCalled()
    })
    const text = (verbs.prompt as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string
    expect(text).toContain('工作区目录：/projects/film。')
    expect(text).toContain('输出目录：/exports/final。')
  })

  it('clears a synced output path when the workspace selection is cleared', async () => {
    const verbs = injected()
    mount({ injected: verbs })
    await waitFor(() => {
      expect(verbs.describeStudio).toHaveBeenCalled()
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    await waitFor(() => {
      expect(screen.getByText('工作区路径: /projects/film')).toBeTruthy()
      expect(screen.getByText('与工作区相同')).toBeTruthy()
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    await waitFor(() => {
      expect(screen.getByText('先选择工作区，或单独选择输出目录。')).toBeTruthy()
    })
  })

  it('creates a workspace from a picked directory and ignores a cancelled pick', async () => {
    const pickDirectory = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('/tmp/new-film')
    const verbs = injected({ pickDirectory })
    mount({ items: [], injected: verbs })
    await waitFor(() => {
      expect(verbs.describeStudio).toHaveBeenCalled()
    })
    fireEvent.click(screen.getByRole('button', { name: '选择目录并创建' }))
    await waitFor(() => {
      expect(pickDirectory).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByText(/新目录/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '选择目录并创建' }))
    await waitFor(() => {
      expect(screen.getByText(/新目录（提交时创建）: \/tmp\/new-film/)).toBeTruthy()
    })
    fireEvent.change(screen.getByPlaceholderText('主题、要点、参考画面或旁白。'), { target: { value: '片' } })
    fireEvent.click(screen.getByText('开始制作'))
    await waitFor(() => {
      expect(verbs.createWorkspace).toHaveBeenCalledWith('/tmp/new-film')
    })
  })

  it('surfaces describe and submit failures, including non-Error rejections', async () => {
    const first = injected({
      describeStudio: vi.fn(async () => {
        throw new Error('settings down')
      }),
    })
    mount({ injected: first })
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('settings down')
    })
    cleanup()
    const second = injected({
      describeStudio: vi.fn(async () => Promise.reject('nope')),
    })
    mount({ injected: second })
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('nope')
    })
    cleanup()
    const third = injected({
      describeStudio: vi.fn(async () => ({
        mounted: false, durationSeconds: undefined, resolution: undefined, upscaleTo: undefined, generationProfile: 'auto' as const, revision: 0,
      })),
    })
    mount({ injected: third })
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('无法开始制作')
    })
    cleanup()
    const fourth = injected({
      prompt: vi.fn(async () => { throw new Error('queue full') }),
    })
    mount({ injected: fourth })
    await waitFor(() => {
      expect(fourth.describeStudio).toHaveBeenCalled()
    })
    fireEvent.change(screen.getByPlaceholderText('主题、要点、参考画面或旁白。'), { target: { value: '片' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    fireEvent.click(screen.getByText('开始制作'))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('queue full')
    })
    cleanup()
    const fifth = injected({
      prompt: vi.fn(async () => Promise.reject('blocked')),
    })
    mount({ injected: fifth })
    await waitFor(() => {
      expect(fifth.describeStudio).toHaveBeenCalled()
    })
    fireEvent.change(screen.getByPlaceholderText('主题、要点、参考画面或旁白。'), { target: { value: '片' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    fireEvent.click(screen.getByText('开始制作'))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('无法开始制作')
    })
  })

  it('applies a custom duration, ignores non-finite input, and refuses Infinity from describe', async () => {
    mount({
      injected: injected({
        describeStudio: vi.fn(async () => ({
          mounted: true, durationSeconds: 45, resolution: '4k' as const, upscaleTo: undefined, generationProfile: 'auto' as const, revision: 1,
        })),
      }),
    })
    await waitFor(() => {
      expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('45')
    })
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: '15' }))
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: '720p' }))
    cleanup()
    mount({
      injected: injected({
        describeStudio: vi.fn(async () => ({
          mounted: true, durationSeconds: Number.POSITIVE_INFINITY, resolution: '1080p' as const, upscaleTo: undefined, generationProfile: 'auto' as const, revision: 0,
        })),
      }),
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1080p' }).getAttribute('aria-pressed')).toBe('true')
    })
    fireEvent.change(screen.getByPlaceholderText('主题、要点、参考画面或旁白。'), { target: { value: '片' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    fireEvent.click(screen.getByText('开始制作'))
    expect(screen.getByRole('alert').textContent).toBe('请输入正数秒数。')
  })

  it('ignores describe results after unmount', async () => {
    let resolveDescribe!: (value: {
      mounted: boolean
      durationSeconds: number | undefined
      resolution: '1080p'
      upscaleTo: undefined
      generationProfile: 'auto'
      revision: number
    }) => void
    const verbs = injected({
      describeStudio: vi.fn(() => new Promise<StudioSettingsSnapshot>((resolve) => {
        resolveDescribe = resolve
      })),
    })
    mount({ injected: verbs })
    cleanup()
    act(() => {
      resolveDescribe({
        mounted: true, durationSeconds: 30, resolution: '1080p', upscaleTo: undefined, generationProfile: 'auto' as const, revision: 1,
      })
    })
    expect(screen.queryByRole('region', { name: '视频制作' })).toBeNull()
  })

  it('submits 480p generation with an upscale target', async () => {
    const verbs = injected({
      describeStudio: vi.fn(async () => ({
        mounted: true,
        durationSeconds: 30,
        resolution: '480p' as const,
        upscaleTo: '1080p' as const,
        generationProfile: 'cost' as const,
        revision: 2,
      })),
    })
    mount({ injected: verbs })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '480p' }).getAttribute('aria-pressed')).toBe('true')
    })
    const upscalePressed = screen.getAllByRole('button', { name: '1080p' })
      .filter(button => button.getAttribute('aria-pressed') === 'true')
    expect(upscalePressed).toHaveLength(1)
    fireEvent.change(screen.getByPlaceholderText('主题、要点、参考画面或旁白。'), { target: { value: '片' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    fireEvent.click(screen.getByText('开始制作'))
    await waitFor(() => {
      expect(verbs.mutateSettings).toHaveBeenCalledWith(30, '480p', '1080p', 'cost', 2)
    })
    const text = (verbs.prompt as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string
    expect(text).toContain('清晰度：480p。超分到：1080p。')
    expect(text).toContain('生成方案：极致性价比。')
  })

  it('clears an upscale target when resolution rises above it, and lets the user pick again', async () => {
    const verbs = injected({
      describeStudio: vi.fn(async () => ({
        mounted: true,
        durationSeconds: 30,
        resolution: '480p' as const,
        upscaleTo: '720p' as const,
        generationProfile: 'auto' as const,
        revision: 1,
      })),
    })
    mount({ injected: verbs })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '480p' }).getAttribute('aria-pressed')).toBe('true')
    })
    fireEvent.click(screen.getAllByRole('button', { name: '4k' })[0]!)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '不超分' }).getAttribute('aria-pressed')).toBe('true')
    })
    fireEvent.click(screen.getByRole('button', { name: '480p' }))
    fireEvent.click(screen.getAllByRole('button', { name: '1080p' })[1]!)
    expect(screen.getAllByRole('button', { name: '1080p' })
      .some(button => button.getAttribute('aria-pressed') === 'true')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '不超分' }))
    expect(screen.getByRole('button', { name: '不超分' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('ignores describe failures after unmount', async () => {
    let rejectDescribe!: (reason: unknown) => void
    const verbs = injected({
      describeStudio: vi.fn(() => new Promise<StudioSettingsSnapshot>((_, reject) => {
        rejectDescribe = reject
      })),
    })
    mount({ injected: verbs })
    cleanup()
    act(() => {
      rejectDescribe(new Error('gone'))
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('ignores a wiki listing that resolves after the workspace is cleared', async () => {
    let resolveList!: (value: { path: string; entries: { name: string; path: string }[] }) => void
    const listDirectory = vi.fn((path: string) => new Promise<{ path: string; entries: { name: string; path: string }[] }>((resolve) => {
      resolveList = resolve
      void path
    }))
    const verbs = injected({ listDirectory })
    mount({ injected: verbs })
    await waitFor(() => {
      expect(verbs.describeStudio).toHaveBeenCalled()
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    act(() => {
      resolveList({ path: '/projects/film', entries: [] })
    })
    expect(screen.queryByText('openwiki')).toBeNull()
  })

  it('swallows a wiki walk that rejects after abort', async () => {
    let resolveList!: (value: { path: string; entries: { name: string; path: string }[] }) => void
    const listDirectory = vi.fn((path: string) => new Promise<{ path: string; entries: { name: string; path: string }[] }>((resolve) => {
      resolveList = resolve
      void path
    }))
    const verbs = injected({ listDirectory })
    mount({ injected: verbs })
    await waitFor(() => {
      expect(verbs.describeStudio).toHaveBeenCalled()
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    act(() => {
      resolveList(listing('/projects/film', ['openwiki']))
    })
    expect(screen.queryByText('openwiki')).toBeNull()
  })

  it('ignores a second submit while the first is in flight', async () => {
    let resolvePrompt!: () => void
    const prompt = vi.fn(() => new Promise<void>((resolve) => { resolvePrompt = resolve }))
    const verbs = injected({ prompt })
    mount({ injected: verbs })
    await waitFor(() => {
      expect(verbs.describeStudio).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByText('30').closest('button')?.getAttribute('aria-pressed')).toBe('true')
    })
    fireEvent.change(screen.getByPlaceholderText('主题、要点、参考画面或旁白。'), { target: { value: '片' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    const submitButton = screen.getByText('开始制作')
    act(() => {
      submitButton.click()
      submitButton.click()
    })
    expect(screen.queryByRole('alert')).toBeNull()
    await waitFor(() => {
      expect(verbs.mutateSettings).toHaveBeenCalledTimes(1)
    })
    expect(prompt).toHaveBeenCalledTimes(1)
    act(() => { resolvePrompt() })
  })

  it('toggles a wiki page off after selecting it', async () => {
    const verbs = injected({
      listDirectory: vi.fn(async (path) => {
        if (path === '/projects/film') return listing(path, ['openwiki'])
        if (path === '/projects/film/openwiki') return listing(path, ['alpha'])
        return { path, entries: [] }
      }),
    })
    mount({ injected: verbs })
    await waitFor(() => {
      expect(verbs.describeStudio).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByText('30').closest('button')?.getAttribute('aria-pressed')).toBe('true')
    })
    fireEvent.change(screen.getByPlaceholderText('主题、要点、参考画面或旁白。'), { target: { value: '片' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    await waitFor(() => {
      expect(screen.getByRole('checkbox')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText('开始制作'))
    await waitFor(() => {
      expect(verbs.prompt).toHaveBeenCalled()
    })
    const text = (verbs.prompt as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string
    expect(text).not.toContain('## alpha')
  })
})
