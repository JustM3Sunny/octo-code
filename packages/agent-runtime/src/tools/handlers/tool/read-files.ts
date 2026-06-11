import { jsonToolResult } from '@siya/common/util/messages'

import { getFileReadingUpdates } from '../../../get-file-reading-updates'
import { renderReadFilesResult } from '../../../util/render-read-files-result'

import type { SiyaToolHandlerFunction } from '../handler-function-type'
import type {
  SiyaToolCall,
  SiyaToolOutput,
} from '@siya/common/tools/list'
import type { ParamsExcluding } from '@siya/common/types/function-params'
import type { ProjectFileContext } from '@siya/common/util/file'

type ToolName = 'read_files'
export const handleReadFiles = (async (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: SiyaToolCall<ToolName>

    fileContext: ProjectFileContext
  } & ParamsExcluding<typeof getFileReadingUpdates, 'requestedFiles'>,
): Promise<{ output: SiyaToolOutput<ToolName> }> => {
  const {
    previousToolCallFinished,
    toolCall,

    fileContext,
  } = params
  const { paths } = toolCall.input

  await previousToolCallFinished

  const addedFiles = await getFileReadingUpdates({
    ...params,
    requestedFiles: paths,
  })

  return {
    output: jsonToolResult(
      renderReadFilesResult(addedFiles, fileContext.tokenCallers ?? {}),
    ),
  }
}) satisfies SiyaToolHandlerFunction<ToolName>
