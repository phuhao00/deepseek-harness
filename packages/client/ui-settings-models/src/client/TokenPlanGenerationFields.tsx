/**
 * Models-page controls for the `openmontage` generation binding.
 * Hidden when the host does not expose that namespace.
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { CredentialView, IApiClient, SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import { messageOf } from './store.ts'
import type { ModelsSettingsStore, ProviderRow } from './store.ts'
import type { en } from './locales.ts'
import {
  CUSTOM_GENERATION_ID,
  GENERATION_CATALOG,
  generationChoiceLabel,
  generationSelectValue,
  type GenerationCatalogField,
} from './generation-catalog.ts'
import {
  DEEPSEEK_ORIGIN,
  GENERATION_GATEWAY_REFS,
  GENERATION_GATEWAYS,
  OPENROUTER_ORIGIN,
  PAGE_GENERATION_KEY_REF,
  SILICONFLOW_ORIGIN,
  TOKEN_PLAN_CN_ORIGIN,
  TOKEN_PLAN_INTL_ORIGIN,
  generationGatewayOrigin,
} from './generation-gateways.ts'
import styles from './ModelsSection.module.css'

export { PAGE_GENERATION_KEY_REF } from './generation-gateways.ts'

/** Settings keys the Models page can override on `openmontage`. */
export const TOKEN_PLAN_GENERATION_FIELDS = [
  'tokenPlanVideoModel',
  'tokenPlanImageModel',
  'tokenPlanTtsModel',
  'tokenPlanTtsVoice',
] as const

/** One Token Plan generation field key. */
export type TokenPlanGenerationField = (typeof TOKEN_PLAN_GENERATION_FIELDS)[number]

/** Settings keys that select the generation credential and origin. */
export type TokenPlanBindingField = 'tokenPlanKeyEnv' | 'tokenPlanBaseUrl' | TokenPlanGenerationField

/** Select value that reveals the custom credential-name field. */
export const CUSTOM_KEY_REF = '__custom__'

/** POSIX credential reference accepted by `credentials.set`. */
export const CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Inferred origin shown as the base-URL placeholder for a known gateway. */
export const TOKEN_PLAN_BASE_URL_HINT: Record<string, string> = {
  OPENROUTER_API_KEY: OPENROUTER_ORIGIN,
  SILICONFLOW_API_KEY: SILICONFLOW_ORIGIN,
  DEEPSEEK_API_KEY: DEEPSEEK_ORIGIN,
  QWEN_TOKEN_PLAN_CN_API_KEY: TOKEN_PLAN_CN_ORIGIN,
  QWEN_TOKEN_PLAN_API_KEY: TOKEN_PLAN_INTL_ORIGIN,
  DASHSCOPE_API_KEY: TOKEN_PLAN_CN_ORIGIN,
}

/** One credential source the plan select can name. */
export interface GenerationKeySource {
  /** Credential reference. */
  ref: string
  /** Human label. */
  label: string
}

/** Injected dependencies of {@link TokenPlanGenerationFields}. */
export interface TokenPlanGenerationFieldsProps {
  /** The `openmontage` namespace view, when the host exposes it. */
  namespace: SettingsNamespaceView | undefined
  /** Configured provider rows whose keys can be reused. */
  rows: readonly ProviderRow[]
  /** Wire faces for the settings write and the generation credential. */
  api: Pick<IApiClient, 'settings' | 'credentials'>
  /** Page store refreshed after a successful write. */
  controller: ModelsSettingsStore
  /** Whether the settings document accepts writes. */
  readOnly: boolean
  /** Section copy. */
  t: (key: keyof typeof en) => string
}

/** Read a string field from a redacted settings layer. */
export function storedTokenPlanField(value: unknown, key: TokenPlanBindingField): string {
  if (typeof value !== 'object' || value === null) return ''
  const raw = (value as Record<string, unknown>)[key]
  return typeof raw === 'string' ? raw : ''
}

/**
 * Credential ref a typed key stores under.
 * A selected writable ref keeps that name. Automatic, or a launch-environment
 * lock, falls back to the page-owned ref so the field stays editable.
 * @param selectedRef - current `tokenPlanKeyEnv`, empty when Automatic.
 * @param selectedWritable - `credentials.describe` writable flag for that ref.
 * @returns the ref `credentials.set` should receive.
 */
export function tokenPlanKeyRefForWrite(selectedRef: string, selectedWritable?: boolean): string {
  const trimmed = selectedRef.trim()
  if (trimmed !== '' && selectedWritable !== false) return trimmed
  return PAGE_GENERATION_KEY_REF
}

/**
 * Credential refs to describe for the configured/missing status and lock state.
 * Always includes the page-owned ref so a locked Qwen env cannot hide it.
 * Extra refs (configured provider keys) are described so existing keys show up.
 * Named gateways are always described so a stored OpenRouter or vendor key
 * appears as configured even when the select is still Automatic.
 * @param value - resolved `openmontage` section.
 * @param extraRefs - additional POSIX refs to probe, such as provider `apiKeyEnv`.
 * @returns unique refs: explicit, named gateways, then extras.
 */
export function tokenPlanDescribeRefs(value: unknown, extraRefs: readonly string[] = []): string[] {
  const explicit = storedTokenPlanField(value, 'tokenPlanKeyEnv').trim()
  const extras = extraRefs.filter(ref => ref !== '')
  if (explicit !== '') return [...new Set([explicit, ...GENERATION_GATEWAY_REFS, ...extras])]
  return [...new Set([...GENERATION_GATEWAY_REFS, ...extras])]
}

/**
 * Whether `next` is a credential reference `credentials.set` will accept.
 * @param next - trimmed candidate.
 */
export function isGenerationKeyRef(next: string): boolean {
  return CREDENTIAL_REF_PATTERN.test(next)
}

/**
 * Named gateways, then configured provider refs the credential select lists.
 * @param rows - configured provider rows from the Models page.
 * @param t - section copy.
 * @returns unique refs, named gateways first.
 */
export function generationKeySources(
  rows: readonly ProviderRow[],
  t: (key: keyof typeof en) => string,
): GenerationKeySource[] {
  const seen = new Set<string>()
  const sources: GenerationKeySource[] = []
  const add = (ref: string, label: string): void => {
    if (ref === '' || seen.has(ref)) return
    seen.add(ref)
    sources.push({ ref, label })
  }
  for (const gateway of GENERATION_GATEWAYS) {
    add(gateway.ref, t(gateway.labelKey))
  }
  for (const row of rows) {
    if (row.apiKeyEnv === undefined) continue
    add(row.apiKeyEnv, `${row.entry.displayName} (${row.apiKeyEnv})`)
  }
  return sources
}

/**
 * Settings ops that apply a named gateway: the credential ref and, when the
 * gateway owns an origin, that origin in the same mutate.
 * @param ref - selected credential reference, empty for Automatic.
 * @param baseKeyEnv - composition default for `tokenPlanKeyEnv`.
 * @param baseOrigin - composition default for `tokenPlanBaseUrl`.
 * @returns one or two path ops.
 */
export function generationGatewayOps(
  ref: string,
  baseKeyEnv: string,
  baseOrigin: string,
): Array<{ op: 'set'; path: string[]; value: string } | { op: 'unset'; path: string[] }> {
  const ops: Array<{ op: 'set'; path: string[]; value: string } | { op: 'unset'; path: string[] }> = [
    tokenPlanFieldOp(ref, baseKeyEnv, 'tokenPlanKeyEnv'),
  ]
  const origin = generationGatewayOrigin(ref)
  if (origin !== undefined) {
    ops.push(tokenPlanFieldOp(origin, baseOrigin, 'tokenPlanBaseUrl'))
  }
  return ops
}

/**
 * Decide the mutate op for one Token Plan settings field.
 * An empty or base-equal value unsets the user layer so the plugin default returns.
 * @param next - trimmed draft.
 * @param base - composition default shown as the placeholder.
 * @param key - settings field.
 * @returns a set or unset op.
 */
export function tokenPlanFieldOp(
  next: string,
  base: string,
  key: TokenPlanBindingField,
): { op: 'set'; path: string[]; value: string } | { op: 'unset'; path: string[] } {
  if (next === '' || next === base) return { op: 'unset', path: [key] }
  return { op: 'set', path: [key], value: next }
}

/**
 * Generation key, origin, and video / image / speech fields. Hidden when
 * `openmontage` is not exposed. Existing credentials are described; a hint
 * mask shows which key is loaded. Named gateways set the ref and, when known,
 * the origin. Model fields are catalog selects plus a custom id. A typed key
 * stores on the selected writable ref, or on the page-owned ref when Automatic
 * or the selected ref is locked. Empty or default-equal drafts unset the user layer.
 * @param props - namespace, provider rows, wire faces, and copy.
 * @returns the field group, or nothing when the namespace is absent.
 */
export function TokenPlanGenerationFields(props: TokenPlanGenerationFieldsProps): ReactNode {
  const { namespace, rows, api, controller, readOnly, t } = props
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [drafts, setDrafts] = useState<Partial<Record<TokenPlanBindingField, string>>>({})
  const [keyDraft, setKeyDraft] = useState('')
  const [customDraft, setCustomDraft] = useState<string | undefined>(undefined)
  const [customModels, setCustomModels] = useState<Partial<Record<GenerationCatalogField, boolean>>>({})
  const [keyViews, setKeyViews] = useState<Record<string, CredentialView>>({})

  useEffect(() => {
    setDrafts({})
    setKeyDraft('')
    setCustomDraft(undefined)
    setCustomModels({})
    setFailure(undefined)
  }, [namespace?.revision])

  const extraRefs = rows.flatMap(row => row.apiKeyEnv === undefined ? [] : [row.apiKeyEnv])
  const describeRefs = namespace === undefined ? [] : tokenPlanDescribeRefs(namespace.value, extraRefs)
  useEffect(() => {
    if (describeRefs.length === 0) return
    let stale = false
    void api.credentials.describe({ refs: describeRefs }).then(
      (response) => {
        if (stale || !response.result.ok) return
        setKeyViews(response.result.value.credentials)
      },
      () => undefined,
    )
    return () => { stale = true }
  }, [api.credentials, describeRefs.join('\0')])

  if (namespace === undefined) return null

  const sources = generationKeySources(rows, t)
  const knownRefs = new Set(sources.map(source => source.ref))
  const storedRef = storedTokenPlanField(
    drafts.tokenPlanKeyEnv !== undefined ? { tokenPlanKeyEnv: drafts.tokenPlanKeyEnv } : namespace.value,
    'tokenPlanKeyEnv',
  )
  const customMode = customDraft !== undefined || (storedRef !== '' && !knownRefs.has(storedRef))
  const selectValue = customMode ? CUSTOM_KEY_REF : storedRef
  const writeRef = tokenPlanKeyRefForWrite(storedRef, keyViews[storedRef]?.writable)
  const writeView = keyViews[writeRef]
  const keyLocked = writeView?.writable === false
  const activeRef = describeRefs.find(ref => keyViews[ref]?.configured === true)
  const activeView = activeRef === undefined ? undefined : keyViews[activeRef]
  const inferredBase = TOKEN_PLAN_BASE_URL_HINT[storedRef === '' ? writeRef : storedRef] ?? ''

  const commitOps = (
    ops: Array<{ op: 'set'; path: string[]; value: string } | { op: 'unset'; path: string[] }>,
  ): void => {
    if (readOnly || busy) return
    const pending = ops.filter((op) => {
      const key = op.path[0] as TokenPlanBindingField
      const current = storedTokenPlanField(namespace.user, key)
      const alreadyUnset = current === '' && op.op === 'unset'
      const alreadySet = op.op === 'set' && current === op.value
      return !alreadyUnset && !alreadySet
    })
    if (pending.length === 0) return
    setBusy(true)
    setFailure(undefined)
    void api.settings.mutate({
      ns: namespace.ns,
      ops: pending,
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

  const commitField = (key: TokenPlanBindingField, next: string): void => {
    const base = storedTokenPlanField(namespace.base, key)
    commitOps([tokenPlanFieldOp(next.trim(), base, key)])
  }

  const commitGateway = (ref: string): void => {
    commitOps(generationGatewayOps(
      ref,
      storedTokenPlanField(namespace.base, 'tokenPlanKeyEnv'),
      storedTokenPlanField(namespace.base, 'tokenPlanBaseUrl'),
    ))
  }

  const commitKey = (next: string): void => {
    if (readOnly || busy || keyLocked) return
    const trimmed = next.trim()
    if (trimmed === '') return
    setBusy(true)
    setFailure(undefined)
    void api.credentials.set({ ref: writeRef, value: trimmed }).then(
      async (response) => {
        if (!response.result.ok) {
          setFailure(response.result.error.message)
          return
        }
        setKeyDraft('')
        const current = storedTokenPlanField(namespace.user, 'tokenPlanKeyEnv')
        if (writeRef === PAGE_GENERATION_KEY_REF && current !== writeRef) {
          const envOp = tokenPlanFieldOp(writeRef, storedTokenPlanField(namespace.base, 'tokenPlanKeyEnv'), 'tokenPlanKeyEnv')
          const envWrite = await api.settings.mutate({
            ns: namespace.ns,
            ops: [envOp],
            expectedRevision: namespace.revision,
          })
          if (!envWrite.result.ok) {
            setFailure(envWrite.result.error.message)
            return
          }
        }
        await controller.load()
      },
      (error: unknown) => { setFailure(messageOf(error)) },
    ).finally(() => { setBusy(false) })
  }

  const commitCustomRef = (next: string): void => {
    const trimmed = next.trim()
    if (trimmed !== '' && !isGenerationKeyRef(trimmed)) {
      setFailure(t('tokenPlanKeyEnvCustomInvalid'))
      return
    }
    setFailure(undefined)
    commitField('tokenPlanKeyEnv', trimmed)
  }

  const shown = (key: TokenPlanBindingField): string => {
    if (drafts[key] !== undefined) return drafts[key] ?? ''
    const user = storedTokenPlanField(namespace.user, key)
    return user === '' ? storedTokenPlanField(namespace.value, key) : user
  }

  const keyConfigured = writeView?.configured === true || activeView?.configured === true
  const loadedHint = writeView?.hint ?? activeView?.hint
  const keyPlaceholder = keyLocked
    ? t('keyEnvLocked')
    : loadedHint !== undefined
      ? t('keyStoredHint').replace('{hint}', loadedHint)
      : keyConfigured ? t('keyStored') : t('keyPlaceholder')

  const sourceName = (source: string | undefined): string => (
    source === 'env' ? t('tokenPlanSourceEnv') : t('tokenPlanSourceSaved')
  )
  const status = activeRef === undefined
    ? t('tokenPlanActiveMissing')
    : loadedHint === undefined
      ? t('tokenPlanActive')
        .replace('{ref}', activeRef)
        .replace('{source}', sourceName(activeView?.source))
      : t('tokenPlanKeyLoaded')
        .replace('{ref}', activeRef)
        .replace('{source}', sourceName(activeView?.source))
        .replace('{hint}', loadedHint)
  const autoLabel = activeRef === undefined
    ? t('tokenPlanKeyEnvAuto')
    : t('tokenPlanKeyEnvAutoUsing').replace('{ref}', activeRef)

  const sourceLabel = (ref: string, label: string): string => {
    const view = keyViews[ref]
    if (view?.configured !== true) return label
    const configured = `${label} · ${t('credentialConfigured')} (${sourceName(view.source)})`
    return view.hint === undefined ? configured : `${configured} · ${view.hint}`
  }

  return (
    <div className={styles['generationGroup']}>
      <div className={styles['field']}>
        <p className={styles['fieldLabel']}>{t('tokenPlanGeneration')}</p>
        <p className={styles['advancedHint']}>{t('tokenPlanGenerationHint')}</p>
        <p className={styles['advancedHint']} role="status">{status}</p>
      </div>
      <div className={styles['field']}>
        <label className={styles['fieldLabel']} htmlFor="token-plan-key-env">
          {t('tokenPlanKeyEnv')}
        </label>
        <select
          id="token-plan-key-env"
          className={`${styles['input']} ${styles['selectInput']}`}
          value={selectValue}
          disabled={readOnly || busy}
          onChange={(event) => {
            const next = event.target.value
            if (next === CUSTOM_KEY_REF) {
              setCustomDraft(storedRef)
              return
            }
            setCustomDraft(undefined)
            commitGateway(next)
          }}
        >
          <option value="">{autoLabel}</option>
          {sources.map(source => (
            <option key={source.ref} value={source.ref}>{sourceLabel(source.ref, source.label)}</option>
          ))}
          <option value={CUSTOM_KEY_REF}>{t('tokenPlanKeyEnvCustom')}</option>
        </select>
      </div>
      {customMode
        ? (
          <div className={styles['field']}>
            <label className={styles['fieldLabel']} htmlFor="token-plan-key-env-custom">
              {t('tokenPlanKeyEnvCustomName')}
            </label>
            <p className={styles['advancedHint']}>{t('tokenPlanKeyEnvCustomHint')}</p>
            <input
              id="token-plan-key-env-custom"
              className={styles['input']}
              value={customDraft ?? storedRef}
              placeholder="OPENROUTER_API_KEY"
              disabled={readOnly || busy}
              onChange={(event) => { setCustomDraft(event.target.value) }}
              onBlur={(event) => { commitCustomRef(event.target.value) }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
              }}
            />
          </div>
        )
        : null}
      <div className={styles['field']}>
        <label className={styles['fieldLabel']} htmlFor="token-plan-api-key">
          {t('tokenPlanApiKey')}
        </label>
        <input
          id="token-plan-api-key"
          className={styles['input']}
          type="password"
          autoComplete="off"
          value={keyDraft}
          placeholder={keyPlaceholder}
          disabled={readOnly || busy || keyLocked}
          onChange={(event) => { setKeyDraft(event.target.value) }}
          onBlur={(event) => { commitKey(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
          }}
        />
      </div>
      <div className={styles['field']}>
        <label className={styles['fieldLabel']} htmlFor="token-plan-base-url">
          {t('tokenPlanBaseUrl')}
        </label>
        <p className={styles['advancedHint']}>
          {storedRef === 'OPENAI_API_KEY' ? t('tokenPlanBaseUrlRelayHint') : t('tokenPlanBaseUrlHint')}
        </p>
        <input
          id="token-plan-base-url"
          className={styles['input']}
          value={shown('tokenPlanBaseUrl')}
          placeholder={inferredBase}
          disabled={readOnly || busy}
          onChange={(event) => {
            setDrafts(current => ({ ...current, tokenPlanBaseUrl: event.target.value }))
          }}
          onBlur={(event) => { commitField('tokenPlanBaseUrl', event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
          }}
        />
      </div>
      {TOKEN_PLAN_GENERATION_FIELDS.map((key) => {
        const base = storedTokenPlanField(namespace.base, key)
        const current = shown(key)
        const catalog = GENERATION_CATALOG[key]
        const custom = customModels[key] === true || generationSelectValue(key, current) === CUSTOM_GENERATION_ID
        const selectId = `token-plan-${key}`
        const customId = `${selectId}-custom`
        return (
          <div className={styles['field']} key={key}>
            <label className={styles['fieldLabel']} htmlFor={selectId}>
              {t(key)}
            </label>
            <select
              id={selectId}
              className={`${styles['input']} ${styles['selectInput']}`}
              value={custom ? CUSTOM_GENERATION_ID : current}
              disabled={readOnly || busy}
              onChange={(event) => {
                const next = event.target.value
                if (next === CUSTOM_GENERATION_ID) {
                  setCustomModels(state => ({ ...state, [key]: true }))
                  return
                }
                setCustomModels(state => ({ ...state, [key]: false }))
                setDrafts(state => ({ ...state, [key]: next }))
                commitField(key, next)
              }}
            >
              {catalog.map(choice => (
                <option key={choice.id} value={choice.id}>{generationChoiceLabel(choice)}</option>
              ))}
              <option value={CUSTOM_GENERATION_ID}>{t('tokenPlanModelCustom')}</option>
            </select>
            {custom
              ? (
                <input
                  id={customId}
                  className={styles['input']}
                  value={current}
                  placeholder={base}
                  disabled={readOnly || busy}
                  aria-label={t('tokenPlanModelCustomName')}
                  onChange={(event) => {
                    setDrafts(state => ({ ...state, [key]: event.target.value }))
                  }}
                  onBlur={(event) => { commitField(key, event.target.value) }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                  }}
                />
              )
              : null}
          </div>
        )
      })}
      {failure === undefined ? null : <p className={styles['error']}>{failure}</p>}
    </div>
  )
}
