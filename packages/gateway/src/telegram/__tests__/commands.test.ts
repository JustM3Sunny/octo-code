import { describe, expect, test } from 'bun:test'

import { TELEGRAM_COMMAND_ALIASES } from '../command-catalog'
import {
  parseBotCommand,
  TELEGRAM_BOT_COMMANDS,
  normalizeTelegramCommand,
} from '../commands'

describe('telegram commands', () => {
  test('registers CLI-parity commands', () => {
    const names = TELEGRAM_BOT_COMMANDS.map((cmd) => cmd.command)
    expect(names).toContain('help')
    expect(names).toContain('init')
    expect(names).toContain('interview')
    expect(names).toContain('plan')
    expect(names).toContain('review')
    expect(names).toContain('mode_lite')
    expect(names).toContain('schedule')
    expect(names).toContain('skill')
    expect(names).toContain('bash')
    expect(names.length).toBeGreaterThanOrEqual(30)
  })

  test('normalizes CLI mode colon syntax', () => {
    expect(normalizeTelegramCommand('mode:lite')).toBe('mode_lite')
    expect(TELEGRAM_COMMAND_ALIASES['mode:max']).toBe('mode_max')
  })

  test('parses aliases via normalize', () => {
    expect(parseBotCommand('/clear')).toEqual({
      command: 'new',
      args: '',
    })
    expect(parseBotCommand('/mode:lite')).toEqual({
      command: 'mode_lite',
      args: '',
    })
  })

  test('parses command with args', () => {
    expect(parseBotCommand('/plan add OAuth login')).toEqual({
      command: 'plan',
      args: 'add OAuth login',
    })
  })
})
