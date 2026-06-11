import { describe, expect, test } from 'bun:test'

import {
  getNextCronRun,
  parseDurationToMs,
  resolveNextRunAt,
} from '../parse-schedule'

describe('parseDurationToMs', () => {
  test('parses common durations', () => {
    expect(parseDurationToMs('30s')).toBe(30_000)
    expect(parseDurationToMs('5m')).toBe(300_000)
    expect(parseDurationToMs('2h')).toBe(7_200_000)
    expect(parseDurationToMs('1d')).toBe(86_400_000)
  })
})

describe('resolveNextRunAt', () => {
  test('supports delay schedules', () => {
    const from = Date.parse('2026-06-11T10:00:00.000Z')
    const result = resolveNextRunAt({ delay: '5m', from })
    expect(result.scheduleKind).toBe('once')
    expect(result.nextRunAt).toBe(from + 300_000)
  })

  test('supports recurring intervals', () => {
    const from = Date.parse('2026-06-11T10:00:00.000Z')
    const result = resolveNextRunAt({ repeatInterval: '1h', from })
    expect(result.scheduleKind).toBe('recurring')
    expect(result.repeatIntervalMs).toBe(3_600_000)
  })
})

describe('getNextCronRun', () => {
  test('finds next daily run', () => {
    const from = Date.parse('2026-06-11T08:00:00.000Z')
    const next = getNextCronRun('0 9 * * *', from)
    const nextDate = new Date(next)
    expect(nextDate.getUTCHours()).toBe(9)
    expect(nextDate.getUTCMinutes()).toBe(0)
    expect(next).toBeGreaterThan(from)
  })
})
