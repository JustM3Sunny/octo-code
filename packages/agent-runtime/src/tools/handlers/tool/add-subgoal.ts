import { buildArray } from '@siya/common/util/array'
import { jsonToolResult } from '@siya/common/util/messages'

import type { SiyaToolHandlerFunction } from '../handler-function-type'
import type {
  SiyaToolCall,
  SiyaToolOutput,
} from '@siya/common/tools/list'
import type { Subgoal } from '@siya/common/types/session-state'

export const handleAddSubgoal = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SiyaToolCall<'add_subgoal'>

  agentContext: Record<string, Subgoal>
}): Promise<{
  output: SiyaToolOutput<'add_subgoal'>
}> => {
  const { previousToolCallFinished, toolCall, agentContext } = params

  agentContext[toolCall.input.id] = {
    objective: toolCall.input.objective,
    status: toolCall.input.status,
    plan: toolCall.input.plan,
    logs: buildArray([toolCall.input.log]),
  }

  await previousToolCallFinished
  return { output: jsonToolResult({ message: 'Successfully added subgoal' }) }
}) satisfies SiyaToolHandlerFunction<'add_subgoal'>
