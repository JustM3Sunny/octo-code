import { publisher } from '../../constants'
import { SIYA_AGENT_MODEL } from '../../siya-agent-models'

import { runBestOfNEditorWorkflow } from './editor-best-of-n-workflow'
import type { SecretAgentDefinition } from '../../types/secret-agent-definition'

/**
 * Max-mode best-of-N editor: spawns N parallel implementors with diverse default
 * strategies, selects the best proposal, and applies the winning changes.
 */
export function createEditorBestOfNMax(): Omit<SecretAgentDefinition, 'id'> {
  return {
    publisher,
    model: SIYA_AGENT_MODEL.coding,
    displayName: 'Best-of-N Max Editor',    spawnerPrompt:
      'Edits code using best-of-N selection: spawns multiple implementor agents in parallel, picks the best implementation, and applies it. Do not pass a prompt — it inherits the full conversation. Read files to edit before spawning. Optional params.n (default 5, max 10) controls parallel candidates.',

    includeMessageHistory: true,
    inheritParentSystemPrompt: true,

    toolNames: [
      'spawn_agents',
      'str_replace',
      'write_file',
      'set_messages',
      'set_output',
    ],
    spawnableAgents: [
      'best-of-n-selector2',
      'editor-implementor-opus',
      'editor-implementor-gpt-5',
    ],

    inputSchema: {
      params: {
        type: 'object',
        properties: {
          n: {
            type: 'number',
            description:
              'Number of parallel implementor agents to spawn. Defaults to 5. Use fewer for simple tasks and up to 10 for complex tasks.',
          },
        },
      },
    },
    outputMode: 'structured_output',
    handleSteps: runBestOfNEditorWorkflow,
  }
}

const definition = {
  ...createEditorBestOfNMax(),
  id: 'editor-best-of-n-max',
}

export default definition
