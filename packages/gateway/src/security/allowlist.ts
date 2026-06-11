import { normalizeTelegramUserId } from './pairing'

import type { TelegramChannelConfig } from '@siya/common/types/gateway'

export function normalizeAllowFromEntry(entry: string): string {
  return normalizeTelegramUserId(entry.replace(/^@/, ''))
}

export function isUserInAllowlist(
  allowFrom: string[],
  userId: string,
): boolean {
  if (allowFrom.includes('*')) {
    return true
  }

  const normalizedUserId = normalizeTelegramUserId(userId)
  return allowFrom.some(
    (entry) => normalizeAllowFromEntry(entry) === normalizedUserId,
  )
}

export function checkDmAccess(params: {
  config: TelegramChannelConfig
  userId: string
  isApproved: boolean
}): { allowed: boolean; reason?: 'pairing_required' | 'not_in_allowlist' } {
  const { config, userId, isApproved } = params

  if (config.dmPolicy === 'open') {
    if (
      config.allowFrom.length > 0 &&
      !isUserInAllowlist(config.allowFrom, userId)
    ) {
      return { allowed: false, reason: 'not_in_allowlist' }
    }
    return { allowed: true }
  }

  if (config.dmPolicy === 'allowlist') {
    if (isUserInAllowlist(config.allowFrom, userId)) {
      return { allowed: true }
    }
    return { allowed: false, reason: 'not_in_allowlist' }
  }

  if (isApproved || isUserInAllowlist(config.allowFrom, userId)) {
    return { allowed: true }
  }

  return { allowed: false, reason: 'pairing_required' }
}
