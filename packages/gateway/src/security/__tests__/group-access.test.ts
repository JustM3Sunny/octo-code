import { describe, expect, test } from 'bun:test'

import {
  checkGroupMessageAccess,
  isBotMentioned,
  isOwnerUser,
  stripBotMention,
} from '../group-access'

import type { TelegramChannelConfig } from '@siya/common/types/gateway'

const baseConfig: TelegramChannelConfig = {
  enabled: true,
  dmPolicy: 'pairing',
  allowFrom: ['tg:7498724465'],
  ownerUserId: '7498724465',
  groupPolicy: 'allowlist',
  groups: { '*': { requireMention: true, enabled: true } },
  mentionAliases: ['siya'],
  defaultAgent: 'base2',
  streaming: 'partial',
  historyLimit: 50,
}

describe('group access', () => {
  test('owner mention in group is allowed', () => {
    const result = checkGroupMessageAccess({
      config: baseConfig,
      chatId: '-100123',
      senderUserId: '7498724465',
      text: '@mybot @siya fix the login bug',
      botUsername: 'mybot',
    })

    expect(result.allowed).toBe(true)
    expect(result.cleanedText).toBe('fix the login bug')
  })

  test('non-owner in group is ignored', () => {
    const result = checkGroupMessageAccess({
      config: baseConfig,
      chatId: '-100123',
      senderUserId: '999999',
      text: '@mybot hello',
      botUsername: 'mybot',
    })

    expect(result.allowed).toBe(false)
  })

  test('owner without mention in group is ignored', () => {
    const result = checkGroupMessageAccess({
      config: baseConfig,
      chatId: '-100123',
      senderUserId: '7498724465',
      text: 'hello without mention',
      botUsername: 'mybot',
    })

    expect(result.allowed).toBe(false)
  })

  test('isOwnerUser matches allowFrom owner', () => {
    expect(isOwnerUser(baseConfig, '7498724465')).toBe(true)
    expect(isOwnerUser(baseConfig, '111')).toBe(false)
  })

  test('stripBotMention removes aliases', () => {
    expect(
      stripBotMention({
        text: '@mybot @siya  please help',
        botUsername: 'mybot',
        mentionAliases: ['siya'],
      }),
    ).toBe('please help')
  })

  test('isBotMentioned detects alias', () => {
    expect(
      isBotMentioned({
        text: 'hey @siya do this',
        mentionAliases: ['siya'],
      }),
    ).toBe(true)
  })
})
