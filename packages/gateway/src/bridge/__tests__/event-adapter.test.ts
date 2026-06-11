import { describe, expect, test } from 'bun:test'

import { TelegramEventAdapter } from '../event-adapter'

describe('TelegramEventAdapter', () => {
  test('allows live edit when only tool activity exists (no stream text)', () => {
    const adapter = new TelegramEventAdapter({
      minEditIntervalMs: 1000,
      minToolEditIntervalMs: 0,
    })
    const chatId = '123'

    adapter.onEvent(chatId, {
      type: 'tool_call',
      toolCallId: 't1',
      toolName: 'read_files',
      input: { paths: ['src/app.ts'] },
    })

    expect(adapter.getDisplayText(chatId)).toContain('Read src/app.ts')
    expect(adapter.shouldEdit(chatId)).toBe(true)
  })

  test('appends text events to stream', () => {
    const adapter = new TelegramEventAdapter()
    const chatId = '123'

    adapter.onEvent(chatId, { type: 'text', text: 'Hello ' })
    adapter.onEvent(chatId, { type: 'text', text: 'world' })

    expect(adapter.getDisplayText(chatId)).toBe('Hello world')
  })
})
