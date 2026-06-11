import {
  OPENCODE_ZEN_MODEL_PREFIX,
  SIYA_ZEN_DEFAULT_MODEL,
} from './siya-models'
/** Role → model assignments for subagents (free OpenCode Zen + OpenRouter). */
export const SIYA_ROLE_MODELS = {
  /** Main orchestrator (base2*) — set via mode + /model */
  orchestrator: `${OPENCODE_ZEN_MODEL_PREFIX}mimo-v2.5-free`,
  /** Code editing / implementation */
  coding: `${OPENCODE_ZEN_MODEL_PREFIX}mimo-v2.5-free`,
  /** Deep reasoning, complex problems */
  thinking: `${OPENCODE_ZEN_MODEL_PREFIX}deepseek-v4-flash-free`,
  /** Web/docs research, browser automation */
  research: `${OPENCODE_ZEN_MODEL_PREFIX}big-pickle`,
  /** Code review / critique */
  review: `${OPENCODE_ZEN_MODEL_PREFIX}deepseek-v4-flash-free`,
  /** File search, directory listing, code search */
  exploration: `${OPENCODE_ZEN_MODEL_PREFIX}nemotron-3-ultra-free`,
  /** Bash, context pruning, selectors, lightweight helpers */
  utility: `${OPENCODE_ZEN_MODEL_PREFIX}nemotron-3-ultra-free`,
  /** Fallback for unclassified agents */
  general: SIYA_ZEN_DEFAULT_MODEL,
} as const

export type SiyaAgentModelRole = keyof typeof SIYA_ROLE_MODELS

export function normalizeAgentId(agentId: string): string {
  const withoutVersion = agentId.split('@')[0]
  const parts = withoutVersion.split('/')
  return parts[parts.length - 1] ?? agentId
}

export function isMainOrchestratorAgent(agentId: string): boolean {
  const id = normalizeAgentId(agentId)
  return id.startsWith('base2') || id === 'base-chat' || id === 'base-deep'
}

export function resolveSubagentModelRole(agentId: string): SiyaAgentModelRole {
  const id = normalizeAgentId(agentId)

  if (isMainOrchestratorAgent(id)) {
    return 'orchestrator'
  }

  if (
    id.startsWith('editor') ||
    id.includes('implementor') ||
    id === 'editor-multi-prompt' ||
    id === 'editor-best-of-n-max'
  ) {
    return 'coding'
  }

  if (
    id.startsWith('thinker') ||
    id === 'gpt-5-agent' ||
    id === 'opus-agent'
  ) {
    return 'thinking'
  }

  if (
    id.startsWith('researcher') ||
    id === 'librarian' ||
    id === 'browser-use'
  ) {
    return 'research'
  }

  if (id.startsWith('code-reviewer') || id.includes('reviewer')) {
    return 'review'
  }

  if (
    id.startsWith('file-picker') ||
    id.startsWith('file-lister') ||
    id === 'code-searcher' ||
    id === 'directory-lister' ||
    id === 'glob-matcher'
  ) {
    return 'exploration'
  }

  if (
    id === 'basher' ||
    id === 'context-pruner' ||
    id.includes('selector') ||
    id.startsWith('best-of-n')
  ) {
    return 'utility'
  }

  return 'general'
}

/**
 * Pick the model for an agent. Main orchestrators use `mainAgentModel`
 * (from mode + /model). Subagents use role-based free model assignments.
 */
export function resolveAgentModel(
  agentId: string,
  mainAgentModel: string,
): string {
  if (isMainOrchestratorAgent(agentId)) {
    return mainAgentModel
  }

  const role = resolveSubagentModelRole(agentId)
  return SIYA_ROLE_MODELS[role]
}

export function formatSubagentModelRolesForCli(): string {
  const lines = [
    'Subagent model roles (automatic):',
    '',
    `  Coding (editor, implementor)     → ${SIYA_ROLE_MODELS.coding}`,
    `  Thinking (thinker, gpt-5, opus)  → ${SIYA_ROLE_MODELS.thinking}`,
    `  Research (web, docs, browser)    → ${SIYA_ROLE_MODELS.research}`,
    `  Review (code-reviewer)           → ${SIYA_ROLE_MODELS.review}`,
    `  Exploration (file-picker, etc.)  → ${SIYA_ROLE_MODELS.exploration}`,
    `  Utility (basher, pruner)         → ${SIYA_ROLE_MODELS.utility}`,
    `  Other                            → ${SIYA_ROLE_MODELS.general}`,
    '',
    'Main agent (base2*) uses mode default or /model selection.',
  ]
  return lines.join('\n')
}
