import { describe, expect, test } from 'bun:test'

import { parseArgs } from '../cli-args'

describe('parseArgs gateway commands', () => {
  test('parses gateway status', () => {
    const result = parseArgs({
      argv: ['node', 'siya', 'gateway', 'status'],
    })

    expect(result.command).toBe('gateway')
    expect(result.subcommand).toBe('status')
    expect(result.initialPrompt).toBeNull()
  })

  test('parses pairing approve', () => {
    const result = parseArgs({
      argv: ['node', 'siya', 'pairing', 'approve', 'telegram', 'ABC12345'],
    })

    expect(result.command).toBe('pairing')
    expect(result.subcommand).toBe('approve')
    expect(result.commandArgs).toEqual(['telegram', 'ABC12345'])
  })

  test('parses normal prompt', () => {
    const result = parseArgs({
      argv: ['node', 'siya', 'fix', 'the', 'bug'],
    })

    expect(result.command).toBeUndefined()
    expect(result.initialPrompt).toBe('fix the bug')
  })
})
