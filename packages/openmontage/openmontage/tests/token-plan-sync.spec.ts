import { describe, expect, it } from 'vitest'
import {
  DASHSCOPE_CN_BASE_URL,
  inferTokenPlanBaseUrl,
  renderTokenPlanEnvBlock,
  TOKEN_PLAN_CN_BASE_URL,
  TOKEN_PLAN_INTL_BASE_URL,
} from '../src/token-plan-sync.ts'

const binding = {
  keyEnv: 'QWEN_TOKEN_PLAN_CN_API_KEY',
  apiKey: 'sk-sp-test',
  baseUrl: TOKEN_PLAN_CN_BASE_URL,
  videoModel: 'happyhorse-1.1-t2v',
  imageModel: 'wan2.7-image',
  ttsModel: 'qwen-audio-3.0-tts-plus',
  ttsVoice: 'longanhuan_v3.6',
}

describe('token-plan-sync', () => {
  it('uses the Token Plan CN origin for an sk-sp key', () => {
    expect(inferTokenPlanBaseUrl('DASHSCOPE_API_KEY', 'sk-sp-plan')).toBe(TOKEN_PLAN_CN_BASE_URL)
  })

  it('uses the Singapore Token Plan origin for the intl env ref', () => {
    expect(inferTokenPlanBaseUrl('QWEN_TOKEN_PLAN_API_KEY', 'sk-sp-plan')).toBe(TOKEN_PLAN_INTL_BASE_URL)
  })

  it('uses generic DashScope for a non-plan DashScope key', () => {
    expect(inferTokenPlanBaseUrl('DASHSCOPE_API_KEY', 'sk-generic')).toBe(DASHSCOPE_CN_BASE_URL)
  })

  it('rewrites a managed block without dropping unrelated env rows', () => {
    const next = renderTokenPlanEnvBlock('FAL_KEY=\nDASHSCOPE_API_KEY=old\n', binding)
    expect(next).toContain('FAL_KEY=')
    expect(next).toContain('DASHSCOPE_API_KEY=sk-sp-test')
    expect(next).toContain('TOKEN_PLAN_TTS_MODEL=qwen-audio-3.0-tts-plus')
    expect(next).toContain('TOKEN_PLAN_TTS_VOICE=longanhuan_v3.6')
    expect(next.match(/DASHSCOPE_API_KEY=/g)).toHaveLength(1)
  })
})
