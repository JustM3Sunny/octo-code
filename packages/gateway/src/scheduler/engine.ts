import { randomUUID } from 'crypto'

import { getNextCronRun } from './parse-schedule'
import { resolveNextRunAt } from './parse-schedule'
import { loadScheduledTasks, saveScheduledTasks } from './store'

import type {
  CreateScheduledTaskInput,
  ScheduledTask,
  ScheduledTaskRunner,
} from './types'

const TICK_INTERVAL_MS = 15_000

let runner: ScheduledTaskRunner | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null
let isTicking = false
let started = false

export function registerScheduledTaskRunner(nextRunner: ScheduledTaskRunner): void {
  runner = nextRunner
}

export function unregisterScheduledTaskRunner(): void {
  runner = null
}

export function isSchedulerRunning(): boolean {
  return started
}

export async function startScheduler(): Promise<void> {
  if (started) {
    return
  }
  started = true
  await tickScheduler()
  tickTimer = setInterval(() => {
    void tickScheduler()
  }, TICK_INTERVAL_MS)
}

export async function stopScheduler(): Promise<void> {
  started = false
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

export async function createScheduledTask(
  input: CreateScheduledTaskInput,
): Promise<ScheduledTask> {
  const now = Date.now()
  const schedule = resolveNextRunAt({
    runAt: input.runAt,
    delay: input.delay,
    repeatInterval: input.repeatInterval,
    cron: input.cron,
    timezone: input.timezone,
    from: now,
  })

  const task: ScheduledTask = {
    id: randomUUID(),
    label: input.label?.trim() || undefined,
    prompt: input.prompt.trim(),
    taskType: input.taskType ?? 'agent_task',
    scheduleKind: schedule.scheduleKind,
    nextRunAt: schedule.nextRunAt,
    repeatIntervalMs: schedule.repeatIntervalMs,
    cronExpression: schedule.cronExpression,
    agentId: input.agentId?.trim() || undefined,
    timezone: input.timezone?.trim() || undefined,
    notifyTelegram: input.notifyTelegram,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    runCount: 0,
    maxRuns: input.maxRuns,
    source: input.source,
    metadata: input.metadata,
  }

  const tasks = await loadScheduledTasks()
  tasks.push(task)
  await saveScheduledTasks(tasks)
  return task
}

export async function listScheduledTasks(options?: {
  includeCompleted?: boolean
}): Promise<ScheduledTask[]> {
  const tasks = await loadScheduledTasks()
  if (options?.includeCompleted) {
    return tasks.sort((a, b) => a.nextRunAt - b.nextRunAt)
  }
  return tasks
    .filter((task) => task.status === 'pending' || task.status === 'running')
    .sort((a, b) => a.nextRunAt - b.nextRunAt)
}

export async function cancelScheduledTask(taskId: string): Promise<ScheduledTask | null> {
  const tasks = await loadScheduledTasks()
  const index = tasks.findIndex((task) => task.id === taskId)
  if (index === -1) {
    return null
  }

  const task = tasks[index]
  if (task.status === 'cancelled' || task.status === 'completed') {
    return task
  }

  const updated: ScheduledTask = {
    ...task,
    status: 'cancelled',
    updatedAt: Date.now(),
  }
  tasks[index] = updated
  await saveScheduledTasks(tasks)
  return updated
}

async function tickScheduler(): Promise<void> {
  if (isTicking || !runner) {
    return
  }

  isTicking = true
  try {
    const now = Date.now()
    const tasks = await loadScheduledTasks()
    let changed = false

    for (const task of tasks) {
      if (task.status !== 'pending') {
        continue
      }
      if (task.nextRunAt > now) {
        continue
      }

      const index = tasks.findIndex((entry) => entry.id === task.id)
      if (index === -1) {
        continue
      }

      tasks[index] = {
        ...task,
        status: 'running',
        updatedAt: now,
      }
      changed = true
      await saveScheduledTasks(tasks)

      try {
        const result = await runner(task)
        await markTaskAfterRun(task.id, {
          success: true,
          summary: result.summary,
        })
      } catch (error) {
        await markTaskAfterRun(task.id, {
          success: false,
          summary: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (changed) {
      await saveScheduledTasks(await loadScheduledTasks())
    }
  } finally {
    isTicking = false
  }
}

async function markTaskAfterRun(
  taskId: string,
  result: { success: boolean; summary?: string },
): Promise<void> {
  const tasks = await loadScheduledTasks()
  const index = tasks.findIndex((task) => task.id === taskId)
  if (index === -1) {
    return
  }

  const task = tasks[index]
  const now = Date.now()
  const nextRunCount = task.runCount + 1
  const reachedMaxRuns =
    typeof task.maxRuns === 'number' && nextRunCount >= task.maxRuns

  if (
    task.scheduleKind === 'recurring' &&
    !reachedMaxRuns &&
    (task.repeatIntervalMs || task.cronExpression)
  ) {
    const nextRunAt = task.cronExpression
      ? getNextCronRun(task.cronExpression, now, task.timezone)
      : now + (task.repeatIntervalMs ?? 0)

    tasks[index] = {
      ...task,
      status: 'pending',
      nextRunAt,
      lastRunAt: now,
      lastRunResult: result.summary,
      runCount: nextRunCount,
      updatedAt: now,
    }
  } else {
    tasks[index] = {
      ...task,
      status: result.success ? 'completed' : 'failed',
      lastRunAt: now,
      lastRunResult: result.summary,
      runCount: nextRunCount,
      updatedAt: now,
    }
  }

  await saveScheduledTasks(tasks)
}
