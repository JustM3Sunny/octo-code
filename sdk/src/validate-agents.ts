import {
  validateAgents as validateAgentsCommon,
  type DynamicAgentValidationError,
} from '@siya/common/templates/agent-validation'

import type { AgentDefinition } from '@siya/common/templates/initial-agents-dir/types/agent-definition'

export interface ValidationResult {
  success: boolean
  validationErrors: Array<{
    id: string
    message: string
  }>
  errorCount: number
}

/**
 * Validates agent definitions locally (Zod schema only).
 */
export async function validateAgents(
  definitions: AgentDefinition[],
): Promise<ValidationResult> {
  const agentTemplates: Record<string, AgentDefinition> = {}
  for (const [index, definition] of definitions.entries()) {
    if (!definition) {
      agentTemplates[`agent_${index}`] = definition
      continue
    }
    const key = definition.id ? `${definition.id}_${index}` : `agent_${index}`
    agentTemplates[key] = definition
  }

  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }

  const result = validateAgentsCommon({
    agentTemplates,
    logger,
  })

  const validationErrors: DynamicAgentValidationError[] =
    result.validationErrors

  const transformedErrors = validationErrors.map((error) => ({
    id: error.filePath ?? 'unknown',
    message: error.message,
  }))

  return {
    success: transformedErrors.length === 0,
    validationErrors: transformedErrors,
    errorCount: transformedErrors.length,
  }
}
