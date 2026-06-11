import path from 'path'

import { z } from 'zod/v4'

import { getCustomToolDefinition } from '@siya/sdk'

import {
  isTelegramOutboundReady,
  sendTelegramDocument,
  sendTelegramText,
} from '../telegram/outbound'
import {
  isRemoteGatewayHealthy,
  sendTelegramFileViaGatewayHttp,
  sendTelegramViaGatewayHttp,
} from '../telegram/remote-notify'

import type { AgentDefinition } from '@siya/sdk'
import type { CustomToolDefinition } from '@siya/sdk'

export const NOTIFY_TELEGRAM_TOOL = 'notify_telegram'
export const SEND_TELEGRAM_FILE_TOOL = 'send_telegram_file'

export function createTelegramNotifyTools(options?: {
  cwd?: string
}): CustomToolDefinition[] {
  const resolveFilePath = (filePath: string) => {
    if (path.isAbsolute(filePath)) {
      return filePath
    }
    return path.resolve(options?.cwd ?? process.cwd(), filePath)
  }

  const notifyTelegram = getCustomToolDefinition({
    toolName: NOTIFY_TELEGRAM_TOOL,
    description:
      'Send a Telegram message to the bot owner right now. Call this immediately when the user asks you to message/notify/DM them on Telegram (e.g. "send me a tg message", "notify me on Telegram"). Also use for progress updates, alerts, or background work. Do not search the codebase first — just call this tool. Requires the Telegram gateway to be running.',
    endsAgentStep: false,
    inputSchema: z.object({
      message: z.string().min(1).describe('Message text to send on Telegram'),
      target: z
        .enum(['owner_dm', 'current_chat'])
        .optional()
        .describe(
          'owner_dm = always DM the owner (default). current_chat = reply in the active Telegram chat.',
        ),
      chat_id: z
        .string()
        .optional()
        .describe('Optional explicit Telegram chat ID override'),
    }),
    exampleInputs: [
      {
        message: 'Build finished — 2 tests failed. Should I fix them now?',
        target: 'owner_dm',
      },
    ],
    execute: async (input) => {
      if (isTelegramOutboundReady()) {
        const result = await sendTelegramText({
          message: input.message,
          target: input.target,
          chatId: input.chat_id,
        })
        return [
          {
            type: 'json',
            value: {
              ok: true,
              chatId: result.chatId,
              messageCount: result.messageCount,
            },
          },
        ]
      }

      if (await isRemoteGatewayHealthy(options?.cwd)) {
        const result = await sendTelegramViaGatewayHttp({
          message: input.message,
          target: input.target,
          chatId: input.chat_id,
          cwd: options?.cwd,
        })
        return [
          {
            type: 'json',
            value: {
              ok: true,
              chatId: result.chatId,
              messageCount: result.messageCount,
              via: 'gateway_http',
            },
          },
        ]
      }

      return [
        {
          type: 'json',
          value: {
            ok: false,
            message:
              'Telegram gateway is not running. Start it with `siya gateway` or run `siya` with TELEGRAM_BOT_TOKEN configured.',
          },
        },
      ]
    },
  })

  const sendTelegramFile = getCustomToolDefinition({
    toolName: SEND_TELEGRAM_FILE_TOOL,
    description:
      'Send a file or screenshot to the owner on Telegram. Use after generating images, reports, or logs the user should see on their phone.',
    endsAgentStep: false,
    inputSchema: z.object({
      file_path: z.string().min(1).describe('Absolute or project-relative file path'),
      caption: z.string().optional().describe('Optional caption'),
      target: z.enum(['owner_dm', 'current_chat']).optional(),
      chat_id: z.string().optional(),
    }),
    exampleInputs: [
      {
        file_path: 'screenshot.png',
        caption: 'Here is the updated UI',
        target: 'owner_dm',
      },
    ],
    execute: async (input) => {
      const absolutePath = resolveFilePath(input.file_path)

      if (isTelegramOutboundReady()) {
        const result = await sendTelegramDocument({
          filePath: absolutePath,
          caption: input.caption,
          target: input.target,
          chatId: input.chat_id,
        })
        return [
          {
            type: 'json',
            value: {
              ok: true,
              chatId: result.chatId,
              filePath: input.file_path,
            },
          },
        ]
      }

      if (await isRemoteGatewayHealthy(options?.cwd)) {
        const result = await sendTelegramFileViaGatewayHttp({
          filePath: absolutePath,
          caption: input.caption,
          target: input.target,
          chatId: input.chat_id,
          cwd: options?.cwd,
        })
        return [
          {
            type: 'json',
            value: {
              ok: true,
              chatId: result.chatId,
              filePath: input.file_path,
              via: 'gateway_http',
            },
          },
        ]
      }

      return [
        {
          type: 'json',
          value: {
            ok: false,
            message: 'Telegram gateway is not running. Cannot send file.',
          },
        },
      ]
    },
  })

  return [notifyTelegram, sendTelegramFile]
}

export function injectTelegramToolsIntoAgents(
  agentDefinitions: AgentDefinition[],
  agentIds: string[] | 'all' = 'all',
): AgentDefinition[] {
  const ids =
    agentIds === 'all'
      ? new Set(agentDefinitions.map((def) => def.id))
      : new Set(agentIds)

  const extraTools = [NOTIFY_TELEGRAM_TOOL, SEND_TELEGRAM_FILE_TOOL]

  return agentDefinitions.map((definition) => {
    if (!ids.has(definition.id)) {
      return definition
    }

    const existing = definition.toolNames ?? []
    const merged = [...existing]
    for (const tool of extraTools) {
      if (!merged.includes(tool)) {
        merged.push(tool)
      }
    }

    return {
      ...definition,
      toolNames: merged,
    }
  })
}
