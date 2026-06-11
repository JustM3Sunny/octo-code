import type { ComposioMetaToolName } from '@siya/common/constants/composio'
import type { ToolResultOutput } from '@siya/common/types/messages/content-part'

export async function executeComposioToolViaServer(
  _params: {
    apiKey: string
    toolName: ComposioMetaToolName
    input: Record<string, unknown>
  },
): Promise<ToolResultOutput[]> {
  return [
    {
      type: 'json',
      value: {
        errorMessage:
          'Composio tool execution via remote server is not available in local-only mode.',
      },
    },
  ]
}
