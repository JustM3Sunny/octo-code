import { getErrorObject } from '@siya/common/util/error'
import { cloneDeep } from 'lodash'

import type { SiyaToolOutput } from '@siya/common/tools/list'
import type { Logger } from '@siya/common/types/contracts/logger'

export function simplifyReadFileResults(
  messageContent: SiyaToolOutput<'read_files'>,
): SiyaToolOutput<'read_files'> {
  return [
    {
      type: 'json',
      value: cloneDeep(messageContent[0]).value.map(({ path }) => {
        return {
          path,
          contentOmittedForLength: true,
        }
      }),
    },
  ]
}

export function simplifyTerminalCommandResults(params: {
  messageContent: SiyaToolOutput<'run_terminal_command'>
  logger: Logger
}): SiyaToolOutput<'run_terminal_command'> {
  const { messageContent, logger } = params
  try {
    const clone = cloneDeep(messageContent)
    const content = clone[0].value
    if ('processId' in content || 'errorMessage' in content) {
      return clone
    }
    const { command, message, exitCode } = content
    return [
      {
        type: 'json',
        value: {
          command,
          ...(message && { message }),
          stdoutOmittedForLength: true,
          ...(exitCode !== undefined && { exitCode }),
        },
      },
    ]
  } catch (error) {
    logger.error(
      { error: getErrorObject(error), messageContent },
      'Error simplifying terminal command results',
    )
    return [
      {
        type: 'json',
        value: {
          command: '',
          stdoutOmittedForLength: true,
        },
      },
    ]
  }
}
