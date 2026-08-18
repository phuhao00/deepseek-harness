/**
 * Sidebar-foot trigger for the video studio overlay.
 */
import clsx from 'clsx'
import { IconPlayOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { createStudioStore } from './stores.ts'
import css from './StudioFooterAction.module.css'

/** Footer action props: sidebar column state, store, locale, mount signal. */
export type StudioFooterActionProps =
  PropsRuntime<'sidebar.footer.action'>
  & PropsStore<ReturnType<typeof createStudioStore>>
  & PropsLocale<'openmontage.studio'>
  & { useStudioMounted: SnapshotSelectorHook<boolean> }

/**
 * Render the sidebar-foot studio trigger.
 * @param props - composed slot props.
 * @returns the trigger button, or null when OpenMontage is not mounted.
 */
export function StudioFooterAction({ wide, t, actions, useStudioMounted }: StudioFooterActionProps) {
  const mounted = useStudioMounted(on => on)
  if (!mounted) return null
  return (
    <button
      type="button"
      className={clsx(css.trigger, !wide && css.rail)}
      aria-haspopup="dialog"
      aria-label={t('action.label')}
      onClick={() => { actions.open() }}
    >
      <IconPlayOutline16 size={wide ? 16 : 18} />
      {wide && <span className={css.label}>{t('action')}</span>}
    </button>
  )
}
