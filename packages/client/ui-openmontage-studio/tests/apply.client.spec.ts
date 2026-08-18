import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-openmontage-studio/client'
import type { StudioOverlayInjected } from '@deepseek-ai/dsh-client-ui-openmontage-studio/client'
import { StudioFooterAction } from '../src/client/StudioFooterAction.tsx'
import { StudioOverlay } from '../src/client/StudioOverlay.tsx'

usePinnedBrowserLanguages('zh-CN')

let rpc = 0
function ok<T>(value: T) {
  return { rpcId: `studio-${rpc++}` as never, result: { ok: true as const, value } }
}
function fail(message: string) {
  return { rpcId: `studio-${rpc++}` as never, result: { ok: false as const, error: { code: 'internal', message, details: {} } } }
}

function namespace(value: Record<string, unknown> = { outputDurationSeconds: 30, outputResolution: '1080p' }) {
  return {
    ns: 'openmontage',
    schema: {},
    value,
    base: {},
    user: {},
    applies: 'live' as const,
    secrets: [],
    revision: 7,
  }
}

type HoleName = 'sidebar.footer.action' | 'shell.page'

async function bench(options: {
  namespaces?: unknown[]
  describeOk?: boolean
  describeReject?: boolean
  mutateOk?: boolean
  promptOk?: boolean
  hasSession?: boolean
} = {}) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const describe = vi.fn(async () => {
    if (options.describeReject) throw new Error('describe failed')
    if (options.describeOk === false) return fail('describe denied')
    return ok({
      writable: true,
      hasDocument: false,
      namespaces: options.namespaces ?? [namespace()],
    })
  })
  const mutate = vi.fn(async () => options.mutateOk === false ? fail('mutate denied') : ok(namespace()))
  const pickDirectory = vi.fn(async () => '/picked')
  const listDirectory = vi.fn(async (path: string) => ({ path, entries: [] }))
  const create = vi.fn(async (input: { path: string }) => ({
    workspaceId: 'ws-new' as never,
    path: input.path,
    title: 'new',
    sessionIds: [],
    createdAt: '0',
    updatedAt: '0',
  }))
  const connectWorkspace = vi.fn(async () => 'session-1' as never)
  const open = vi.fn()
  const prompt = vi.fn(async () => options.promptOk === false
    ? { ok: false as const, error: { code: 'internal', message: 'prompt denied', details: {} } }
    : { ok: true as const, value: { accepted: true as const } })
  const binding = vi.fn(() => options.hasSession === false ? undefined : ({ session: { prompt } }))
  ctx.provide('connection', { api: { settings: { describe, mutate } } } as never)
  ctx.provide('workspaces', { pickDirectory, listDirectory, create, connectWorkspace } as never)
  ctx.provide('sessions', { open, binding } as never)
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  return {
    ctx, slots: ctx.get('slots') as SlotRegistry, locale,
    describe, mutate, pickDirectory, listDirectory, create, connectWorkspace, open, prompt, binding,
  }
}

function declare(slots: SlotRegistry, ...names: HoleName[]): () => void {
  const children = Object.fromEntries(names.map(name => [name, { kind: 'list', scope: 'root' }]))
  return slots.register({ name: 'root', children } as never, () => null)
}

describe('ui-openmontage-studio apply', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'sessions', 'workspaces'])
  })

  it('registers the footer action and overlay for declarations before or after apply', async () => {
    const before = await bench()
    declare(before.slots, 'sidebar.footer.action', 'shell.page')
    await before.ctx.plugin({ inject: [...inject], apply }).await()
    expect(before.slots.entries('sidebar.footer.action')[0]!.component).toBe(StudioFooterAction)
    expect(before.slots.entries('shell.page')[0]!.component).toBe(StudioOverlay)
    expect(before.slots.entries('sidebar.footer.action')[0]!.locale).toBe('openmontage.studio')
    expect(before.locale.bind('openmontage.studio')('action')).toBe('视频制作')

    const after = await bench()
    await after.ctx.plugin({ inject: [...inject], apply }).await()
    declare(after.slots, 'sidebar.footer.action', 'shell.page')
    await Promise.resolve()
    expect(after.slots.entries('shell.page')[0]!.component).toBe(StudioOverlay)
  })

  it('reports unmounted until describe exposes the openmontage namespace', async () => {
    const b = await bench({ namespaces: [] })
    declare(b.slots, 'sidebar.footer.action', 'shell.page')
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const footer = (b.slots.entries('sidebar.footer.action')[0]!.inject as () => {
      hooks: { studioMounted: { getSnapshot: () => boolean } }
    })()
    await vi.waitFor(() => {
      expect(footer.hooks.studioMounted.getSnapshot()).toBe(false)
    })
  })

  it('marks mounted after describe lists the openmontage namespace', async () => {
    const b = await bench()
    declare(b.slots, 'sidebar.footer.action', 'shell.page')
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const footer = (b.slots.entries('sidebar.footer.action')[0]!.inject as () => {
      hooks: { studioMounted: { getSnapshot: () => boolean; subscribe: (fn: () => void) => () => void } }
    })()
    const notified = vi.fn()
    const unsubscribe = footer.hooks.studioMounted.subscribe(notified)
    await vi.waitFor(() => {
      expect(footer.hooks.studioMounted.getSnapshot()).toBe(true)
    })
    b.describe.mockResolvedValueOnce(ok({ writable: true, hasDocument: false, namespaces: [] }))
    b.ctx.emit('connection/reset')
    await vi.waitFor(() => {
      expect(footer.hooks.studioMounted.getSnapshot()).toBe(false)
    })
    expect(notified).toHaveBeenCalled()
    unsubscribe()
  })

  it('treats a failed or rejected describe as unmounted and refreshes on connection/reset', async () => {
    const b = await bench({ describeOk: false })
    declare(b.slots, 'sidebar.footer.action', 'shell.page')
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const footer = (b.slots.entries('sidebar.footer.action')[0]!.inject as () => {
      hooks: { studioMounted: { getSnapshot: () => boolean } }
    })()
    await vi.waitFor(() => {
      expect(footer.hooks.studioMounted.getSnapshot()).toBe(false)
    })
    b.describe.mockRejectedValueOnce(new Error('offline'))
    b.ctx.emit('connection/reset')
    await vi.waitFor(() => {
      expect(b.describe.mock.calls.length).toBeGreaterThan(1)
    })
  })

  it('routes overlay inject verbs through settings, workspaces, and sessions', async () => {
    const b = await bench()
    declare(b.slots, 'sidebar.footer.action', 'shell.page')
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const overlay = (b.slots.entries('shell.page')[0]!.inject as unknown as () => StudioOverlayInjected)()
    await expect(overlay.describeStudio()).resolves.toEqual({
      mounted: true,
      durationSeconds: 30,
      resolution: '1080p',
      upscaleTo: undefined,
      generationProfile: undefined,
      revision: 7,
    })
    await overlay.mutateSettings(15, '720p', '1080p', 'cost', 7)
    expect(b.mutate).toHaveBeenCalledWith({
      ns: 'openmontage',
      ops: [
        { op: 'set', path: ['outputDurationSeconds'], value: 15 },
        { op: 'set', path: ['outputResolution'], value: '720p' },
        { op: 'set', path: ['outputUpscaleTo'], value: '1080p' },
        { op: 'set', path: ['generationProfile'], value: 'cost' },
      ],
      expectedRevision: 7,
    })
    await expect(overlay.pickDirectory()).resolves.toBe('/picked')
    await expect(overlay.listDirectory('/ws')).resolves.toEqual({ path: '/ws', entries: [] })
    await expect(overlay.createWorkspace('/tmp/film')).resolves.toEqual({
      workspaceId: 'ws-new',
      path: '/tmp/film',
    })
    await expect(overlay.connectWorkspace('ws-new' as never)).resolves.toBe('session-1')
    overlay.openSession('session-1' as never)
    expect(b.open).toHaveBeenCalledWith('session-1')
    await overlay.prompt('session-1' as never, '制作一条视频。')
    expect(b.prompt).toHaveBeenCalledWith([{ type: 'text', text: '制作一条视频。' }], 'queue')
  })

  it('rejects describe, mutate, and prompt failures', async () => {
    const missing = await bench({ namespaces: [] })
    declare(missing.slots, 'shell.page')
    await missing.ctx.plugin({ inject: [...inject], apply }).await()
    const missingOverlay = (missing.slots.entries('shell.page')[0]!.inject as unknown as () => StudioOverlayInjected)()
    await expect(missingOverlay.describeStudio()).resolves.toMatchObject({ mounted: false })

    const denied = await bench({ describeOk: false, mutateOk: false, promptOk: false })
    declare(denied.slots, 'shell.page')
    await denied.ctx.plugin({ inject: [...inject], apply }).await()
    const overlay = (denied.slots.entries('shell.page')[0]!.inject as unknown as () => StudioOverlayInjected)()
    await expect(overlay.describeStudio()).rejects.toThrow('describe denied')
    await expect(overlay.mutateSettings(15, '720p', '', 'auto', 0)).rejects.toThrow('mutate denied')
    await expect(overlay.prompt('session-1' as never, 'x')).rejects.toThrow('prompt denied')

    const unbound = await bench({ hasSession: false })
    declare(unbound.slots, 'shell.page')
    await unbound.ctx.plugin({ inject: [...inject], apply }).await()
    const unboundOverlay = (unbound.slots.entries('shell.page')[0]!.inject as unknown as () => StudioOverlayInjected)()
    await expect(unboundOverlay.prompt('missing' as never, 'x')).rejects.toThrow('unknown session "missing"')
  })

  it('unregisters every entry on teardown', async () => {
    const b = await bench()
    declare(b.slots, 'sidebar.footer.action', 'shell.page')
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await fiber.dispose()
    expect(b.slots.entries('sidebar.footer.action')).toHaveLength(0)
    expect(b.slots.entries('shell.page')).toHaveLength(0)
  })
})
