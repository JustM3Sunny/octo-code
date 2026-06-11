const DURATION_PATTERN =
  /^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

const UNIT_TO_MS: Record<string, number> = {
  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,
  m: 60_000,
  min: 60_000,
  mins: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hrs: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
}

export function parseDurationToMs(value: string): number {
  const trimmed = value.trim().toLowerCase()
  const match = trimmed.match(DURATION_PATTERN)
  if (!match) {
    throw new Error(
      `Invalid duration "${value}". Use formats like 30s, 5m, 2h, or 1d.`,
    )
  }

  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const multiplier = UNIT_TO_MS[unit]
  if (!multiplier || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid duration "${value}".`)
  }

  return Math.round(amount * multiplier)
}

export function parseRunAt(value: string): number {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `Invalid run_at "${value}". Use an ISO 8601 datetime like 2026-06-11T09:00:00+05:30.`,
    )
  }
  return timestamp
}

/**
 * Minimal cron support for common patterns (minute hour dom month dow).
 * Supports star wildcards, numbers, ranges, step values, and lists.
 */
function getLocalParts(date: Date, timezone?: string): {
  minute: number
  hour: number
  date: number
  month: number
  dayOfWeek: number
} {
  if (!timezone) {
    return {
      minute: date.getMinutes(),
      hour: date.getHours(),
      date: date.getDate(),
      month: date.getMonth() + 1,
      dayOfWeek: date.getDay(),
    }
  }
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hour12: false,
    })
    const parts = Object.fromEntries(
      fmt.formatToParts(date).map((p) => [p.type, p.value]),
    )
    return {
      minute: Number(parts.minute),
      hour: Number(parts.hour) === 24 ? 0 : Number(parts.hour),
      date: Number(parts.day),
      month: Number(parts.month),
      dayOfWeek: WEEKDAY_MAP[parts.weekday] ?? 0,
    }
  } catch {
    // Invalid timezone — fall back to local time
    return getLocalParts(date)
  }
}

export function getNextCronRun(expression: string, from = Date.now(), timezone?: string): number {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron "${expression}". Use 5 fields: minute hour day month weekday.`,
    )
  }

  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts
  const start = new Date(from)
  start.setSeconds(0, 0)
  start.setMinutes(start.getMinutes() + 1)

  for (let i = 0; i < 366 * 24 * 60; i++) {
    const candidate = new Date(start.getTime() + i * 60_000)
    const localParts = getLocalParts(candidate, timezone)
    if (
      matchesCronField(minuteExpr, localParts.minute, 0, 59) &&
      matchesCronField(hourExpr, localParts.hour, 0, 23) &&
      matchesCronField(domExpr, localParts.date, 1, 31) &&
      matchesCronField(monthExpr, localParts.month, 1, 12) &&
      matchesCronField(dowExpr, localParts.dayOfWeek, 0, 6)
    ) {
      return candidate.getTime()
    }
  }

  throw new Error(`Could not find next run for cron "${expression}".`)
}

function matchesCronField(
  expr: string,
  value: number,
  min: number,
  max: number,
): boolean {
  if (expr === '*') {
    return true
  }

  return expr.split(',').some((part) => {
    const stepMatch = part.match(/^(.+)\/(\d+)$/)
    const base = stepMatch ? stepMatch[1] : part
    const step = stepMatch ? Number(stepMatch[2]) : 1

    if (base === '*') {
      return (value - min) % step === 0
    }

    if (base.includes('-')) {
      const [start, end] = base.split('-').map(Number)
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return false
      }
      if (value < start || value > end) {
        return false
      }
      return (value - start) % step === 0
    }

    const exact = Number(base)
    return Number.isFinite(exact) && exact === value
  })
}

export function resolveNextRunAt(input: {
  runAt?: string
  delay?: string
  repeatInterval?: string
  cron?: string
  timezone?: string
  from?: number
}): { nextRunAt: number; scheduleKind: 'once' | 'recurring'; repeatIntervalMs?: number; cronExpression?: string } {
  const from = input.from ?? Date.now()
  const scheduleModes = [
    Boolean(input.runAt),
    Boolean(input.delay),
    Boolean(input.repeatInterval),
    Boolean(input.cron),
  ].filter(Boolean).length

  if (scheduleModes !== 1) {
    throw new Error(
      'Provide exactly one schedule: run_at, delay, repeat_interval, or cron.',
    )
  }

  if (input.runAt) {
    const nextRunAt = parseRunAt(input.runAt)
    if (nextRunAt <= from) {
      throw new Error('run_at must be in the future.')
    }
    return { nextRunAt, scheduleKind: 'once' }
  }

  if (input.delay) {
    const delayMs = parseDurationToMs(input.delay)
    return { nextRunAt: from + delayMs, scheduleKind: 'once' }
  }

  if (input.repeatInterval) {
    const repeatIntervalMs = parseDurationToMs(input.repeatInterval)
    return {
      nextRunAt: from + repeatIntervalMs,
      scheduleKind: 'recurring',
      repeatIntervalMs,
    }
  }

  if (input.cron) {
    const nextRunAt = getNextCronRun(input.cron, from, input.timezone)
    return {
      nextRunAt,
      scheduleKind: 'recurring',
      cronExpression: input.cron,
    }
  }

  throw new Error('No schedule provided.')
}
