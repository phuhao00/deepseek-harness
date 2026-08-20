/**
 * Session model catalog advertised on ACP `session/new`.
 *
 * Ussop/Buzz discovers models by spawning the agent and reading `configOptions`
 * (`category: "model"`) plus the unstable `models` object from that response.
 * @module
 */

import type { Context } from '@deepseek-ai/cordis'
import type { NewSessionResponse, SessionConfigOption } from '@agentclientprotocol/sdk'
import type { LlmModelInfo, LlmRuntime } from '@deepseek-ai/dsh-llm'

/** Bound for adapter catalog lookup so a hung provider cannot stall session/new. */
export const LIST_MODELS_BUDGET_MS = 2_000

/** Unstable SessionModelState Buzz also reads from `session/new`. */
export interface SessionModelState {
  /** Currently selected model id. */
  currentModelId: string
  /** Selectable models. */
  availableModels: Array<{
    /** Wire id Buzz persists on the agent record. */
    modelId: string
    /** Dropdown label. */
    name: string
    /** Optional extra detail. */
    description?: string
  }>
}

/** Both catalog halves Buzz merges in `buzz-acp models --json`. */
export interface SessionModelCatalog {
  /** Stable ACP select option with `category: "model"`. */
  configOptions: NonNullable<NewSessionResponse['configOptions']>
  /** Unstable model state. */
  models: SessionModelState
}

/** Provider/model used by this ACP process. */
export interface SessionModelSelection {
  /** Registered provider route. */
  provider?: string
  /** Provider-owned model id. */
  model?: string
}

/**
 * Resolve one catalog lookup within a budget; timeout and adapter errors
 * become an empty list so session/new still succeeds.
 * @param work - adapter `listModels` promise.
 * @param budgetMs - maximum wait.
 * @returns the adapter list, or `[]` on timeout or rejection.
 */
export function catalogOrEmpty(
  work: Promise<readonly LlmModelInfo[]>,
  budgetMs: number,
): Promise<readonly LlmModelInfo[]> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve([]), budgetMs)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve([])
      },
    )
  })
}

/**
 * Build the model catalog for `session/new`, or `undefined` when nothing
 * selectable exists.
 * @param ctx - bridge context; `llm` is optional so tests and --help never block.
 * @param selection - configured provider/model for this process.
 * @param budgetMs - catalog lookup budget.
 * @returns ACP session model catalog, or `undefined` when no model is selectable.
 */
export async function buildSessionModelCatalog(
  ctx: Pick<Context, 'get'>,
  selection: SessionModelSelection,
  budgetMs = LIST_MODELS_BUDGET_MS,
): Promise<SessionModelCatalog | undefined> {
  const llm = ctx.get('llm') as LlmRuntime | undefined
  const provider = selection.provider?.trim()
    || llm?.listProviders()[0]?.id
  const listed = provider === undefined || llm === undefined
    ? []
    : [...await catalogOrEmpty(llm.listModels(provider), budgetMs)]

  const current = selection.model?.trim()
  if (current !== undefined && current.length > 0 && !listed.some(model => model.id === current)) {
    listed.unshift({
      provider: provider ?? '',
      id: current,
      name: current,
    })
  }

  const first = listed[0]
  if (first === undefined) return undefined

  const currentValue = current !== undefined && current.length > 0 ? current : first.id
  const options = listed.map(model => ({
    value: model.id,
    name: model.name,
  }))
  const configOptions: SessionConfigOption[] = [{
    type: 'select',
    id: 'model',
    name: 'Model',
    category: 'model',
    currentValue,
    options,
  }]

  return {
    configOptions,
    models: {
      currentModelId: currentValue,
      availableModels: listed.map(model => ({
        modelId: model.id,
        name: model.name,
        ...model.description === undefined ? {} : { description: model.description },
      })),
    },
  }
}

/**
 * Return a catalog whose current selection is `modelId`, or `undefined` when
 * that id is not in the advertised list.
 * @param catalog - session/new catalog.
 * @param modelId - requested wire id.
 * @returns catalog with `currentModelId` / select `currentValue` set to `modelId`.
 */
export function selectCatalogModel(
  catalog: SessionModelCatalog,
  modelId: string,
): SessionModelCatalog | undefined {
  if (!catalog.models.availableModels.some(model => model.modelId === modelId)) {
    return undefined
  }
  return {
    configOptions: catalog.configOptions.map(option => (
      option.type === 'select' && option.category === 'model'
        ? { ...option, currentValue: modelId }
        : option
    )),
    models: {
      ...catalog.models,
      currentModelId: modelId,
    },
  }
}
