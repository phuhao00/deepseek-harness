/**
 * Center-pane video studio page: brief, duration, resolution, optional
 * upscale, workspace, OpenWiki page names, and a pasted excerpt. Submit
 * creates a session and sends the formatted first user message.
 */
import { useEffect, useId, useRef, useState } from 'react'
import clsx from 'clsx'
import { Button, IconCloseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { createStudioStore } from './stores.ts'
import {
  DURATION_PRESETS,
  STUDIO_GENERATION_PROFILES,
  STUDIO_RESOLUTIONS,
  isValidStudioUpscale,
  type StudioGenerationProfile,
  type StudioResolution,
  type StudioUpscaleTarget,
  upscaleTargetsFor,
} from './studio-prompt.ts'
import { submitStudioProduction, type StudioSubmitDeps, type StudioWorkspace } from './submit.ts'
import { listWorkspaceWikiPages, type WikiPage } from './wiki-catalog.ts'
import css from './StudioOverlay.module.css'

/** Settings snapshot the page loads when it opens. */
export interface StudioSettingsSnapshot {
  /** Whether the host exposes the `openmontage` namespace. */
  mounted: boolean
  /** Parsed duration/resolution/upscale plus revision. */
  durationSeconds: number | undefined
  /** Parsed generation resolution. */
  resolution: StudioResolution | undefined
  /** Parsed upscale target when set. */
  upscaleTo: StudioUpscaleTarget | undefined
  /** Parsed generation profile when set. */
  generationProfile: StudioGenerationProfile | undefined
  /** Settings revision for mutate. */
  revision: number
}

/** Injected host verbs; the page never sees ctx. */
export interface StudioOverlayInjected {
  /**
   * Load the `openmontage` section, or report that it is absent.
   * @returns mounted flag plus defaults.
   */
  describeStudio: () => Promise<StudioSettingsSnapshot>
  /**
   * Persist duration, resolution, upscale, and profile as the section defaults.
   * @param durationSeconds - next default duration.
   * @param resolution - next default generation resolution.
   * @param upscaleTo - next default upscale target, or empty for none.
   * @param generationProfile - next default generation profile.
   * @param expectedRevision - revision from the last describe.
   */
  mutateSettings: StudioSubmitDeps['mutateSettings']
  /**
   * Open the host directory picker.
   * @returns the selected path, or null when cancelled.
   */
  pickDirectory: () => Promise<string | null>
  /**
   * List one directory level for the OpenWiki walk.
   * @param path - absolute directory.
   * @param signal - abort a superseded walk.
   */
  listDirectory: (path: string, signal?: AbortSignal) => Promise<{
    path: string
    entries: readonly { name: string; path: string }[]
  }>
  /**
   * Register an existing directory as a Workspace.
   * @param path - absolute directory.
   */
  createWorkspace: (path: string) => Promise<StudioWorkspace>
  /**
   * Reuse or create the Workspace blank session.
   * @param workspaceId - target Workspace.
   */
  connectWorkspace: StudioSubmitDeps['connectWorkspace']
  /**
   * Select the created session.
   * @param sessionId - session to open.
   */
  openSession: StudioSubmitDeps['openSession']
  /**
   * Send the formatted brief.
   * @param sessionId - target session.
   * @param text - model-visible prompt body.
   */
  prompt: StudioSubmitDeps['prompt']
}

/** Page props: store, locale, inject, and the workspaces list hook. */
export type StudioOverlayProps =
  PropsRuntime<'shell.page'>
  & PropsStore<ReturnType<typeof createStudioStore>>
  & PropsLocale<'openmontage.studio'>
  & StudioOverlayInjected

/**
 * Render the studio center page when the store is open.
 * @param props - composed slot props.
 * @returns the page, or null when closed.
 */
export function StudioOverlay(props: StudioOverlayProps) {
  const { useStore, actions, t, useWorkspaces } = props
  const open = useStore(s => s.open)
  const workspaces = useWorkspaces(s => s.items)
  const close = (): void => { actions.close() }
  if (!open) return null
  return (
    <StudioForm
      workspaces={workspaces}
      t={t}
      onClose={close}
      injected={props}
    />
  )
}

type FormProps = {
  workspaces: readonly WorkspaceView[]
  t: StudioOverlayProps['t']
  onClose: () => void
  injected: StudioOverlayInjected
}

function StudioForm({ workspaces, t, onClose, injected }: FormProps) {
  const titleId = useId()
  const closeButton = useRef<HTMLButtonElement | null>(null)
  const [brief, setBrief] = useState('')
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>(undefined)
  const [customDuration, setCustomDuration] = useState('')
  const [resolution, setResolution] = useState<StudioResolution | undefined>(undefined)
  const [upscaleTo, setUpscaleTo] = useState<StudioUpscaleTarget | undefined>(undefined)
  const [generationProfile, setGenerationProfile] = useState<StudioGenerationProfile>('auto')
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [createPath, setCreatePath] = useState<string>('')
  const [outputPath, setOutputPath] = useState('')
  const [outputCustom, setOutputCustom] = useState(false)
  const [wikiPages, setWikiPages] = useState<WikiPage[]>([])
  const [wikiLoading, setWikiLoading] = useState(false)
  const [selectedSlugs, setSelectedSlugs] = useState<ReadonlySet<string>>(() => new Set())
  const [pastedExcerpt, setPastedExcerpt] = useState('')
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  useEffect(() => {
    closeButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    void injected.describeStudio().then((snapshot) => {
      if (cancelled) return
      if (!snapshot.mounted) {
        setError(t('error.submit'))
        return
      }
      if (snapshot.durationSeconds !== undefined) {
        setDurationSeconds(snapshot.durationSeconds)
        if (!(DURATION_PRESETS as readonly number[]).includes(snapshot.durationSeconds)) {
          setCustomDuration(String(snapshot.durationSeconds))
        }
      }
      if (snapshot.resolution !== undefined) setResolution(snapshot.resolution)
      setUpscaleTo(snapshot.upscaleTo)
      setGenerationProfile(snapshot.generationProfile ?? 'auto')
      setRevision(snapshot.revision)
    }, (reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => { cancelled = true }
  }, [injected.describeStudio, t])

  useEffect(() => {
    if (resolution === undefined || upscaleTo === undefined) return
    if (!isValidStudioUpscale(resolution, upscaleTo)) setUpscaleTo(undefined)
  }, [resolution, upscaleTo])

  const workspacePath = createPath !== ''
    ? createPath
    : workspaces.find(item => item.workspaceId === workspaceId)?.path

  useEffect(() => {
    if (workspacePath === undefined) {
      setOutputPath('')
      return
    }
    if (!outputCustom) setOutputPath(workspacePath)
  }, [workspacePath, outputCustom])

  useEffect(() => {
    if (workspacePath === undefined) {
      setWikiPages([])
      setWikiLoading(false)
      return
    }
    const controller = new AbortController()
    setWikiLoading(true)
    void listWorkspaceWikiPages(injected.listDirectory, workspacePath, controller.signal)
      .then((pages) => {
        if (controller.signal.aborted) return
        setWikiPages(pages)
        setWikiLoading(false)
      }, (reason: unknown) => {
        // throwIfAborted after this effect's cleanup superseded the walk.
        void reason
      })
    return () => { controller.abort() }
  }, [injected.listDirectory, workspacePath])

  const durationPreset = durationSeconds !== undefined
    && (DURATION_PRESETS as readonly number[]).includes(durationSeconds)
  const upscaleOptions = resolution === undefined ? [] : upscaleTargetsFor(resolution)

  const submit = (): void => {
    if (busyRef.current) return
    const briefText = brief.trim()
    if (briefText === '') {
      setError(t('error.brief'))
      return
    }
    if (durationSeconds === undefined || !(durationSeconds > 0) || !Number.isFinite(durationSeconds)) {
      setError(t('error.duration'))
      return
    }
    if (resolution === undefined) {
      setError(t('error.resolution'))
      return
    }
    const workspace = createPath !== ''
      ? { createPath }
      : workspaces.find(item => item.workspaceId === workspaceId)
    if (workspace === undefined) {
      setError(t('error.workspace'))
      return
    }
    const fallbackPath = 'createPath' in workspace ? workspace.createPath : workspace.path
    const resolvedOutput = outputPath.trim() !== '' ? outputPath.trim() : fallbackPath
    busyRef.current = true
    setBusy(true)
    setError(undefined)
    const selected = wikiPages.filter(page => selectedSlugs.has(page.slug))
    void submitStudioProduction({
      durationSeconds,
      resolution,
      ...(upscaleTo === undefined ? {} : { upscaleTo }),
      generationProfile,
      expectedRevision: revision,
      workspace: 'createPath' in workspace
        ? workspace
        : { workspaceId: workspace.workspaceId, path: workspace.path },
      outputPath: resolvedOutput,
      brief: briefText,
      wikiPages: selected.map(page => ({ title: page.title })),
      pastedExcerpt,
    }, injected).then(
      () => { onClose() },
      (reason: unknown) => {
        setError(reason instanceof Error ? reason.message : t('error.submit'))
        busyRef.current = false
        setBusy(false)
      },
    )
  }

  return (
    <div className={css.page} role="region" aria-labelledby={titleId}>
      <div className={css.header}>
        <h1 id={titleId} className={css.title}>{t('title')}</h1>
        <button ref={closeButton} type="button" className={css.close} onClick={onClose}>
          <IconCloseOutline16 size={14} />
          <span className={css.hiddenLabel}>{t('close')}</span>
        </button>
      </div>
      <div className={css.body}>
        <label className={css.field}>
          <span className={css.label}>{t('brief')}</span>
          <textarea
            className={css.textarea}
            value={brief}
            placeholder={t('brief.placeholder')}
            rows={5}
            onChange={(event) => { setBrief(event.target.value) }}
          />
        </label>
        <fieldset className={css.field}>
          <legend className={css.label}>{t('profile')}</legend>
          <p className={css.hint}>{t('profile.hint')}</p>
          <div className={css.chips}>
            {STUDIO_GENERATION_PROFILES.map(value => (
              <button
                key={value}
                type="button"
                className={clsx(css.chip, generationProfile === value && css.chipActive)}
                aria-pressed={generationProfile === value}
                onClick={() => { setGenerationProfile(value) }}
              >
                {t(`profile.${value}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={css.field}>
          <legend className={css.label}>{t('duration')}</legend>
          <div className={css.chips}>
            {DURATION_PRESETS.map(preset => (
              <button
                key={preset}
                type="button"
                className={clsx(css.chip, durationSeconds === preset && css.chipActive)}
                aria-pressed={durationSeconds === preset}
                onClick={() => {
                  setDurationSeconds(preset)
                  setCustomDuration('')
                }}
              >
                {String(preset)}
              </button>
            ))}
            <label className={css.customDuration}>
              <span>{t('duration.custom')}</span>
              <input
                type="number"
                min={1}
                className={css.number}
                value={durationPreset ? '' : customDuration}
                onChange={(event) => {
                  setCustomDuration(event.target.value)
                  const next = Number(event.target.value)
                  if (Number.isFinite(next) && next > 0) setDurationSeconds(next)
                }}
              />
            </label>
          </div>
        </fieldset>
        <fieldset className={css.field}>
          <legend className={css.label}>{t('resolution')}</legend>
          <div className={css.chips}>
            {STUDIO_RESOLUTIONS.map(value => (
              <button
                key={value}
                type="button"
                className={clsx(css.chip, resolution === value && css.chipActive)}
                aria-pressed={resolution === value}
                onClick={() => { setResolution(value) }}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={css.field}>
          <legend className={css.label}>{t('upscale')}</legend>
          <p className={css.hint}>{t('upscale.hint')}</p>
          <div className={css.chips}>
            <button
              type="button"
              className={clsx(css.chip, upscaleTo === undefined && css.chipActive)}
              aria-pressed={upscaleTo === undefined}
              onClick={() => { setUpscaleTo(undefined) }}
            >
              {t('upscale.none')}
            </button>
            {upscaleOptions.map(value => (
              <button
                key={value}
                type="button"
                className={clsx(css.chip, upscaleTo === value && css.chipActive)}
                aria-pressed={upscaleTo === value}
                onClick={() => { setUpscaleTo(value) }}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
        <label className={css.field}>
          <span className={css.label}>{t('workspace')}</span>
          <select
            className={css.select}
            value={createPath !== '' ? '' : workspaceId}
            onChange={(event) => {
              setWorkspaceId(event.target.value as WorkspaceId | '')
              setCreatePath('')
              setOutputCustom(false)
              setSelectedSlugs(new Set())
            }}
          >
            <option value="">{t('workspace.placeholder')}</option>
            {workspaces.map(item => (
              <option key={item.workspaceId} value={item.workspaceId}>{item.title}</option>
            ))}
          </select>
          {createPath !== ''
            ? <span className={css.hint}>{t('workspace.new')}: {createPath}</span>
            : workspacePath !== undefined
              ? <span className={css.hint}>{t('workspace.path')}: {workspacePath}</span>
              : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void injected.pickDirectory().then((path) => {
                if (path === null) return
                setCreatePath(path)
                setWorkspaceId('')
                setOutputCustom(false)
                setSelectedSlugs(new Set())
              })
            }}
          >
            {t('workspace.pick')}
          </Button>
        </label>
        <fieldset className={css.field}>
          <legend className={css.label}>{t('output')}</legend>
          <p className={css.hint}>{t('output.hint')}</p>
          {outputPath !== ''
            ? <span className={css.hint}>{outputPath}</span>
            : <span className={css.hint}>{t('output.empty')}</span>}
          <div className={css.chips}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void injected.pickDirectory().then((path) => {
                  if (path === null) return
                  setOutputPath(path)
                  setOutputCustom(true)
                })
              }}
            >
              {t('output.pick')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={workspacePath === undefined || !outputCustom}
              onClick={() => {
                setOutputCustom(false)
                setOutputPath(workspacePath ?? '')
              }}
            >
              {t('output.reset')}
            </Button>
          </div>
        </fieldset>
        <fieldset className={css.field}>
          <legend className={css.label}>{t('wiki')}</legend>
          {wikiLoading && <p className={css.hint}>{t('wiki.loading')}</p>}
          {!wikiLoading && wikiPages.length === 0 && <p className={css.hint}>{t('wiki.empty')}</p>}
          {wikiPages.map(page => (
            <label key={page.slug} className={css.check}>
              <input
                type="checkbox"
                checked={selectedSlugs.has(page.slug)}
                onChange={() => {
                  setSelectedSlugs((current) => {
                    const next = new Set(current)
                    if (next.has(page.slug)) next.delete(page.slug)
                    else next.add(page.slug)
                    return next
                  })
                }}
              />
              <span>{page.slug}</span>
            </label>
          ))}
        </fieldset>
        <label className={css.field}>
          <span className={css.label}>{t('paste')}</span>
          <textarea
            className={css.textarea}
            value={pastedExcerpt}
            placeholder={t('paste.placeholder')}
            rows={4}
            onChange={(event) => { setPastedExcerpt(event.target.value) }}
          />
        </label>
        {error !== undefined && <p className={css.error} role="alert">{error}</p>}
      </div>
      <div className={css.footer}>
        <Button variant="primary" disabled={busy} onClick={submit}>{t('submit')}</Button>
      </div>
    </div>
  )
}
