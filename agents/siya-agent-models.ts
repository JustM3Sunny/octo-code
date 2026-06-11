import { SIYA_ROLE_MODELS } from '@siya/common/constants/subagent-models'
import { SIYA_DEFAULT_MODEL } from '@siya/common/constants/siya-models'

/**
 * SIYA model ids used in agent definitions.
 * Runtime may override via resolveAgentModel() — these are the canonical defaults.
 */
export const SIYA_AGENT_MODEL = {
  orchestrator: SIYA_ROLE_MODELS.orchestrator,
  coding: SIYA_ROLE_MODELS.coding,
  thinking: SIYA_ROLE_MODELS.thinking,
  research: SIYA_ROLE_MODELS.research,
  review: SIYA_ROLE_MODELS.review,
  exploration: SIYA_ROLE_MODELS.exploration,
  utility: SIYA_ROLE_MODELS.utility,
  general: SIYA_ROLE_MODELS.general,
  default: SIYA_DEFAULT_MODEL,
} as const

/** Maps legacy Codebuff variant names to SIYA free models. */
export const SIYA_VARIANT_MODEL = {
  opus: SIYA_AGENT_MODEL.coding,
  sonnet: SIYA_AGENT_MODEL.exploration,
  'gpt-5': SIYA_AGENT_MODEL.thinking,
  gemini: SIYA_AGENT_MODEL.research,
  glm: SIYA_AGENT_MODEL.coding,
  kimi: SIYA_AGENT_MODEL.coding,
  deepseek: SIYA_AGENT_MODEL.thinking,
  minimax: SIYA_AGENT_MODEL.coding,
} as const

export type SiyaAgentVariant = keyof typeof SIYA_VARIANT_MODEL
