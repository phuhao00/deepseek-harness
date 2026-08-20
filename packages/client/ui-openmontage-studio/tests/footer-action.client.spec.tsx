// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { StudioFooterAction } from '../src/client/StudioFooterAction.tsx'
import { createStudioStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh)

function emptySessions() {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }))
}

function emptyWorkspaces() {
  return bindSnapshotSelector(createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  }))
}

describe('StudioFooterAction', () => {
  it('renders nothing when OpenMontage is not mounted', () => {
    const store = createStudioStore().create()
    const view = render(<StudioFooterAction
      wide
      useSessions={emptySessions()}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(store)}
      actions={store.actions}
      t={t}
      useStudioMounted={select => select(false)}
    />)
    expect(view.container.innerHTML).toBe('')
  })

  it('opens the overlay from the wide label and the rail icon', () => {
    const store = createStudioStore().create()
    render(<StudioFooterAction
      wide
      useSessions={emptySessions()}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(store)}
      actions={store.actions}
      t={t}
      useStudioMounted={select => select(true)}
    />)
    fireEvent.click(screen.getByRole('button', { name: '打开视频制作工作台' }))
    expect(store.getSnapshot()).toEqual({ open: true })
    cleanup()
    const rail = createStudioStore().create()
    render(<StudioFooterAction
      wide={false}
      useSessions={emptySessions()}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(rail)}
      actions={rail.actions}
      t={t}
      useStudioMounted={select => select(true)}
    />)
    expect(screen.queryByText('视频制作')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '打开视频制作工作台' }))
    expect(rail.getSnapshot()).toEqual({ open: true })
  })
})
