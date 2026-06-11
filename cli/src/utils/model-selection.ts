import {
  isOpenRouterModel,
  resolveModelInput,
  resolveSiyaModel,
} from '@siya/common/constants/siya-models'
import {
  getOpenRouterAuthValid,
  hasOpenRouterApiKey,
} from '@siya/common/constants/openrouter-auth'
import { verifyOpenRouterAuth } from '@siya/sdk'

import { getModelDisplayName, saveSelectedModel } from './model-settings'
import { resetSiyaClient } from './siya-client'

export type ModelSelectionResult = {
  selected: string
  openRouterAuthFailed: boolean
}

/** Persist /model selection and refresh SDK client. */
export async function persistModelSelection(
  modelId: string,
): Promise<ModelSelectionResult> {
  const resolved = resolveModelInput(modelId) ?? modelId
  if (!resolveSiyaModel(resolved)) {
    throw new Error(`Unknown model "${modelId}"`)
  }

  let openRouterAuthFailed = false
  if (isOpenRouterModel(resolved)) {
    if (!hasOpenRouterApiKey()) {
      openRouterAuthFailed = true
    } else if (getOpenRouterAuthValid() === false) {
      openRouterAuthFailed = true
    } else if (getOpenRouterAuthValid() !== true) {
      openRouterAuthFailed = !(await verifyOpenRouterAuth())
    }
  }

  saveSelectedModel(resolved)
  resetSiyaClient()

  return { selected: resolved, openRouterAuthFailed }
}

export function formatModelSelectionMessage(result: ModelSelectionResult): string {
  const base = `Main agent model: ${result.selected} (${getModelDisplayName(result.selected)}). Subagents use role-based models.`
  if (result.openRouterAuthFailed) {
    return `${base} Warning: OPENROUTER_API_KEY is missing or invalid — chat may fail until you fix it in .env.`
  }
  return base
}

/** Verify OpenRouter key at startup (does not override saved /model choice). */
export async function initializeModelSelection(): Promise<void> {
  if (hasOpenRouterApiKey()) {
    await verifyOpenRouterAuth()
  }
}

export { getModelDisplayName }
