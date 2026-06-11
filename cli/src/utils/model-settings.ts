import {
  getEffectiveModel,
  getModeDefaultModel,
  resolveModelInput,
  resolveSiyaModel,
  formatModelListForCli,
  SIYA_AVAILABLE_MODELS,
} from '@siya/common/constants/siya-models'
import {
  formatSubagentModelRolesForCli,
  resolveAgentModel,
} from '@siya/common/constants/subagent-models'

import { loadSettings, saveSettings } from './settings'

import type { AgentMode } from './constants'
import type { AgentDefinition } from '@siya/common/templates/initial-agents-dir/types/agent-definition'

export {
  getEffectiveModel,
  getModeDefaultModel,
  resolveModelInput,
  resolveSiyaModel,
  formatModelListForCli,
  SIYA_AVAILABLE_MODELS,
  formatSubagentModelRolesForCli,
}

export function loadSelectedModel(): string | null {
  const settings = loadSettings()
  if (!settings.selectedModel) return null
  return resolveSiyaModel(settings.selectedModel)?.id ?? null
}

export function saveSelectedModel(modelId: string | null): void {
  saveSettings({ selectedModel: modelId ?? undefined })
}

/** User-facing choice: explicit /model selection or mode default. */
export function getDisplayModelForMode(
  agentMode: AgentMode,
  selectedModel?: string | null,
): string {
  const explicit =
    selectedModel !== undefined && selectedModel !== null
      ? selectedModel
      : loadSelectedModel()
  if (explicit && resolveSiyaModel(explicit)) {
    return explicit
  }
  return getModeDefaultModel(agentMode)
}

/** Model that will actually run for the main agent. */
export function getRunnableModelForMode(
  agentMode: AgentMode,
  selectedModel?: string | null,
): string {
  const explicit =
    selectedModel !== undefined ? selectedModel : loadSelectedModel()
  return getEffectiveModel(agentMode, explicit)
}

export function getModelDisplayName(modelId: string): string {
  return resolveSiyaModel(modelId)?.name ?? modelId
}

/** Apply role-based models to subagents; main orchestrator uses mainAgentModel. */
export function applyModelToAgentDefinitions(
  definitions: AgentDefinition[],
  mainAgentModel: string,
): AgentDefinition[] {
  return definitions.map((def) => ({
    ...def,
    model: resolveAgentModel(def.id, mainAgentModel),
    providerOptions: undefined,
  }))
}

export function getActiveModelForMode(
  agentMode: AgentMode,
  selectedModel?: string | null,
): string {
  return getRunnableModelForMode(agentMode, selectedModel)
}

export function formatFullModelHelpForCli(mainAgentModel: string): string {
  return [
    formatModelListForCli(),
    '',
    `Main agent (base2*): ${mainAgentModel} (${getModelDisplayName(mainAgentModel)})`,
    '',
    formatSubagentModelRolesForCli(),
  ].join('\n')
}
