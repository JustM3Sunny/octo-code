import { TELEGRAM_MAX_MESSAGE_LENGTH } from '@siya/common/constants/gateway'

import { safeJsonStringify } from '../util/safe-json'

import type { AgentOutput } from '@siya/common/types/session-state'
import type { Message } from '@siya/common/types/messages/siya-message'

export function extractTextFromAgentOutput(output: AgentOutput): string {
  if (output.type === 'error') {
    return output.message
  }

  if (output.type === 'structuredOutput') {
    if (output.value === null) {
      return 'Done.'
    }
    return safeJsonStringify(output.value)
  }

  if (output.type === 'lastMessage' || output.type === 'allMessages') {
    const messages = output.value as Message[]
    const parts: string[] = []

    for (const message of messages) {
      if (message.role === 'assistant' && Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === 'text' && typeof part.text === 'string') {
            parts.push(part.text)
          }
        }
      }
    }

    const text = parts.join('\n\n').trim()
    return text || 'Done.'
  }

  return 'Done.'
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function chunkTelegramMessage(
  text: string,
  maxLength = TELEGRAM_MAX_MESSAGE_LENGTH,
): string[] {
  if (text.length <= maxLength) {
    return [text]
  }

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf('\n', maxLength)
    if (splitAt < maxLength * 0.5) {
      splitAt = maxLength
    }
    chunks.push(remaining.slice(0, splitAt).trimEnd())
    remaining = remaining.slice(splitAt).trimStart()
  }

  if (remaining.length > 0) {
    chunks.push(remaining)
  }

  return chunks
}
