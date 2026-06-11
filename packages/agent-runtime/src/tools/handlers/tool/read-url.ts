import type { SiyaToolHandlerFunction } from '../handler-function-type'
import type {
  ClientToolCall,
  SiyaToolCall,
  SiyaToolOutput,
} from '@siya/common/tools/list'

export const handleReadUrl = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SiyaToolCall<'read_url'>
  requestClientToolCall: (
    toolCall: ClientToolCall<'read_url'>,
  ) => Promise<SiyaToolOutput<'read_url'>>
}): Promise<{
  output: SiyaToolOutput<'read_url'>
}> => {
  const { previousToolCallFinished, toolCall, requestClientToolCall } = params

  await previousToolCallFinished
  return { output: await requestClientToolCall(toolCall) }
}) satisfies SiyaToolHandlerFunction<'read_url'>
