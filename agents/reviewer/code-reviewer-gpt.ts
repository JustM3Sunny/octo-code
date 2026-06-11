import { publisher } from '../constants'
import { SIYA_AGENT_MODEL } from '../siya-agent-models'
import type { SecretAgentDefinition } from '../types/secret-agent-definition'
import { createReviewer } from './code-reviewer'

const definition: SecretAgentDefinition = {
  id: 'code-reviewer-gpt',
  publisher,
  ...createReviewer(SIYA_AGENT_MODEL.thinking),
}

export default definition
