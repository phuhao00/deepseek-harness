/**
 * Studio overlay open state. Availability is decided in apply() before this
 * store is seated; the overlay only needs open/close.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Viewing state for the studio overlay. */
export type StudioViewState = {
  /** Whether the full-screen studio overlay is open. */
  open: boolean
}

type StudioViewActions = {
  open: (draft: StudioViewState) => void
  close: (draft: StudioViewState) => void
}

/**
 * Create the studio overlay viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createStudioStore(): EngineStoreHandle<StudioViewState, StudioViewActions> {
  return defineStore({
    init: (): StudioViewState => ({ open: false }),
    actions: {
      open: (d) => { d.open = true },
      close: (d) => { d.open = false },
    },
  })
}
