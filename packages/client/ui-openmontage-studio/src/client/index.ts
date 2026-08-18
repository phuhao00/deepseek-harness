/**
 * Video studio plugin, browser half: a sidebar-foot action and a
 * `shell.page` form that opens a session with a structured brief.
 * Both slots register whenever the layout/sidebar holes exist; the trigger
 * renders nothing until `settings.describe` exposes the `openmontage`
 * namespace. Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle, SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: SlotMap merges for sidebar.footer.action and shell.page.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { StudioFooterAction } from './StudioFooterAction.tsx'
import { StudioOverlay } from './StudioOverlay.tsx'
import type { StudioOverlayInjected, StudioSettingsSnapshot } from './StudioOverlay.tsx'
import { createStudioStore } from './stores.ts'
import { readStudioSettings } from './studio-prompt.ts'
import { en, zh, type StudioKey } from './locales.ts'

export type { StudioKey } from './locales.ts'
export type { StudioOverlayInjected, StudioSettingsSnapshot } from './StudioOverlay.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Video studio page and sidebar-foot action copy. */
    'openmontage.studio': StudioKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'openmontage.studio'
/** Host settings namespace that means OpenMontage is mounted. */
const OPENMONTAGE_NS = 'openmontage'

/** Required services: slots, locale, connection, sessions, workspaces. */
export const inject = ['slots', 'locale', 'connection', 'sessions', 'workspaces']

/**
 * Register dictionaries, then the sidebar action and center page once the
 * layout and sidebar slots exist. Availability still hides the trigger when
 * the Host has no `openmontage` section.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-openmontage-studio: dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const store = createStudioStore()
  let mounted = false
  const listeners = new Set<() => void>()
  const mountedSource: HostObservable<boolean> = {
    getSnapshot: () => mounted,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  const setMounted = (next: boolean): void => {
    if (mounted === next) return
    mounted = next
    for (const listener of listeners) listener()
  }
  const refreshMounted = (): void => {
    void connection.api.settings.describe({}).then((response) => {
      if (!response.result.ok) {
        setMounted(false)
        return
      }
      setMounted(response.result.value.namespaces.some(row => row.ns === OPENMONTAGE_NS))
    }, () => { setMounted(false) })
  }

  const describeStudio = async (): Promise<StudioSettingsSnapshot> => {
    const response = await connection.api.settings.describe({})
    if (!response.result.ok) throw new Error(response.result.error.message)
    const namespace = response.result.value.namespaces.find(row => row.ns === OPENMONTAGE_NS)
    if (namespace === undefined) {
      setMounted(false)
      return {
        mounted: false,
        durationSeconds: undefined,
        resolution: undefined,
        upscaleTo: undefined,
        generationProfile: undefined,
        revision: 0,
      }
    }
    setMounted(true)
    const defaults = readStudioSettings(namespace.value, namespace.revision)
    return { mounted: true, ...defaults }
  }

  const overlayInjected: StudioOverlayInjected = {
    describeStudio,
    mutateSettings: async (durationSeconds, resolution, upscaleTo, generationProfile, expectedRevision) => {
      const response = await connection.api.settings.mutate({
        ns: OPENMONTAGE_NS,
        ops: [
          { op: 'set', path: ['outputDurationSeconds'], value: durationSeconds },
          { op: 'set', path: ['outputResolution'], value: resolution },
          { op: 'set', path: ['outputUpscaleTo'], value: upscaleTo },
          { op: 'set', path: ['generationProfile'], value: generationProfile },
        ],
        expectedRevision,
      })
      if (!response.result.ok) throw new Error(response.result.error.message)
    },
    pickDirectory: () => ctx.workspaces.pickDirectory(),
    listDirectory: async (path, signal) => {
      const listing = await ctx.workspaces.listDirectory(path, signal)
      return { path: listing.path, entries: listing.entries }
    },
    createWorkspace: async (path) => {
      const workspace = await ctx.workspaces.create({ path })
      return { workspaceId: workspace.workspaceId, path: workspace.path }
    },
    connectWorkspace: workspaceId => ctx.workspaces.connectWorkspace(workspaceId),
    openSession: (sessionId) => { ctx.sessions.open(sessionId) },
    prompt: async (sessionId: SessionId, text: string) => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error(`unknown session "${sessionId}"`)
      const result = await session.prompt([{ type: 'text', text }], 'queue')
      if (!result.ok) throw new Error(result.error.message)
    },
  }

  ctx.effect(() => {
    refreshMounted()
    return ctx.on('connection/reset', refreshMounted)
  }, 'ui-openmontage-studio: openmontage namespace')

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'openmontage-studio',
    order: 10,
    locale: NS,
    store,
    inject: (): { hooks: { studioMounted: HostObservable<boolean> } } => ({
      hooks: { studioMounted: mountedSource },
    }),
  }, StudioFooterAction))

  ctx.slots.inject('shell.page', () => ctx.slots.register({
    name: 'shell.page',
    id: 'openmontage-studio',
    order: 20,
    locale: NS,
    store,
    inject: (): StudioOverlayInjected & { hooks: { studioMounted: HostObservable<boolean> } } => ({
      ...overlayInjected,
      hooks: { studioMounted: mountedSource },
    }),
  }, StudioOverlay))
}
