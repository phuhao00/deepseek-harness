import { describe, expect, it } from 'vitest'
import { createStudioStore } from '../src/client/stores.ts'

describe('createStudioStore', () => {
  it('opens and closes the overlay', () => {
    const store = createStudioStore().create()
    expect(store.getSnapshot()).toEqual({ open: false })
    store.actions.open()
    expect(store.getSnapshot()).toEqual({ open: true })
    store.actions.close()
    expect(store.getSnapshot()).toEqual({ open: false })
  })
})
