/**
 * Named generation gateways: OpenRouter, OpenAI-compatible relays,
 * domestic vendors, and Qwen Token Plan. Selecting one sets the credential
 * ref and, when known, the origin.
 */

/** One named gateway the credential select can apply. */
export interface GenerationGateway {
  /** POSIX credential reference. */
  ref: string
  /** Origin to store, or `undefined` to leave the current origin. */
  origin?: string
  /** Locale key for the option label. */
  labelKey: 'tokenPlanKeyEnvPage' | 'tokenPlanGatewayOpenrouter' | 'tokenPlanGatewayRelay'
    | 'tokenPlanGatewaySiliconflow' | 'tokenPlanGatewayDeepseek' | 'tokenPlanKeyEnvCn'
    | 'tokenPlanKeyEnvIntl' | 'tokenPlanKeyEnvDashscope'
}

/** OpenRouter chat-completions origin. */
export const OPENROUTER_ORIGIN = 'https://openrouter.ai/api/v1'
/** SiliconFlow OpenAI-compatible origin. */
export const SILICONFLOW_ORIGIN = 'https://api.siliconflow.cn/v1'
/** DeepSeek official origin. */
export const DEEPSEEK_ORIGIN = 'https://api.deepseek.com'
/** Beijing Token Plan origin. */
export const TOKEN_PLAN_CN_ORIGIN = 'https://token-plan.cn-beijing.maas.aliyuncs.com'
/** Singapore Token Plan origin. */
export const TOKEN_PLAN_INTL_ORIGIN = 'https://token-plan.ap-southeast-1.maas.aliyuncs.com'

/** Page-owned writable ref. */
export const PAGE_GENERATION_KEY_REF = 'OPENMONTAGE_GENERATION_API_KEY'

/**
 * Gateways offered before any Models-page provider row.
 * OpenAI-compatible relays reuse `OPENAI_API_KEY` and leave origin
 * for the operator to fill.
 */
export const GENERATION_GATEWAYS: readonly GenerationGateway[] = [
  { ref: PAGE_GENERATION_KEY_REF, labelKey: 'tokenPlanKeyEnvPage' },
  { ref: 'OPENROUTER_API_KEY', origin: OPENROUTER_ORIGIN, labelKey: 'tokenPlanGatewayOpenrouter' },
  { ref: 'OPENAI_API_KEY', labelKey: 'tokenPlanGatewayRelay' },
  { ref: 'SILICONFLOW_API_KEY', origin: SILICONFLOW_ORIGIN, labelKey: 'tokenPlanGatewaySiliconflow' },
  { ref: 'DEEPSEEK_API_KEY', origin: DEEPSEEK_ORIGIN, labelKey: 'tokenPlanGatewayDeepseek' },
  { ref: 'QWEN_TOKEN_PLAN_CN_API_KEY', origin: TOKEN_PLAN_CN_ORIGIN, labelKey: 'tokenPlanKeyEnvCn' },
  { ref: 'QWEN_TOKEN_PLAN_API_KEY', origin: TOKEN_PLAN_INTL_ORIGIN, labelKey: 'tokenPlanKeyEnvIntl' },
  { ref: 'DASHSCOPE_API_KEY', labelKey: 'tokenPlanKeyEnvDashscope' },
]

/** Refs the page always describes so existing vendor keys show as configured. */
export const GENERATION_GATEWAY_REFS: readonly string[] = GENERATION_GATEWAYS.map(gateway => gateway.ref)

/**
 * Origin a gateway select should store for `ref`.
 * @param ref - credential reference.
 * @returns the origin, or `undefined` when the current origin should stay.
 */
export function generationGatewayOrigin(ref: string): string | undefined {
  return GENERATION_GATEWAYS.find(gateway => gateway.ref === ref)?.origin
}
