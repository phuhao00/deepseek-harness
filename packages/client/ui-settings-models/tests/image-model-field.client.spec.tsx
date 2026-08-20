// @vitest-environment jsdom
/** Image-model picker: catalog filter, Automatic unset, and a stored preferred id. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelProviderGroup, SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import { ImageModelField, imageModelChoices } from '../src/client/ImageModelField.tsx'
import { ModelsSettingsStore } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const GROUPS: ModelProviderGroup[] = [{
  id: 'qwen-token-plan-cn',
  name: 'Qwen Token Plan CN',
  models: [
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', inputModalities: ['text'] },
    { id: 'qwen3.6-flash', name: 'Qwen3.6 Flash', inputModalities: ['text', 'image'] },
    { id: 'kimi-k2.5', name: 'Kimi K2.5', inputModalities: ['text', 'image'] },
  ],
}]

function namespace(imageModel?: string): SettingsNamespaceView {
  return {
    ns: 'agent-default-model',
    schema: {},
    value: {
      provider: 'qwen-token-plan-cn',
      model: 'deepseek-v4-pro',
      ...imageModel === undefined ? {} : { imageModel },
    },
    applies: 'live',
    secrets: [],
    revision: 3,
  }
}

describe('imageModelChoices', () => {
  it('keeps only catalog rows that declare image input', () => {
    expect(imageModelChoices(GROUPS).map(row => row.id)).toEqual(['qwen3.6-flash', 'kimi-k2.5'])
  })
})

describe('ImageModelField', () => {
  it('hides when the host does not expose agent-default-model', () => {
    const { container } = render(
      <ImageModelField
        namespace={undefined}
        api={{ settings: { mutate: vi.fn() }, llm: { models: vi.fn() } } as never}
        controller={new ModelsSettingsStore({} as never, {} as never, {} as never)}
        readOnly={false}
        t={key => en[key]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('writes the selected vision id and unsets Automatic', async () => {
    const mutate = vi.fn(() => Promise.resolve({
      result: { ok: true as const, value: namespace('kimi-k2.5') },
    }))
    const load = vi.fn(() => Promise.resolve())
    const controller = { load } as unknown as ModelsSettingsStore
    render(
      <ImageModelField
        namespace={namespace()}
        api={{
          settings: { mutate },
          llm: { models: () => Promise.resolve({ result: { ok: true as const, value: { groups: GROUPS, failures: [] } } }) },
        } as never}
        controller={controller}
        readOnly={false}
        t={key => en[key]}
      />,
    )
    const select = await screen.findByLabelText<HTMLSelectElement>(en.imageModel)
    expect(select.value).toBe('')
    expect(screen.getByRole('option', { name: en.imageModelAuto })).toBeTruthy()
    fireEvent.change(select, { target: { value: 'kimi-k2.5' } })
    await waitFor(() => { expect(mutate).toHaveBeenCalledTimes(1) })
    expect(mutate).toHaveBeenCalledWith({
      ns: 'agent-default-model',
      ops: [{ op: 'set', path: ['imageModel'], value: 'kimi-k2.5' }],
      expectedRevision: 3,
    })
    expect(load).toHaveBeenCalledTimes(1)

    cleanup()
    mutate.mockClear()
    render(
      <ImageModelField
        namespace={namespace('kimi-k2.5')}
        api={{
          settings: { mutate },
          llm: { models: () => Promise.resolve({ result: { ok: true as const, value: { groups: GROUPS, failures: [] } } }) },
        } as never}
        controller={controller}
        readOnly={false}
        t={key => en[key]}
      />,
    )
    fireEvent.change(await screen.findByLabelText(en.imageModel), { target: { value: '' } })
    await waitFor(() => { expect(mutate).toHaveBeenCalledTimes(1) })
    expect(mutate).toHaveBeenCalledWith({
      ns: 'agent-default-model',
      ops: [{ op: 'unset', path: ['imageModel'] }],
      expectedRevision: 3,
    })
  })
})
