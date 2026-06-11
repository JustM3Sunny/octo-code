import { assistantMessage, userMessage } from '@siya/common/util/messages'

import type { SiyaToolHandlerFunction } from '../handler-function-type'
import type {
  SiyaToolCall,
  SiyaToolOutput,
} from '@siya/common/tools/list'
import type { AgentState } from '@siya/common/types/session-state'

export const handleAddMessage = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SiyaToolCall<'add_message'>

  agentState: AgentState
}): Promise<{
  output: SiyaToolOutput<'add_message'>
}> => {
  const {
    previousToolCallFinished,
    toolCall,

    agentState,
  } = params

  await previousToolCallFinished

  agentState.messageHistory.push(
    toolCall.input.role === 'user'
      ? userMessage(toolCall.input.content)
      : assistantMessage(toolCall.input.content),
  )

  return { output: [{ type: 'json', value: { message: 'Message added.' } }] }
}) satisfies SiyaToolHandlerFunction<'add_message'>
