import type { SiyaToolHandlerFunction } from '../handler-function-type'
import type {
  SiyaToolCall,
  SiyaToolOutput,
} from '@siya/common/tools/list'
import type { AgentState } from '@siya/common/types/session-state'

export const handleSetMessages = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SiyaToolCall<'set_messages'>

  agentState: AgentState
}): Promise<{ output: SiyaToolOutput<'set_messages'> }> => {
  const { previousToolCallFinished, toolCall, agentState } = params

  await previousToolCallFinished
  agentState.messageHistory = toolCall.input.messages
  return { output: [{ type: 'json', value: { message: 'Messages set.' } }] }
}) satisfies SiyaToolHandlerFunction<'set_messages'>
