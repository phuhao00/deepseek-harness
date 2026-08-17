// @vitest-environment jsdom
/** Generation binding fields: hide, page-owned key write, custom ref, unset. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import {
  CUSTOM_KEY_REF,
  PAGE_GENERATION_KEY_REF,
  TokenPlanGenerationFields,
  generationGatewayOps,
  generationKeySources,
  isGenerationKeyRef,
  tokenPlanDescribeRefs,
  tokenPlanFieldOp,
  tokenPlanKeyRefForWrite,
} from '../src/client/TokenPlanGenerationFields.tsx'
import { GENERATION_GATEWAY_REFS, OPENROUTER_ORIGIN } from '../src/client/generation-gateways.ts'
import { CUSTOM_GENERATION_ID, TOKEN_PLAN_VIDEO_MODELS } from '../src/client/generation-catalog.ts'
import { ModelsSettingsStore } from '../src/client/store.ts'
import type { ProviderRow } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const BASE = {
  tokenPlanKeyEnv: '',
  tokenPlanBaseUrl: '',
  tokenPlanVideoModel: 'happyhorse-1.1-t2v',
  tokenPlanImageModel: 'wan2.7-image',
  tokenPlanTtsModel: 'qwen-audio-3.0-tts-plus',
  tokenPlanTtsVoice: 'longanhuan_v3.6',
}

function namespace(user?: Partial<typeof BASE>): SettingsNamespaceView {
  return {
    ns: 'openmontage',
    schema: {},
    value: { ...BASE, ...user },
    base: BASE,
    ...user === undefined ? {} : { user },
    applies: 'live',
    secrets: [],
    revision: 4,
  }
}

function credentialsApi(overrides?: {
  set?: ReturnType<typeof vi.fn>
  mutate?: ReturnType<typeof vi.fn>
  pageWritable?: boolean
}) {
  const set = overrides?.set ?? vi.fn(() => Promise.resolve({ result: { ok: true as const, value: {} } }))
  const mutate = overrides?.mutate ?? vi.fn(() => Promise.resolve({
    result: { ok: true as const, value: namespace({ tokenPlanKeyEnv: PAGE_GENERATION_KEY_REF }) },
  }))
  return {
    settings: { mutate },
    credentials: {
      describe: () => Promise.resolve({
        result: {
          ok: true as const,
          value: {
            credentials: {
              [PAGE_GENERATION_KEY_REF]: {
                configured: false,
                writable: overrides?.pageWritable !== false,
              },
              QWEN_TOKEN_PLAN_CN_API_KEY: {
                configured: true,
                source: 'env',
                writable: false,
                hint: 'sk-s••••xxxx',
              },
            },
          },
        },
      }),
      set,
    },
  }
}

describe('tokenPlanFieldOp', () => {
  it('unsets an empty or base-equal draft', () => {
    expect(tokenPlanFieldOp('', BASE.tokenPlanVideoModel, 'tokenPlanVideoModel'))
      .toEqual({ op: 'unset', path: ['tokenPlanVideoModel'] })
  })
})

describe('generation key helpers', () => {
  it('writes the selected writable ref and falls back when that ref is locked', () => {
    expect(tokenPlanKeyRefForWrite('')).toBe(PAGE_GENERATION_KEY_REF)
    expect(tokenPlanKeyRefForWrite('OPENROUTER_API_KEY')).toBe('OPENROUTER_API_KEY')
    expect(tokenPlanKeyRefForWrite('QWEN_TOKEN_PLAN_CN_API_KEY', false)).toBe(PAGE_GENERATION_KEY_REF)
    expect(tokenPlanDescribeRefs(BASE)[0]).toBe(PAGE_GENERATION_KEY_REF)
    expect(tokenPlanDescribeRefs({ tokenPlanKeyEnv: 'OPENROUTER_API_KEY' }, ['OPENAI_API_KEY'])).toEqual([
      'OPENROUTER_API_KEY',
      ...GENERATION_GATEWAY_REFS.filter(ref => ref !== 'OPENROUTER_API_KEY'),
    ])
    expect(isGenerationKeyRef('OPENROUTER_API_KEY')).toBe(true)
    expect(isGenerationKeyRef('bad-name')).toBe(false)
  })

  it('lists named gateways before extra configured provider refs', () => {
    const rows = [{
      entry: { provider: 'gemini', displayName: 'Gemini', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'gemini'], active: true },
      configured: true,
      removable: true,
      apiKeyEnv: 'GEMINI_API_KEY',
      credential: undefined,
    }] as ProviderRow[]
    expect(generationKeySources(rows, key => en[key]).map(row => row.ref)).toEqual([
      ...GENERATION_GATEWAY_REFS,
      'GEMINI_API_KEY',
    ])
  })

  it('sets OpenRouter origin together with the credential ref', () => {
    expect(generationGatewayOps('OPENROUTER_API_KEY', '', '')).toEqual([
      { op: 'set', path: ['tokenPlanKeyEnv'], value: 'OPENROUTER_API_KEY' },
      { op: 'set', path: ['tokenPlanBaseUrl'], value: OPENROUTER_ORIGIN },
    ])
    expect(generationGatewayOps('OPENAI_API_KEY', '', '')).toEqual([
      { op: 'set', path: ['tokenPlanKeyEnv'], value: 'OPENAI_API_KEY' },
    ])
  })
})

describe('TokenPlanGenerationFields', () => {
  it('hides when the host does not expose openmontage', () => {
    const { container } = render(
      <TokenPlanGenerationFields
        namespace={undefined}
        rows={[]}
        api={credentialsApi() as never}
        controller={new ModelsSettingsStore({} as never)}
        readOnly={false}
        t={key => en[key]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('keeps the key field editable when a launch-environment Qwen key is read-only', async () => {
    render(
      <TokenPlanGenerationFields
        namespace={namespace()}
        rows={[]}
        api={credentialsApi() as never}
        controller={{ load: vi.fn(() => Promise.resolve()) } as unknown as ModelsSettingsStore}
        readOnly={false}
        t={key => en[key]}
      />,
    )
    expect(await screen.findByText(en.tokenPlanKeyLoaded
      .replace('{ref}', 'QWEN_TOKEN_PLAN_CN_API_KEY')
      .replace('{source}', en.tokenPlanSourceEnv)
      .replace('{hint}', 'sk-s••••xxxx'))).toBeTruthy()
    expect(screen.getByLabelText<HTMLInputElement>(en.tokenPlanApiKey).disabled).toBe(false)
    expect(screen.getByLabelText<HTMLInputElement>(en.tokenPlanApiKey).placeholder).toBe(
      en.keyStoredHint.replace('{hint}', 'sk-s••••xxxx'),
    )
    expect(screen.getByLabelText<HTMLSelectElement>(en.tokenPlanKeyEnv).value).toBe('')
    expect(screen.getByDisplayValue(en.tokenPlanKeyEnvAutoUsing.replace('{ref}', 'QWEN_TOKEN_PLAN_CN_API_KEY'))).toBeTruthy()
  })

  it('writes a typed key to the page-owned ref and pins that ref', async () => {
    const set = vi.fn(() => Promise.resolve({ result: { ok: true as const, value: {} } }))
    const mutate = vi.fn(() => Promise.resolve({
      result: { ok: true as const, value: namespace({ tokenPlanKeyEnv: PAGE_GENERATION_KEY_REF }) },
    }))
    const load = vi.fn(() => Promise.resolve())
    const api = credentialsApi({ set, mutate })
    render(
      <TokenPlanGenerationFields
        namespace={namespace()}
        rows={[]}
        api={api as never}
        controller={{ load } as unknown as ModelsSettingsStore}
        readOnly={false}
        t={key => en[key]}
      />,
    )
    const key = screen.getByLabelText<HTMLInputElement>(en.tokenPlanApiKey)
    fireEvent.change(key, { target: { value: 'sk-or-from-page' } })
    fireEvent.blur(key)
    await waitFor(() => { expect(set).toHaveBeenCalledTimes(1) })
    expect(set.mock.calls[0]?.[0]).toEqual({
      ref: PAGE_GENERATION_KEY_REF,
      value: 'sk-or-from-page',
    })
    expect(mutate.mock.calls[0]?.[0]).toEqual({
      ns: 'openmontage',
      ops: [{ op: 'set', path: ['tokenPlanKeyEnv'], value: PAGE_GENERATION_KEY_REF }],
      expectedRevision: 4,
    })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('writes a typed key to a selected writable provider ref', async () => {
    const set = vi.fn(() => Promise.resolve({ result: { ok: true as const, value: {} } }))
    const mutate = vi.fn()
    const api = credentialsApi({ set, mutate })
    render(
      <TokenPlanGenerationFields
        namespace={namespace({ tokenPlanKeyEnv: 'OPENROUTER_API_KEY' })}
        rows={[]}
        api={api as never}
        controller={{ load: vi.fn(() => Promise.resolve()) } as unknown as ModelsSettingsStore}
        readOnly={false}
        t={key => en[key]}
      />,
    )
    const key = screen.getByLabelText<HTMLInputElement>(en.tokenPlanApiKey)
    fireEvent.change(key, { target: { value: 'sk-or-from-page' } })
    fireEvent.blur(key)
    await waitFor(() => { expect(set).toHaveBeenCalledTimes(1) })
    expect(set.mock.calls[0]?.[0]).toEqual({
      ref: 'OPENROUTER_API_KEY',
      value: 'sk-or-from-page',
    })
    expect(mutate).not.toHaveBeenCalled()
  })

  it('selecting OpenRouter writes the ref and origin together', async () => {
    const mutate = vi.fn(() => Promise.resolve({
      result: { ok: true as const, value: namespace({ tokenPlanKeyEnv: 'OPENROUTER_API_KEY' }) },
    }))
    const api = credentialsApi({ mutate })
    render(
      <TokenPlanGenerationFields
        namespace={namespace()}
        rows={[]}
        api={api as never}
        controller={{ load: vi.fn(() => Promise.resolve()) } as unknown as ModelsSettingsStore}
        readOnly={false}
        t={key => en[key]}
      />,
    )
    fireEvent.change(screen.getByLabelText(en.tokenPlanKeyEnv), { target: { value: 'OPENROUTER_API_KEY' } })
    await waitFor(() => { expect(mutate).toHaveBeenCalledTimes(1) })
    expect(mutate.mock.calls[0]?.[0]).toEqual({
      ns: 'openmontage',
      ops: [
        { op: 'set', path: ['tokenPlanKeyEnv'], value: 'OPENROUTER_API_KEY' },
        { op: 'set', path: ['tokenPlanBaseUrl'], value: OPENROUTER_ORIGIN },
      ],
      expectedRevision: 4,
    })
  })

  it('accepts a custom OpenRouter credential name', async () => {
    const mutate = vi.fn(() => Promise.resolve({
      result: { ok: true as const, value: namespace({ tokenPlanKeyEnv: 'OPENROUTER_API_KEY' }) },
    }))
    const api = credentialsApi({ mutate })
    render(
      <TokenPlanGenerationFields
        namespace={namespace()}
        rows={[]}
        api={api as never}
        controller={{ load: vi.fn(() => Promise.resolve()) } as unknown as ModelsSettingsStore}
        readOnly={false}
        t={key => en[key]}
      />,
    )
    fireEvent.change(screen.getByLabelText(en.tokenPlanKeyEnv), { target: { value: CUSTOM_KEY_REF } })
    const custom = await screen.findByLabelText<HTMLInputElement>(en.tokenPlanKeyEnvCustomName)
    fireEvent.change(custom, { target: { value: 'OPENROUTER_API_KEY' } })
    fireEvent.blur(custom)
    await waitFor(() => { expect(mutate).toHaveBeenCalledTimes(1) })
    expect(mutate.mock.calls[0]?.[0]).toEqual({
      ns: 'openmontage',
      ops: [{ op: 'set', path: ['tokenPlanKeyEnv'], value: 'OPENROUTER_API_KEY' }],
      expectedRevision: 4,
    })
  })

  it('lists Token Plan video ids and commits a catalog choice', async () => {
    const mutate = vi.fn(() => Promise.resolve({
      result: { ok: true as const, value: namespace({ tokenPlanVideoModel: 'wan2.7-t2v' }) },
    }))
    const api = credentialsApi({ mutate })
    render(
      <TokenPlanGenerationFields
        namespace={namespace()}
        rows={[]}
        api={api as never}
        controller={{ load: vi.fn(() => Promise.resolve()) } as unknown as ModelsSettingsStore}
        readOnly={false}
        t={key => en[key]}
      />,
    )
    const video = screen.getByLabelText<HTMLSelectElement>(en.tokenPlanVideoModel)
    expect(TOKEN_PLAN_VIDEO_MODELS.map(choice => choice.id).every(id =>
      [...video.options].some(option => option.value === id),
    )).toBe(true)
    fireEvent.change(video, { target: { value: 'wan2.7-t2v' } })
    await waitFor(() => { expect(mutate).toHaveBeenCalledTimes(1) })
    expect(mutate.mock.calls[0]?.[0]).toEqual({
      ns: 'openmontage',
      ops: [{ op: 'set', path: ['tokenPlanVideoModel'], value: 'wan2.7-t2v' }],
      expectedRevision: 4,
    })
  })

  it('unsets a cleared custom speech model', async () => {
    const mutate = vi.fn(() => Promise.resolve({
      result: { ok: true as const, value: namespace() },
    }))
    const api = credentialsApi({ mutate })
    render(
      <TokenPlanGenerationFields
        namespace={namespace({ tokenPlanTtsModel: 'qwen-audio-custom' })}
        rows={[]}
        api={api as never}
        controller={{ load: vi.fn(() => Promise.resolve()) } as unknown as ModelsSettingsStore}
        readOnly={false}
        t={key => en[key]}
      />,
    )
    expect(screen.getByLabelText<HTMLSelectElement>(en.tokenPlanTtsModel).value).toBe(CUSTOM_GENERATION_ID)
    const speech = screen.getByLabelText<HTMLInputElement>(en.tokenPlanModelCustomName)
    fireEvent.change(speech, { target: { value: '' } })
    fireEvent.blur(speech)
    await waitFor(() => { expect(mutate).toHaveBeenCalledTimes(1) })
    expect(mutate.mock.calls[0]?.[0]).toEqual({
      ns: 'openmontage',
      ops: [{ op: 'unset', path: ['tokenPlanTtsModel'] }],
      expectedRevision: 4,
    })
  })
})
