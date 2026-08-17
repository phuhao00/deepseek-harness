import { describe, expect, it } from 'vitest'
import type { LlmModelInfo } from '@deepseek-ai/dsh-llm'
import {
  declaresImageInput,
  pickImageCapableModel,
  providerBrandPrefix,
} from '../src/image-capable-route.ts'

function entry(id: string, input: readonly string[], provider = 'qwen-token-plan-cn'): LlmModelInfo {
  return { provider, id, name: id, inputModalities: input }
}

describe('image-capable-route', () => {
  it('treats a missing modality list as not declaring image input', () => {
    expect(declaresImageInput({})).toBe(false)
    expect(declaresImageInput({ inputModalities: ['text'] })).toBe(false)
    expect(declaresImageInput({ inputModalities: ['text', 'image'] })).toBe(true)
  })

  it('uses the first dash-separated provider segment as the brand prefix', () => {
    expect(providerBrandPrefix('qwen-token-plan-cn')).toBe('qwen')
    expect(providerBrandPrefix('deepseek')).toBe('deepseek')
  })

  it('keeps the current model when it already declares image input', () => {
    const models = [
      entry('deepseek-v4-pro', ['text']),
      entry('qwen3.6-flash', ['text', 'image']),
      entry('qwen3.8-max-preview', ['text', 'image']),
    ]
    expect(pickImageCapableModel('qwen-token-plan-cn', 'qwen3.8-max-preview', models)?.id)
      .toBe('qwen3.8-max-preview')
  })

  it('prefers a same-brand vision sibling over another vendor on the route', () => {
    const models = [
      entry('deepseek-v4-pro', ['text']),
      entry('kimi-k2.5', ['text', 'image']),
      entry('qwen3.6-flash', ['text', 'image']),
      entry('qwen3.8-max-preview', ['text', 'image']),
    ]
    expect(pickImageCapableModel('qwen-token-plan-cn', 'deepseek-v4-pro', models)?.id)
      .toBe('qwen3.6-flash')
  })

  it('uses a configured same-provider vision id before brand ranking', () => {
    const models = [
      entry('deepseek-v4-pro', ['text']),
      entry('kimi-k2.5', ['text', 'image']),
      entry('qwen3.6-flash', ['text', 'image']),
    ]
    expect(pickImageCapableModel('qwen-token-plan-cn', 'deepseek-v4-pro', models, 'kimi-k2.5')?.id)
      .toBe('kimi-k2.5')
  })

  it('ignores a preferred id that is not a vision sibling on the route', () => {
    const models = [
      entry('deepseek-v4-pro', ['text']),
      entry('qwen3.6-flash', ['text', 'image']),
    ]
    expect(pickImageCapableModel('qwen-token-plan-cn', 'deepseek-v4-pro', models, 'missing')?.id)
      .toBe('qwen3.6-flash')
  })

  it('returns undefined when the provider advertises no image-capable model', () => {
    expect(pickImageCapableModel('qwen-token-plan-cn', 'deepseek-v4-pro', [
      entry('deepseek-v4-pro', ['text']),
    ])).toBeUndefined()
  })
})
