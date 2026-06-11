import fs from 'fs'
import path from 'path'

import { InputFile } from 'grammy'

import { getOwnerUserId } from '../security/group-access'
import { chunkTelegramMessage } from './format'

import type { TelegramChannelConfig } from '@siya/common/types/gateway'
import type { Api } from 'grammy'

export type TelegramNotifyTarget = 'owner_dm' | 'current_chat'

type OutboundState = {
  api: Api | null
  config: TelegramChannelConfig | null
  /** Telegram user id of the bot owner (for allowlist checks). */
  ownerUserId: string | null
  /** Private chat id for owner DMs once they have messaged the bot. */
  ownerDmChatId: string | null
  lastActiveChatId: string | null
}

const state: OutboundState = {
  api: null,
  config: null,
  ownerUserId: null,
  ownerDmChatId: null,
  lastActiveChatId: null,
}

export function registerTelegramOutbound(params: {
  api: Api
  config: TelegramChannelConfig
}): void {
  state.api = params.api
  state.config = params.config
  state.ownerUserId = getOwnerUserId(params.config)
}

/** Remember the owner's private chat id after they DM the bot. */
export function registerOwnerDmChat(chatId: string, userId?: string): void {
  if (!state.ownerUserId) {
    state.ownerDmChatId = chatId
    return
  }

  if (userId && normalizeOwnerUserId(userId) === state.ownerUserId) {
    state.ownerDmChatId = chatId
    return
  }

  if (!state.ownerDmChatId && userId === undefined) {
    state.ownerDmChatId = chatId
  }
}

function normalizeOwnerUserId(userId: string): string {
  return String(userId).replace(/^(tg:|telegram:)/i, '')
}

export function setActiveTelegramChat(chatId: string): void {
  state.lastActiveChatId = chatId
}

export function unregisterTelegramOutbound(): void {
  state.api = null
  state.config = null
  state.ownerUserId = null
  state.ownerDmChatId = null
  state.lastActiveChatId = null
}

export function isTelegramOutboundReady(): boolean {
  return state.api !== null
}

export function getTelegramApi(): Api | null {
  return state.api
}

function resolveChatId(params: {
  target?: TelegramNotifyTarget
  chatId?: string
}): string {
  if (!state.api) {
    throw new Error(
      'Telegram gateway is not running. Start `siya gateway` or launch Siya with auto-start enabled.',
    )
  }

  if (params.chatId?.trim()) {
    return params.chatId.trim()
  }

  const target = params.target ?? 'owner_dm'

  if (target === 'current_chat' && state.lastActiveChatId) {
    return state.lastActiveChatId
  }

  if (state.ownerDmChatId) {
    return state.ownerDmChatId
  }

  if (state.ownerUserId) {
    return state.ownerUserId
  }

  throw new Error(
    'No Telegram destination available. Message the bot once so it knows your chat ID.',
  )
}

export async function sendTelegramText(params: {
  message: string
  target?: TelegramNotifyTarget
  chatId?: string
}): Promise<{ chatId: string; messageCount: number }> {
  const api = state.api
  if (!api) {
    throw new Error('Telegram gateway is not running.')
  }

  const chatId = resolveChatId(params)
  const chunks = chunkTelegramMessage(params.message.trim())
  if (chunks.length === 0) {
    throw new Error('Message is empty.')
  }

  for (const chunk of chunks) {
    await api.sendMessage(chatId, chunk)
  }

  return { chatId, messageCount: chunks.length }
}

export async function sendTelegramDocument(params: {
  filePath: string
  caption?: string
  target?: TelegramNotifyTarget
  chatId?: string
}): Promise<{ chatId: string }> {
  const api = state.api
  if (!api) {
    throw new Error('Telegram gateway is not running.')
  }

  const absolutePath = path.resolve(params.filePath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`)
  }

  const chatId = resolveChatId(params)
  const isImage = absolutePath.match(/\.(png|jpe?g|gif|webp)$/i)

  if (isImage) {
    await api.sendPhoto(chatId, new InputFile(absolutePath), {
      caption: params.caption?.slice(0, 1024),
    })
  } else {
    await api.sendDocument(chatId, new InputFile(absolutePath), {
      caption: params.caption?.slice(0, 1024),
    })
  }

  return { chatId }
}

export function getActiveTelegramChatId(): string | null {
  return state.lastActiveChatId
}

export function getTelegramOutboundDebugState(): {
  ready: boolean
  ownerUserId: string | null
  ownerDmChatId: string | null
  lastActiveChatId: string | null
} {
  return {
    ready: isTelegramOutboundReady(),
    ownerUserId: state.ownerUserId,
    ownerDmChatId: state.ownerDmChatId,
    lastActiveChatId: state.lastActiveChatId,
  }
}
