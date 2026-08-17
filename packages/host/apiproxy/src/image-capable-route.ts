/**
 * Pick a same-provider catalog model that declares image input when the
 * current selection does not.
 * @module @deepseek-ai/dsh-host-apiproxy/image-capable-route
 */

import type { LlmModelInfo } from '@deepseek-ai/dsh-llm'

/** Whether resolved model metadata explicitly declares image input. */
export function declaresImageInput(info: { inputModalities?: readonly string[] }): boolean {
  return info.inputModalities !== undefined && info.inputModalities.includes('image')
}

/**
 * First path segment of a provider route, used only to prefer catalog ids
 * that share that brand (`qwen-token-plan-cn` prefers `qwen*`).
 * @param provider - registered provider route.
 * @returns the brand prefix, or empty when the route has none.
 */
export function providerBrandPrefix(provider: string): string {
  const dash = provider.indexOf('-')
  return dash === -1 ? provider : provider.slice(0, dash)
}

/**
 * Choose a same-provider image-capable catalog entry for one selection.
 * @param provider - current provider route.
 * @param model - current model id.
 * @param models - catalog advertised for that provider.
 * @param preferredId - optional same-provider catalog id from settings.
 * @returns the current model when it already declares image input, otherwise
 *   the preferred sibling, or `undefined` when none declare image input.
 */
export function pickImageCapableModel(
  provider: string,
  model: string,
  models: readonly LlmModelInfo[],
  preferredId?: string,
): LlmModelInfo | undefined {
  const capable = models.filter(entry => entry.provider === provider && declaresImageInput(entry))
  if (capable.length === 0) return undefined
  const current = capable.find(entry => entry.id === model)
  if (current !== undefined) return current
  const preferred = preferredId === undefined || preferredId === ''
    ? undefined
    : capable.find(entry => entry.id === preferredId)
  if (preferred !== undefined) return preferred
  const brand = providerBrandPrefix(provider)
  return [...capable].sort((left, right) => {
    const leftBrand = brand !== '' && left.id.startsWith(brand) ? 1 : 0
    const rightBrand = brand !== '' && right.id.startsWith(brand) ? 1 : 0
    return rightBrand - leftBrand || left.id.localeCompare(right.id)
  })[0]
}
