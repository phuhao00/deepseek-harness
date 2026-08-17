import { describe, expect, it } from 'vitest'
import {
  mergeTokenPlanSyncConfig,
  openMontageSettingsEntry,
} from '../src/token-plan-settings.ts'
import {
  DASHSCOPE_CN_BASE_URL,
  DEFAULT_TOKEN_PLAN_VIDEO_MODEL,
  inferTokenPlanBaseUrl,
  OPENROUTER_BASE_URL,
  renderTokenPlanEnvBlock,
  SILICONFLOW_BASE_URL,
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
    expect(next).toContain('TOKEN_PLAN_KEY_ENV=QWEN_TOKEN_PLAN_CN_API_KEY')
    expect(next).toContain('QWEN_TOKEN_PLAN_CN_API_KEY=sk-sp-test')
    expect(next).toContain('TOKEN_PLAN_TTS_MODEL=qwen-audio-3.0-tts-plus')
    expect(next).toContain('TOKEN_PLAN_TTS_VOICE=longanhuan_v3.6')
    expect(next.match(/DASHSCOPE_API_KEY=/g)).toHaveLength(1)
  })

  it('infers public origins for named vendor refs and leaves a relay empty', () => {
    expect(inferTokenPlanBaseUrl('OPENROUTER_API_KEY', 'sk-or-v1-test')).toBe(OPENROUTER_BASE_URL)
    expect(inferTokenPlanBaseUrl('SILICONFLOW_API_KEY', 'sk-sf-test')).toBe(SILICONFLOW_BASE_URL)
    expect(inferTokenPlanBaseUrl('OPENAI_API_KEY', 'sk-relay-test')).toBe('')
    expect(inferTokenPlanBaseUrl('GEMINI_API_KEY', 'sk-gemini-test')).toBe('')
  })

  it('infers China Token Plan only when the page-owned key is sk-sp-', () => {
    expect(inferTokenPlanBaseUrl('OPENMONTAGE_GENERATION_API_KEY', 'sk-sp-plan')).toBe(TOKEN_PLAN_CN_BASE_URL)
    expect(inferTokenPlanBaseUrl('OPENMONTAGE_GENERATION_API_KEY', 'sk-or-v1-test')).toBe('')
  })

  it('mirrors a non-DashScope ref into the checkout so OpenAI-family tools see it', () => {
    const next = renderTokenPlanEnvBlock('', {
      ...binding,
      keyEnv: 'OPENAI_API_KEY',
      apiKey: 'sk-openai-test',
      baseUrl: 'https://openrouter.ai/api/v1',
    })
    expect(next).toContain('TOKEN_PLAN_KEY_ENV=OPENAI_API_KEY')
    expect(next).toContain('OPENAI_API_KEY=sk-openai-test')
    expect(next).toContain('TOKEN_PLAN_BASE_URL=https://openrouter.ai/api/v1')
  })
})

describe('token-plan-settings', () => {
  it('fills omitted generation ids from the plugin defaults', () => {
    expect(openMontageSettingsEntry({})).toMatchObject({
      tokenPlanVideoModel: DEFAULT_TOKEN_PLAN_VIDEO_MODEL,
    })
  })

  it('lets a settings override win over plugin config', () => {
    expect(mergeTokenPlanSyncConfig(
      { tokenPlanKeyEnv: 'QWEN_TOKEN_PLAN_CN_API_KEY', tokenPlanVideoModel: 'happyhorse-1.1-t2v' },
      { tokenPlanVideoModel: 'happyhorse-2.0-t2v', tokenPlanBaseUrl: 'https://token-plan.example' },
    )).toMatchObject({
      tokenPlanKeyEnv: 'QWEN_TOKEN_PLAN_CN_API_KEY',
      tokenPlanBaseUrl: 'https://token-plan.example',
      tokenPlanVideoModel: 'happyhorse-2.0-t2v',
    })
  })
})
