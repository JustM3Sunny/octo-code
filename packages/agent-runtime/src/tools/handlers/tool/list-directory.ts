import type { SiyaToolHandlerFunction } from '../handler-function-type'
import type {
  ClientToolCall,
  SiyaToolCall,
  SiyaToolOutput,
} from '@siya/common/tools/list'

type ToolName = 'list_directory'
export const handleListDirectory = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SiyaToolCall<ToolName>
  requestClientToolCall: (
    toolCall: ClientToolCall<ToolName>,
  ) => Promise<SiyaToolOutput<ToolName>>
}): Promise<{
  output: SiyaToolOutput<ToolName>
}> => {
  const { previousToolCallFinished, toolCall, requestClientToolCall } = params

  await previousToolCallFinished
  return { output: await requestClientToolCall(toolCall) }
}) satisfies SiyaToolHandlerFunction<ToolName>
