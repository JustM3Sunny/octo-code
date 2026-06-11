import { normalizeAllowFromEntry } from './allowlist'
import { normalizeTelegramUserId } from './pairing'

import type { TelegramChannelConfig } from '@siya/common/types/gateway'

export type MessageEntityLike = {
  type: string
  offset: number
  length: number
  user?: { id?: number; is_bot?: boolean }
}

export function getOwnerUserId(config: TelegramChannelConfig): string | null {
  if (config.ownerUserId?.trim()) {
    return normalizeTelegramUserId(config.ownerUserId)
  }

  const firstAllowFrom = config.allowFrom[0]
  if (firstAllowFrom) {
    return normalizeAllowFromEntry(firstAllowFrom)
  }

  return null
}

export function isOwnerUser(
  config: TelegramChannelConfig,
  userId: string,
): boolean {
  const ownerId = getOwnerUserId(config)
  if (!ownerId) {
    return false
  }
  return normalizeTelegramUserId(userId) === ownerId
}

export function isGroupChatType(chatType: string | undefined): boolean {
  return chatType === 'group' || chatType === 'supergroup'
}

export function isGroupAllowed(
  config: TelegramChannelConfig,
  chatId: string,
): boolean {
  if (config.groupPolicy === 'disabled') {
    return false
  }

  if (config.groupPolicy === 'open') {
    return true
  }

  const groups = config.groups ?? {}
  const wildcard = groups['*']
  if (wildcard && wildcard.enabled !== false) {
    return true
  }

  const entry = groups[chatId]
  return Boolean(entry && entry.enabled !== false)
}

export function getGroupRequireMention(
  config: TelegramChannelConfig,
  chatId: string,
): boolean {
  const groups = config.groups ?? {}
  const entry = groups[chatId] ?? groups['*']
  return entry?.requireMention !== false
}

export function isBotMentioned(params: {
  text: string
  entities?: MessageEntityLike[]
  botUsername?: string
  mentionAliases?: string[]
}): boolean {
  const { text, entities, botUsername, mentionAliases = [] } = params
  const lowerText = text.toLowerCase()

  const handles = new Set<string>()
  if (botUsername) {
    handles.add(botUsername.toLowerCase())
  }
  for (const alias of mentionAliases) {
    handles.add(alias.replace(/^@/, '').toLowerCase())
  }

  for (const entity of entities ?? []) {
    if (entity.type === 'mention') {
      const mention = text
        .slice(entity.offset, entity.offset + entity.length)
        .replace(/^@/, '')
        .toLowerCase()
      if (handles.has(mention)) {
        return true
      }
    }

    if (entity.type === 'text_mention' && entity.user?.is_bot && botUsername) {
      return true
    }
  }

  for (const handle of handles) {
    if (lowerText.includes(`@${handle}`)) {
      return true
    }
  }

  return false
}

export function stripBotMention(params: {
  text: string
  botUsername?: string
  mentionAliases?: string[]
}): string {
  let cleaned = params.text
  const handles = new Set<string>()

  if (params.botUsername) {
    handles.add(params.botUsername)
  }
  for (const alias of params.mentionAliases ?? []) {
    handles.add(alias.replace(/^@/, ''))
  }

  for (const handle of handles) {
    cleaned = cleaned.replace(new RegExp(`@${handle}\\b`, 'gi'), '')
  }

  return cleaned.replace(/\s+/g, ' ').trim()
}

export function checkGroupMessageAccess(params: {
  config: TelegramChannelConfig
  chatId: string
  senderUserId: string
  text: string
  entities?: MessageEntityLike[]
  botUsername?: string
}): { allowed: boolean; cleanedText?: string } {
  const { config, chatId, senderUserId, text, entities, botUsername } = params

  if (!isGroupAllowed(config, chatId)) {
    return { allowed: false }
  }

  if (!isOwnerUser(config, senderUserId)) {
    return { allowed: false }
  }

  if (
    getGroupRequireMention(config, chatId) &&
    !isBotMentioned({
      text,
      entities,
      botUsername,
      mentionAliases: config.mentionAliases,
    })
  ) {
    return { allowed: false }
  }

  const cleanedText = stripBotMention({
    text,
    botUsername,
    mentionAliases: config.mentionAliases,
  })

  if (!cleanedText) {
    return { allowed: false }
  }

  return { allowed: true, cleanedText }
}
