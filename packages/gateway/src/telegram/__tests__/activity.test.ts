import { describe, expect, test } from 'bun:test'

import {
  TelegramActivityTracker,
  formatToolCallLabel,
} from '../activity'

describe('telegram activity', () => {
  test('formats tool labels', () => {
    expect(
      formatToolCallLabel('read_files', {
        filePaths: ['src/a.ts', 'src/b.ts'],
      }),
    ).toContain('Read')
    expect(
      formatToolCallLabel('run_terminal_command', {
        command: 'npm test',
      }),
    ).toContain('npm test')
  })

  test('tracks tool calls and results', () => {
    const tracker = new TelegramActivityTracker()
    tracker.onEvent({
      type: 'tool_call',
      toolCallId: 't1',
      toolName: 'read_files',
      input: { paths: ['README.md'] },
    })
    tracker.onEvent({
      type: 'tool_result',
      toolCallId: 't1',
      toolName: 'read_files',
      output: [{ type: 'text', text: 'ok' }],
    })

    const formatted = tracker.formatFullMessage('Here is the answer.')
    expect(formatted).toContain('✓ Read README.md')
    expect(formatted).toContain('Here is the answer.')
  })
})
