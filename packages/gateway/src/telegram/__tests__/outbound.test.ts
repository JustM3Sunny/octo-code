import { describe, expect, test, beforeEach } from 'bun:test'

import {
  isTelegramOutboundReady,
  registerTelegramOutbound,
  sendTelegramText,
  setActiveTelegramChat,
  unregisterTelegramOutbound,
} from '../outbound'

import type { TelegramChannelConfig } from '@siya/common/types/gateway'

const config: TelegramChannelConfig = {
  enabled: true,
  botToken: 'test-token',
  defaultAgent: 'base2',
  ownerUserId: '7498724465',
  allowFrom: ['tg:7498724465'],
  groupPolicy: 'allowlist',
  groups: { '*': { requireMention: true } },
  mentionAliases: ['siya'],
  streaming: 'partial',
}

describe('telegram outbound', () => {
  beforeEach(() => {
    unregisterTelegramOutbound()
  })

  test('is not ready before registration', () => {
    expect(isTelegramOutboundReady()).toBe(false)
  })

  test('sends to owner DM by default', async () => {
    const sent: Array<{ chatId: string; text: string }> = []
    const api = {
      sendMessage: async (chatId: string, text: string) => {
        sent.push({ chatId, text })
        return { message_id: sent.length }
      },
    }

    registerTelegramOutbound({ api: api as never, config })

    const result = await sendTelegramText({ message: 'Hello from agent' })
    expect(result.chatId).toBe('7498724465')
    expect(sent).toEqual([{ chatId: '7498724465', text: 'Hello from agent' }])
  })

  test('sends to current chat when requested', async () => {
    const sent: string[] = []
    const api = {
      sendMessage: async (chatId: string) => {
        sent.push(chatId)
        return { message_id: 1 }
      },
    }

    registerTelegramOutbound({ api: api as never, config })
    setActiveTelegramChat('-100123456')

    await sendTelegramText({
      message: 'Group update',
      target: 'current_chat',
    })

    expect(sent).toEqual(['-100123456'])
  })

  test('throws when gateway is not running', async () => {
    await expect(sendTelegramText({ message: 'nope' })).rejects.toThrow(
      'Telegram gateway is not running',
    )
  })
})
