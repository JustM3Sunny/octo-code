export type ScheduledTaskType = 'reminder' | 'agent_task'

export type ScheduledTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'

export type ScheduleKind = 'once' | 'recurring'

export type ScheduledTask = {
  id: string
  label?: string
  prompt: string
  taskType: ScheduledTaskType
  scheduleKind: ScheduleKind
  /** Unix ms — next execution time */
  nextRunAt: number
  /** For recurring tasks */
  repeatIntervalMs?: number
  cronExpression?: string
  agentId?: string
  timezone?: string
  notifyTelegram?: boolean
  status: ScheduledTaskStatus
  createdAt: number
  updatedAt: number
  lastRunAt?: number
  lastRunResult?: string
  runCount: number
  maxRuns?: number
  source?: 'cli' | 'gateway' | 'telegram'
  metadata?: Record<string, string>
}

export type ScheduledTaskRunner = (task: ScheduledTask) => Promise<{
  summary?: string
}>

export type CreateScheduledTaskInput = {
  prompt: string
  taskType?: ScheduledTaskType
  label?: string
  runAt?: string
  delay?: string
  repeatInterval?: string
  cron?: string
  agentId?: string
  timezone?: string
  notifyTelegram?: boolean
  maxRuns?: number
  source?: ScheduledTask['source']
  metadata?: Record<string, string>
}
