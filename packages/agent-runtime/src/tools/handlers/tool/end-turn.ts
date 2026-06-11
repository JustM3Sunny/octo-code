import type { SiyaToolHandlerFunction } from '../handler-function-type'
import type {
  SiyaToolCall,
  SiyaToolOutput,
} from '@siya/common/tools/list'

export const handleEndTurn = (async (params: {
  previousToolCallFinished: Promise<any>
  toolCall: SiyaToolCall<'end_turn'>
}): Promise<{ output: SiyaToolOutput<'end_turn'> }> => {
  const { previousToolCallFinished } = params

  await previousToolCallFinished
  return { output: [{ type: 'json', value: { message: 'Turn ended.' } }] }
}) satisfies SiyaToolHandlerFunction<'end_turn'>
