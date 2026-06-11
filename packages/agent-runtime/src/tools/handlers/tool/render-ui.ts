import type { SiyaToolHandlerFunction } from '../handler-function-type'
import type {
  SiyaToolCall,
  SiyaToolOutput,
} from '@siya/common/tools/list'

export const handleRenderUI = (async ({
  previousToolCallFinished,
}: {
  previousToolCallFinished: Promise<unknown>
  toolCall: SiyaToolCall<'render_ui'>
}): Promise<{ output: SiyaToolOutput<'render_ui'> }> => {
  await previousToolCallFinished
  return { output: [{ type: 'json', value: { message: 'UI rendered.' } }] }
}) satisfies SiyaToolHandlerFunction<'render_ui'>
