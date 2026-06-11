import { z } from 'zod/v4'

import { getCustomToolDefinition } from '@siya/sdk'

import {
  cancelScheduledTask,
  createScheduledTask,
  listScheduledTasks,
} from '../scheduler/engine'
import { isTelegramGatewayConfigured } from '../config/telegram-configured'
import {
  getActiveTelegramChatId,
  isTelegramOutboundReady,
  sendTelegramText,
} from '../telegram/outbound'
import { isRemoteGatewayHealthy, sendTelegramViaGatewayHttp } from '../telegram/remote-notify'

import type { AgentDefinition } from '@siya/sdk'
import type { CustomToolDefinition } from '@siya/sdk'

export const SCHEDULE_TASK_TOOL = 'schedule_task'
export const LIST_SCHEDULED_TASKS_TOOL = 'list_scheduled_tasks'
export const CANCEL_SCHEDULED_TASK_TOOL = 'cancel_scheduled_task'

const scheduleTaskSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      'What to do when the task runs. For reminders, this is the reminder text. For agent tasks, this is the instruction the agent should execute.',
    ),
  task_type: z
    .enum(['reminder', 'agent_task'])
    .optional()
    .describe(
      'reminder = notify the user only. agent_task = run the agent to complete work (default).',
    ),
  label: z
    .string()
    .optional()
    .describe('Short human-readable label, e.g. "Daily standup reminder".'),
  run_at: z
    .string()
    .optional()
    .describe(
      'Run once at a specific time. ISO 8601 datetime, e.g. 2026-06-11T09:00:00+05:30. Use when the user says "at 9 AM tomorrow".',
    ),
  delay: z
    .string()
    .optional()
    .describe(
      'Run once after a delay from now. Examples: 30s, 5m, 2h, 1d. Use when the user says "in 10 minutes".',
    ),
  repeat_interval: z
    .string()
    .optional()
    .describe(
      'Recurring interval from each run. Examples: 5m, 1h, 1d. Use for "every 5 minutes" or "daily".',
    ),
  cron: z
    .string()
    .optional()
    .describe(
      'Cron expression (minute hour day month weekday). Example: "0 9 * * *" for daily at 9:00.',
    ),
  agent_id: z
    .string()
    .optional()
    .describe('Agent to use for agent_task runs. Defaults to the current agent.'),
  notify_telegram: z
    .boolean()
    .optional()
    .describe(
      'Also send reminder/task output to Telegram when the gateway is running.',
    ),
  max_runs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Stop recurring tasks after this many executions.'),
})

function formatTaskForAgent(task: Awaited<ReturnType<typeof createScheduledTask>>) {
  return {
    id: task.id,
    label: task.label ?? null,
    taskType: task.taskType,
    scheduleKind: task.scheduleKind,
    nextRunAt: new Date(task.nextRunAt).toISOString(),
    status: task.status,
    repeatIntervalMs: task.repeatIntervalMs ?? null,
    cronExpression: task.cronExpression ?? null,
    agentId: task.agentId ?? null,
    notifyTelegram: task.notifyTelegram ?? false,
    prompt: task.prompt,
  }
}

export function createScheduleTools(options?: {
  defaultAgentId?: string
  source?: 'cli' | 'gateway' | 'telegram'
}): CustomToolDefinition[] {
  const scheduleTask = getCustomToolDefinition({
    toolName: SCHEDULE_TASK_TOOL,
    description: `Schedule a future task or reminder. Use whenever the user wants something done later — reminders, follow-ups, recurring checks, cron-style jobs, or "do this at 9 PM".

Provide exactly ONE schedule: run_at (specific datetime), delay (from now), repeat_interval (every X), or cron (cron expression).

Examples:
- "Remind me in 30 minutes to take a break" → delay: "30m", task_type: "reminder"
- "Tomorrow at 9 AM run the tests" → run_at: ISO datetime, task_type: "agent_task"
- "Every day at 9 AM remind me about standup" → cron: "0 9 * * *", task_type: "reminder"
- "Check deploy status every 5 minutes" → repeat_interval: "5m", task_type: "agent_task"

Works in CLI and Telegram gateway. Tasks persist across restarts.`,
    endsAgentStep: false,
    inputSchema: scheduleTaskSchema,
    exampleInputs: [
      {
        prompt: 'Remind me to review the PR',
        task_type: 'reminder',
        delay: '30m',
        label: 'PR review reminder',
      },
      {
        prompt: 'Run the test suite and report failures',
        task_type: 'agent_task',
        run_at: '2026-06-12T09:00:00+05:30',
        label: 'Morning test run',
      },
    ],
    execute: async (input) => {
      const activeChatId = getActiveTelegramChatId()
      const gatewayAvailable =
        isTelegramOutboundReady() || isTelegramGatewayConfigured()
      const notifyTelegram =
        input.notify_telegram ??
        (gatewayAvailable && (options?.source === 'gateway' || Boolean(activeChatId)))

      const task = await createScheduledTask({
        prompt: input.prompt,
        taskType: input.task_type,
        label: input.label,
        runAt: input.run_at,
        delay: input.delay,
        repeatInterval: input.repeat_interval,
        cron: input.cron,
        agentId: input.agent_id ?? options?.defaultAgentId,
        notifyTelegram,
        maxRuns: input.max_runs,
        source: options?.source,
        metadata: activeChatId
          ? { telegram_chat_id: activeChatId }
          : undefined,
      })

      return [
        {
          type: 'json',
          value: {
            ok: true,
            message: `Scheduled ${task.taskType} "${task.label ?? task.id}" for ${new Date(task.nextRunAt).toLocaleString()}`,
            task: formatTaskForAgent(task),
          },
        },
      ]
    },
  })

  const listScheduledTasksTool = getCustomToolDefinition({
    toolName: LIST_SCHEDULED_TASKS_TOOL,
    description:
      'List pending and running scheduled tasks. Use to show the user what is queued, verify a schedule was created, or before cancelling tasks.',
    endsAgentStep: false,
    inputSchema: z.object({
      include_completed: z
        .boolean()
        .optional()
        .describe('Include completed, failed, and cancelled tasks.'),
    }),
    exampleInputs: [{ include_completed: false }],
    execute: async (input) => {
      const tasks = await listScheduledTasks({
        includeCompleted: input.include_completed,
      })

      return [
        {
          type: 'json',
          value: {
            count: tasks.length,
            tasks: tasks.map((task) => ({
              id: task.id,
              label: task.label ?? null,
              taskType: task.taskType,
              scheduleKind: task.scheduleKind,
              nextRunAt: new Date(task.nextRunAt).toISOString(),
              status: task.status,
              prompt: task.prompt,
              repeatIntervalMs: task.repeatIntervalMs ?? null,
              cronExpression: task.cronExpression ?? null,
              runCount: task.runCount,
              lastRunAt: task.lastRunAt
                ? new Date(task.lastRunAt).toISOString()
                : null,
            })),
          },
        },
      ]
    },
  })

  const cancelScheduledTaskTool = getCustomToolDefinition({
    toolName: CANCEL_SCHEDULED_TASK_TOOL,
    description:
      'Cancel a scheduled task by id. Use when the user no longer wants a reminder or recurring job.',
    endsAgentStep: false,
    inputSchema: z.object({
      task_id: z.string().min(1).describe('Task id from schedule_task or list_scheduled_tasks'),
    }),
    exampleInputs: [{ task_id: '00000000-0000-4000-8000-000000000000' }],
    execute: async (input) => {
      const task = await cancelScheduledTask(input.task_id)
      if (!task) {
        return [
          {
            type: 'json',
            value: {
              ok: false,
              message: `No scheduled task found with id ${input.task_id}.`,
            },
          },
        ]
      }

      return [
        {
          type: 'json',
          value: {
            ok: true,
            message: `Cancelled task ${task.label ?? task.id}`,
            task: formatTaskForAgent(task),
          },
        },
      ]
    },
  })

  return [scheduleTask, listScheduledTasksTool, cancelScheduledTaskTool]
}

export function injectScheduleToolsIntoAgents(
  agentDefinitions: AgentDefinition[],
  agentIds: string[] | 'all' = 'all',
): AgentDefinition[] {
  const ids =
    agentIds === 'all'
      ? new Set(agentDefinitions.map((def) => def.id))
      : new Set(agentIds)

  const extraTools = [
    SCHEDULE_TASK_TOOL,
    LIST_SCHEDULED_TASKS_TOOL,
    CANCEL_SCHEDULED_TASK_TOOL,
  ]

  return agentDefinitions.map((definition) => {
    if (!ids.has(definition.id)) {
      return definition
    }

    const existing = definition.toolNames ?? []
    const merged = [...existing]
    for (const tool of extraTools) {
      if (!merged.includes(tool)) {
        merged.push(tool)
      }
    }

    return {
      ...definition,
      toolNames: merged,
    }
  })
}

export async function runScheduledTaskWithTelegramNotify(
  task: Awaited<ReturnType<typeof createScheduledTask>>,
  run: () => Promise<{ summary?: string }>,
): Promise<{ summary?: string }> {
  const result = await run()

  if (
    task.notifyTelegram &&
    (task.taskType === 'reminder' || result.summary)
  ) {
    const message =
      task.taskType === 'reminder'
        ? `⏰ Reminder: ${task.prompt}`
        : `✅ Scheduled task${task.label ? ` (${task.label})` : ''}:\n${result.summary ?? task.prompt}`

    try {
      if (isTelegramOutboundReady()) {
        await sendTelegramText({ message, target: 'owner_dm' })
      } else if (await isRemoteGatewayHealthy()) {
        await sendTelegramViaGatewayHttp({ message, target: 'owner_dm' })
      }
    } catch {
      // Telegram delivery is best-effort for scheduled tasks.
    }
  }

  return result
}
