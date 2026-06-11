import { publisher } from '../../constants'
import { SIYA_AGENT_MODEL } from '../../siya-agent-models'

import { runBestOfNEditorWorkflow } from './editor-best-of-n-workflow'
import type { SecretAgentDefinition } from '../../types/secret-agent-definition'

/**
 * Multi-prompt editor: one implementor per explicit strategy prompt.
 */
export function createMultiPromptEditor(): Omit<SecretAgentDefinition, 'id'> {
  return {
    publisher,
    model: SIYA_AGENT_MODEL.coding,
    displayName: 'Multi-Prompt Editor',    spawnerPrompt:
      'Edits code by spawning multiple implementor agents with different strategy prompts, selects the best implementation, and applies the changes. Pass params.prompts — an array of short strategy prompts. Read files to edit before spawning.',

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
          prompts: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Array of short prompts, each specifying a different implementation strategy. Example: ["minimal changes", "modularize with new files", "optimize for performance"]',
          },
        },
        required: ['prompts'],
      },
    },
    outputMode: 'structured_output',
    handleSteps: runBestOfNEditorWorkflow,
  }
}

const definition = {
  ...createMultiPromptEditor(),
  id: 'editor-multi-prompt',
}

export default definition
