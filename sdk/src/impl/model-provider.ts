/**
 * Model provider abstraction — routes to OpenRouter or OpenCode Zen.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import {
  isOpenCodeZenModel,
  isOpenRouterModel,
  OPENCODE_ZEN_ENDPOINT,
  toProviderApiModelId,
} from '@siya/common/constants/siya-models'
import {
  hasOpenRouterApiKey,
  setOpenRouterAuthValid,
} from '@siya/common/constants/openrouter-auth'
import {
  OpenAICompatibleChatLanguageModel,
  VERSION,
} from '@siya/llm-providers/openai-compatible'

import type { OpenRouterProvider } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const OPENCODE_ZEN_BASE_URL = OPENCODE_ZEN_ENDPOINT.replace(
  /\/chat\/completions$/,
  '',
)

let cachedOpenRouterProvider: OpenRouterProvider | null = null
let cachedOpenRouterApiKey: string | null = null

/** Resolve OpenRouter key: explicit client key first, then .env. */
export function resolveOpenRouterApiKey(override?: string): string {
  const apiKey =
    override?.trim() || process.env.OPENROUTER_API_KEY?.trim() || ''
  if (!apiKey || apiKey === 'local-zen-only') {
    throw new Error(
      'OpenRouter API key not found. Set OPENROUTER_API_KEY in your environment, or use an opencode-zen/* model via /model.',
    )
  }
  return apiKey
}

export function getOpenRouterApiKey(): string {
  return resolveOpenRouterApiKey()
}

function getOpenRouterProvider(apiKey: string): OpenRouterProvider {
  if (!cachedOpenRouterProvider || cachedOpenRouterApiKey !== apiKey) {
    cachedOpenRouterProvider = createOpenRouter({
      apiKey,
      compatibility: 'strict',
      headers: {
        'HTTP-Referer': 'https://github.com/siya-ai/siya',
        'X-Title': 'Siya CLI',
      },
    })
    cachedOpenRouterApiKey = apiKey
  }
  return cachedOpenRouterProvider
}

/** Verify key against OpenRouter; caches result for routing fallbacks. */
export async function verifyOpenRouterAuth(apiKey?: string): Promise<boolean> {
  if (!hasOpenRouterApiKey() && !apiKey?.trim()) {
    setOpenRouterAuthValid(false)
    return false
  }

  try {
    const key = resolveOpenRouterApiKey(apiKey)
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(10000),
    })
    const valid = response.ok
    setOpenRouterAuthValid(valid)
    return valid
  } catch {
    setOpenRouterAuthValid(false)
    return false
  }
}

export function resetOpenRouterProviderCache(): void {
  cachedOpenRouterProvider = null
  cachedOpenRouterApiKey = null
}

/** @deprecated Use getOpenRouterProvider via getModelForRequest */
export function getOpenRouterClient(): OpenRouterProvider {
  return getOpenRouterProvider(getOpenRouterApiKey())
}

/** @deprecated No-op — ChatGPT OAuth routing removed */
export function markChatGptOAuthRateLimited(_resetAt?: Date): void {}

/** @deprecated No-op — ChatGPT OAuth routing removed */
export function isChatGptOAuthRateLimited(): boolean {
  return false
}

/** @deprecated No-op — ChatGPT OAuth routing removed */
export function resetChatGptOAuthRateLimit(): void {}

export interface ModelRequestParams {
  /** Model ID (e.g. "openrouter/free" or "opencode-zen/mimo-v2.5-free") */
  model: string
  /** SiyaClient apiKey — preferred over process.env when set */
  apiKey?: string
  /** @deprecated Ignored — ChatGPT OAuth routing removed */
  skipChatGptOAuth?: boolean
  /** @deprecated Ignored */
  costMode?: string
}

export interface ModelResult {
  model: LanguageModel
  /** Always false — requests go directly to providers */
  isChatGptOAuth: boolean
}

export async function getModelForRequest(
  params: ModelRequestParams,
): Promise<ModelResult> {
  const model = params.model

  if (isOpenRouterModel(model)) {
    const apiKey = resolveOpenRouterApiKey(params.apiKey)
    const provider = getOpenRouterProvider(apiKey)
    const apiModelId = toProviderApiModelId(model)
    return {
      model: provider(apiModelId),
      isChatGptOAuth: false,
    }
  }

  if (isOpenCodeZenModel(model)) {
    return {
      model: createOpenCodeZenModel(model),
      isChatGptOAuth: false,
    }
  }

  throw new Error(
    `Unsupported model "${params.model}". Use openrouter/free or an opencode-zen/* model.`,
  )
}

function createOpenCodeZenModel(model: string): LanguageModel {
  const apiModelId = toProviderApiModelId(model)
  return new OpenAICompatibleChatLanguageModel(apiModelId, {
    provider: 'opencode-zen',
    url: ({ path: endpoint }) =>
      `${OPENCODE_ZEN_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`,
    headers: () => ({
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/siya-opencode-zen`,
    }),
    supportsStructuredOutputs: false,
    includeUsage: undefined,
  })
}
