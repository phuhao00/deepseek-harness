/**
 * Models-page control for `agent-default-model.imageModel`: the preferred
 * same-provider vision catalog id used when a prompt carries images.
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { IApiClient, ModelProviderGroup, SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import { messageOf } from './store.ts'
import type { ModelsSettingsStore } from './store.ts'
import type { en } from './locales.ts'
import styles from './ModelsSection.module.css'

/** Injected dependencies of {@link ImageModelField}. */
export interface ImageModelFieldProps {
  /** The `agent-default-model` namespace view, when the host exposes it. */
  namespace: SettingsNamespaceView | undefined
  /** Wire faces for catalog reads and the settings write. */
  api: Pick<IApiClient, 'settings' | 'llm'>
  /** Page store refreshed after a successful write. */
  controller: ModelsSettingsStore
  /** Whether the settings document accepts writes. */
  readOnly: boolean
  /** Section copy. */
  t: (key: keyof typeof en) => string
}

/** Stored `imageModel` on a redacted settings value. */
function storedImageModel(value: unknown): string {
  if (typeof value !== 'object' || value === null) return ''
  const imageModel = (value as { imageModel?: unknown }).imageModel
  return typeof imageModel === 'string' ? imageModel : ''
}

/** One selectable vision catalog row. */
export interface ImageModelChoice {
  provider: string
  providerName: string
  id: string
  name: string
}

/**
 * Vision-capable catalog rows from a host `llm.models` snapshot.
 * @param groups - provider groups from the session-independent catalog.
 * @returns rows that declare image input, in catalog order.
 */
export function imageModelChoices(groups: readonly ModelProviderGroup[]): ImageModelChoice[] {
  return groups.flatMap(group => group.models
    .filter(model => model.inputModalities?.includes('image') === true)
    .map(model => ({
      provider: group.id,
      providerName: group.name,
      id: model.id,
      name: model.name,
    })))
}

/**
 * Preferred vision model field. Hidden when the host does not expose
 * `agent-default-model`. An empty selection unsets the field so the host
 * picks a Qwen-branded sibling.
 * @param props - namespace, wire faces, and copy.
 * @returns the field, or nothing when the namespace is absent.
 */
export function ImageModelField(props: ImageModelFieldProps): ReactNode {
  const { namespace, api, controller, readOnly, t } = props
  const [choices, setChoices] = useState<ImageModelChoice[]>([])
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (namespace === undefined) return
    let stale = false
    void api.llm.models({}).then(
      (response) => {
        if (stale) return
        if (!response.result.ok) {
          setFailure(response.result.error.message)
          return
        }
        setChoices(imageModelChoices(response.result.value.groups))
      },
      (error: unknown) => {
        if (!stale) setFailure(messageOf(error))
      },
    )
    return () => { stale = true }
  }, [api.llm, namespace])

  if (namespace === undefined) return null

  const stored = storedImageModel(namespace.value)
  const known = choices.some(choice => choice.id === stored)
  const groups = new Map<string, ImageModelChoice[]>()
  for (const choice of choices) {
    const rows = groups.get(choice.providerName) ?? []
    rows.push(choice)
    groups.set(choice.providerName, rows)
  }

  const onChange = (next: string): void => {
    if (readOnly || busy) return
    setBusy(true)
    setFailure(undefined)
    const ops = next === ''
      ? [{ op: 'unset' as const, path: ['imageModel'] }]
      : [{ op: 'set' as const, path: ['imageModel'], value: next }]
    void api.settings.mutate({
      ns: namespace.ns,
      ops,
      expectedRevision: namespace.revision,
    }).then(
      async (response) => {
        if (!response.result.ok) {
          setFailure(response.result.error.message)
          return
        }
        await controller.load()
      },
      (error: unknown) => { setFailure(messageOf(error)) },
    ).finally(() => { setBusy(false) })
  }

  return (
    <div className={styles['field']}>
      <label className={styles['fieldLabel']} htmlFor="image-model">
        {t('imageModel')}
      </label>
      <p className={styles['advancedHint']}>{t('imageModelHint')}</p>
      <select
        id="image-model"
        className={`${styles['input']} ${styles['selectInput']}`}
        value={stored}
        disabled={readOnly || busy}
        onChange={(event) => { onChange(event.target.value) }}
      >
        <option value="">{t('imageModelAuto')}</option>
        {known || stored === ''
          ? null
          : <option value={stored}>{stored}</option>}
        {[...groups].map(([groupName, rows]) => (
          <optgroup key={groupName} label={groupName}>
            {rows.map(row => (
              <option key={`${row.provider}:${row.id}`} value={row.id}>
                {row.name === row.id ? row.id : `${row.name} (${row.id})`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {failure === undefined ? null : <p className={styles['error']}>{failure}</p>}
    </div>
  )
}
