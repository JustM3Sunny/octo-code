import type { SiyaToolHandlerFunction } from '../handler-function-type'
import type {
  ClientToolCall,
  SiyaToolCall,
  SiyaToolOutput,
} from '@siya/common/tools/list'

export const handleBrowserLogs = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SiyaToolCall<'browser_logs'>
  requestClientToolCall: (
    toolCall: ClientToolCall<'browser_logs'>,
  ) => Promise<SiyaToolOutput<'browser_logs'>>
}): Promise<{
  output: SiyaToolOutput<'browser_logs'>
}> => {
  const { previousToolCallFinished, toolCall, requestClientToolCall } = params

  await previousToolCallFinished
  return { output: await requestClientToolCall(toolCall) }
}) satisfies SiyaToolHandlerFunction<'browser_logs'>
