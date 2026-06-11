import {
  hasOpenRouterApiKey,
  isOpenRouterUsable,
} from './openrouter-auth'

export type SiyaAgentMode = 'DEFAULT' | 'LITE' | 'MAX' | 'PLAN'

/** OpenCode Zen chat completions endpoint (no API key required). */
export const OPENCODE_ZEN_ENDPOINT =
  'https://opencode.ai/zen/v1/chat/completions'

export const OPENCODE_ZEN_MODEL_PREFIX = 'opencode-zen/'

export type SiyaModelProvider = 'openrouter' | 'opencode-zen'

export type SiyaModelDefinition = {
  id: string
  name: string
  provider: SiyaModelProvider
  type: 'reasoning' | 'standard'
  /** Raw model id sent to the provider API */
  apiModelId: string
}

export const OPENROUTER_FREE_MODEL = 'openrouter/free'

export const OPENCODE_ZEN_FREE_MODELS: SiyaModelDefinition[] = [
  {
    id: `${OPENCODE_ZEN_MODEL_PREFIX}mimo-v2.5-free`,
    name: 'MiMo V2.5 Free',
    provider: 'opencode-zen',
    type: 'reasoning',
    apiModelId: 'mimo-v2.5-free',
  },
  {
    id: `${OPENCODE_ZEN_MODEL_PREFIX}deepseek-v4-flash-free`,
    name: 'DeepSeek V4 Flash Free',
    provider: 'opencode-zen',
    type: 'reasoning',
    apiModelId: 'deepseek-v4-flash-free',
  },
  {
    id: `${OPENCODE_ZEN_MODEL_PREFIX}nemotron-3-ultra-free`,
    name: 'Nemotron 3 Ultra Free',
    provider: 'opencode-zen',
    type: 'standard',
    apiModelId: 'nemotron-3-ultra-free',
  },
  {
    id: `${OPENCODE_ZEN_MODEL_PREFIX}north-mini-code-free`,
    name: 'North Mini Code Free',
    provider: 'opencode-zen',
    type: 'reasoning',
    apiModelId: 'north-mini-code-free',
  },
  {
    id: `${OPENCODE_ZEN_MODEL_PREFIX}big-pickle`,
    name: 'Big Pickle',
    provider: 'opencode-zen',
    type: 'reasoning',
    apiModelId: 'big-pickle',
  },
]

export const OPENROUTER_FREE_MODEL_DEF: SiyaModelDefinition = {
  id: OPENROUTER_FREE_MODEL,
  name: 'OpenRouter Free',
  provider: 'openrouter',
  type: 'standard',
  apiModelId: OPENROUTER_FREE_MODEL,
}

export const SIYA_AVAILABLE_MODELS: SiyaModelDefinition[] = [
  OPENROUTER_FREE_MODEL_DEF,
  ...OPENCODE_ZEN_FREE_MODELS,
]

const MODEL_BY_ID = new Map(
  SIYA_AVAILABLE_MODELS.map((model) => [model.id, model]),
)

/** OpenCode Zen API ids only — excludes OpenRouter to avoid `openrouter/free` collision. */
const OPENCODE_ZEN_BY_API_ID = new Map(
  OPENCODE_ZEN_FREE_MODELS.map((model) => [model.apiModelId, model]),
)

/** Default OpenCode Zen model when OpenRouter is unavailable. */
export const SIYA_ZEN_DEFAULT_MODEL = `${OPENCODE_ZEN_MODEL_PREFIX}mimo-v2.5-free`

/** Default main-agent model when OpenRouter key is valid. */
export const SIYA_DEFAULT_MODEL = OPENROUTER_FREE_MODEL

/** Default when MAX mode is active and no explicit /model selection. */
export const SIYA_MAX_DEFAULT_MODEL = `${OPENCODE_ZEN_MODEL_PREFIX}mimo-v2.5-free`

/** Mode default when user has not run /model (before OpenRouter fallback). */
export function getModeDefaultModel(agentMode: SiyaAgentMode): string {
  if (agentMode === 'MAX') {
    return SIYA_MAX_DEFAULT_MODEL
  }
  return isOpenRouterUsable() ? OPENROUTER_FREE_MODEL : SIYA_ZEN_DEFAULT_MODEL
}

export function isOpenRouterModel(modelId: string): boolean {
  const resolved = MODEL_BY_ID.get(modelId)
  if (resolved?.provider === 'openrouter') return true
  return modelId === OPENROUTER_FREE_MODEL || modelId.startsWith('openrouter/')
}

export function isOpenCodeZenModel(modelId: string): boolean {
  if (isOpenRouterModel(modelId)) return false
  if (modelId.startsWith(OPENCODE_ZEN_MODEL_PREFIX)) return true
  return OPENCODE_ZEN_BY_API_ID.has(modelId)
}

export function resolveSiyaModel(modelId: string): SiyaModelDefinition | undefined {
  const byId = MODEL_BY_ID.get(modelId)
  if (byId) return byId

  if (modelId.startsWith(OPENCODE_ZEN_MODEL_PREFIX)) {
    return OPENCODE_ZEN_BY_API_ID.get(
      modelId.slice(OPENCODE_ZEN_MODEL_PREFIX.length),
    )
  }

  return OPENCODE_ZEN_BY_API_ID.get(modelId)
}

/** API model id for the upstream provider (strips opencode-zen/ prefix). */
export function toProviderApiModelId(modelId: string): string {
  const resolved = resolveSiyaModel(modelId)
  if (resolved) return resolved.apiModelId
  if (modelId.startsWith(OPENCODE_ZEN_MODEL_PREFIX)) {
    return modelId.slice(OPENCODE_ZEN_MODEL_PREFIX.length)
  }
  return modelId
}

/**
 * Pick a model that can actually run: OpenRouter models fall back to OpenCode Zen
 * when no valid API key is configured.
 */
export function resolveRunnableModel(modelId: string): string {
  const resolved = resolveSiyaModel(modelId)?.id ?? modelId
  if (isOpenRouterModel(resolved) && !isOpenRouterUsable()) {
    return SIYA_ZEN_DEFAULT_MODEL
  }
  return resolved
}

export function getEffectiveModel(
  agentMode: SiyaAgentMode,
  selectedModel?: string | null,
): string {
  const raw =
    selectedModel && resolveSiyaModel(selectedModel)
      ? resolveSiyaModel(selectedModel)!.id
      : getModeDefaultModel(agentMode)
  return resolveRunnableModel(raw)
}

export function formatModelListForCli(): string {
  const lines = ['Available models (use /model <id>):', '']
  lines.push('OpenRouter:')
  lines.push(`  ${OPENROUTER_FREE_MODEL} — OpenRouter Free`)
  if (!isOpenRouterUsable()) {
    if (hasOpenRouterApiKey()) {
      lines.push('  (key invalid — fix OPENROUTER_API_KEY)')
    } else {
      lines.push('  (set OPENROUTER_API_KEY in .env)')
    }
  }
  lines.push('')
  lines.push('OpenCode Zen (free):')
  for (const model of OPENCODE_ZEN_FREE_MODELS) {
    lines.push(`  ${model.id} — ${model.name} [${model.type}]`)
  }
  return lines.join('\n')
}

export function resolveModelInput(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const exact = resolveSiyaModel(trimmed)
  if (exact) return exact.id

  const lower = trimmed.toLowerCase()
  const byName = SIYA_AVAILABLE_MODELS.find(
    (m) =>
      m.id.toLowerCase() === lower ||
      m.apiModelId.toLowerCase() === lower ||
      m.name.toLowerCase() === lower,
  )
  if (byName) return byName.id

  const partial = SIYA_AVAILABLE_MODELS.find(
    (m) =>
      m.id.toLowerCase().includes(lower) ||
      m.apiModelId.toLowerCase().includes(lower),
  )
  return partial?.id ?? null
}
