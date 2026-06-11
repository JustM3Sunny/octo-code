import { describe, expect, test } from 'bun:test'

import { gatewayFileSchema } from '@siya/common/types/gateway'
import { chunkTelegramMessage } from '../../telegram/format'

describe('gateway config schema', () => {
  test('parses minimal telegram config', () => {
    const parsed = gatewayFileSchema.parse({
      channels: {
        telegram: {
          enabled: true,
          botToken: '$TELEGRAM_BOT_TOKEN',
        },
      },
    })

    expect(parsed.channels.telegram?.dmPolicy).toBe('pairing')
    expect(parsed.channels.telegram?.defaultAgent).toBe('base2')
    expect(parsed.gateway.port).toBe(8787)
  })
})

describe('telegram message formatting', () => {
  test('chunks long messages', () => {
    const text = 'a'.repeat(5000)
    const chunks = chunkTelegramMessage(text, 4096)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join('').length).toBe(5000)
  })
})
