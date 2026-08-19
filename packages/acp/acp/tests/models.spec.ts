/**
 * Session model catalog advertised on ACP session/new for Buzz/Ussop discovery.
 */

import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { LlmModelInfo } from '@deepseek-ai/dsh-llm'
import {
  buildSessionModelCatalog,
  catalogOrEmpty,
  selectCatalogModel,
} from '../src/models.ts'

function ctxWithLlm(llm: {
  listProviders: () => { id: string; name: string }[]
  listModels: (provider: string) => Promise<LlmModelInfo[]>
} | undefined): Pick<Context, 'get'> {
  return {
    get(key: string) {
      return key === 'llm' ? llm : undefined
    },
  } as Pick<Context, 'get'>
}

const sonnet: LlmModelInfo = { provider: 'mock', id: 'sonnet', name: 'Sonnet' }
const opus: LlmModelInfo = { provider: 'mock', id: 'opus', name: 'Opus', description: 'largest' }

describe('catalogOrEmpty', () => {
  it('returns the catalog when the lookup finishes', async () => {
    await expect(catalogOrEmpty(Promise.resolve([sonnet]), 50)).resolves.toEqual([sonnet])
  })

  it('returns an empty list when the lookup throws', async () => {
    await expect(catalogOrEmpty(Promise.reject(new Error('nope')), 50)).resolves.toEqual([])
  })

  it('returns an empty list when the lookup exceeds the budget', async () => {
    await expect(catalogOrEmpty(new Promise(() => undefined), 20)).resolves.toEqual([])
  })
})

describe('buildSessionModelCatalog', () => {
  it('is absent when there is no llm and no configured model', async () => {
    await expect(buildSessionModelCatalog(ctxWithLlm(undefined), {})).resolves.toBeUndefined()
  })

  it('advertises the configured model when the llm service is missing', async () => {
    const catalog = await buildSessionModelCatalog(ctxWithLlm(undefined), {
      model: 'deepseek-v4-pro',
    })
    expect(catalog?.models.currentModelId).toBe('deepseek-v4-pro')
    expect(catalog?.models.availableModels).toEqual([
      { modelId: 'deepseek-v4-pro', name: 'deepseek-v4-pro' },
    ])
    expect(catalog?.configOptions).toEqual([expect.objectContaining({
      type: 'select',
      id: 'model',
      configId: 'model',
      category: 'model',
      currentValue: 'deepseek-v4-pro',
      options: [{
        value: 'deepseek-v4-pro',
        name: 'deepseek-v4-pro',
        displayName: 'deepseek-v4-pro',
      }],
    })])
  })

  it('keeps the current selection in adapter order when it is already listed', async () => {
    const llm = {
      listProviders: () => [{ id: 'mock', name: 'Mock' }],
      listModels: async () => [sonnet, opus],
    }
    const catalog = await buildSessionModelCatalog(ctxWithLlm(llm), {
      provider: 'mock',
      model: 'sonnet',
    })
    expect(catalog?.models.availableModels.map(model => model.modelId)).toEqual(['sonnet', 'opus'])
    expect(catalog?.models.currentModelId).toBe('sonnet')
  })

  it('lists adapter models and keeps the current selection first when missing', async () => {
    const llm = {
      listProviders: () => [{ id: 'mock', name: 'Mock' }],
      listModels: async () => [sonnet, opus],
    }
    const catalog = await buildSessionModelCatalog(ctxWithLlm(llm), {
      provider: 'mock',
      model: 'deepseek-v4-pro',
    })
    expect(catalog?.models.currentModelId).toBe('deepseek-v4-pro')
    expect(catalog?.models.availableModels.map(model => model.modelId)).toEqual([
      'deepseek-v4-pro',
      'sonnet',
      'opus',
    ])
    expect(catalog?.models.availableModels[2]).toEqual({
      modelId: 'opus',
      name: 'Opus',
      description: 'largest',
    })
  })

  it('uses the first registered provider when selection omits one', async () => {
    const llm = {
      listProviders: () => [{ id: 'mock', name: 'Mock' }],
      listModels: async (provider: string) => provider === 'mock' ? [sonnet] : [],
    }
    const catalog = await buildSessionModelCatalog(ctxWithLlm(llm), {})
    expect(catalog?.models).toEqual({
      currentModelId: 'sonnet',
      availableModels: [{ modelId: 'sonnet', name: 'Sonnet' }],
    })
  })

  it('falls back to the configured model when listModels fails', async () => {
    const llm = {
      listProviders: () => [{ id: 'mock', name: 'Mock' }],
      listModels: () => Promise.reject(new Error('catalog down')),
    }
    const catalog = await buildSessionModelCatalog(ctxWithLlm(llm), { provider: 'mock', model: 'kept' })
    expect(catalog?.models.availableModels).toEqual([{ modelId: 'kept', name: 'kept' }])
  })

  it('is absent when no provider can be resolved', async () => {
    const llm = {
      listProviders: () => [],
      listModels: async () => [sonnet],
    }
    await expect(buildSessionModelCatalog(ctxWithLlm(llm), {})).resolves.toBeUndefined()
  })

  it('falls back to the configured model when listModels exceeds the budget', async () => {
    const llm = {
      listProviders: () => [{ id: 'mock', name: 'Mock' }],
      listModels: () => new Promise<LlmModelInfo[]>(() => undefined),
    }
    const catalog = await buildSessionModelCatalog(
      ctxWithLlm(llm),
      { provider: 'mock', model: 'kept' },
      20,
    )
    expect(catalog?.models.availableModels).toEqual([{ modelId: 'kept', name: 'kept' }])
  })

  it('uses the first listed model when the selection model is blank', async () => {
    const llm = {
      listProviders: () => [{ id: 'mock', name: 'Mock' }],
      listModels: async () => [sonnet],
    }
    const catalog = await buildSessionModelCatalog(ctxWithLlm(llm), {
      provider: 'mock',
      model: '   ',
    })
    expect(catalog?.models.currentModelId).toBe('sonnet')
  })

  it('is absent when the adapter catalog and selection are both empty', async () => {
    const llm = {
      listProviders: () => [{ id: 'mock', name: 'Mock' }],
      listModels: async () => [],
    }
    await expect(buildSessionModelCatalog(ctxWithLlm(llm), { provider: 'mock' })).resolves.toBeUndefined()
  })
})

describe('selectCatalogModel', () => {
  it('updates the current selection when the id is listed', async () => {
    const catalog = await buildSessionModelCatalog(ctxWithLlm({
      listProviders: () => [{ id: 'mock', name: 'Mock' }],
      listModels: async () => [sonnet, opus],
    }), { provider: 'mock', model: 'sonnet' })
    expect(catalog).toBeDefined()
    const selected = selectCatalogModel(catalog!, 'opus')
    expect(selected?.models.currentModelId).toBe('opus')
    expect(selected?.configOptions).toEqual([expect.objectContaining({
      category: 'model',
      currentValue: 'opus',
    })])
    expect(catalog?.models.currentModelId).toBe('sonnet')
  })

  it('is absent when the id is not listed', async () => {
    const catalog = await buildSessionModelCatalog(ctxWithLlm({
      listProviders: () => [{ id: 'mock', name: 'Mock' }],
      listModels: async () => [sonnet],
    }), { provider: 'mock', model: 'sonnet' })
    expect(selectCatalogModel(catalog!, 'opus')).toBeUndefined()
  })
})
