import { MAX_AGENT_STEPS_DEFAULT } from '@siya/common/constants/agents'
import {
  buildGatewayRunContext,
  createScheduleTools,
  injectScheduleToolsIntoAgents,
  registerScheduledTaskRunner,
  runScheduledTaskWithTelegramNotify,
  startScheduler,
  stopScheduler,
  unregisterScheduledTaskRunner,
} from '@siya/gateway'

import { getSiyaClient } from './siya-client'
import { loadAgentDefinitions } from './local-agent-registry'
import { logger } from './logger'
import { getProjectRoot } from '../project-files'

import type { ScheduledTask } from '@siya/gateway'

export type ScheduledTaskEvent =
  | {
      type: 'reminder'
      task: ScheduledTask
    }
  | {
      type: 'agent_task_started'
      task: ScheduledTask
    }
  | {
      type: 'agent_task_completed'
      task: ScheduledTask
      summary?: string
    }
  | {
      type: 'agent_task_failed'
      task: ScheduledTask
      error: string
    }

type ScheduledTaskListener = (event: ScheduledTaskEvent) => void

const listeners = new Set<ScheduledTaskListener>()
let schedulerStarted = false

export function onScheduledTask(listener: ScheduledTaskListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emitScheduledTaskEvent(event: ScheduledTaskEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      logger.warn({ error }, 'Scheduled task listener failed')
    }
  }
}

export function getScheduleToolsForCli(defaultAgentId?: string) {
  return createScheduleTools({
    defaultAgentId,
    source: 'cli',
  })
}

export function injectScheduleTools(agentDefinitions = loadAgentDefinitions()) {
  return injectScheduleToolsIntoAgents(agentDefinitions)
}

export async function startCliScheduler(defaultAgentId = 'base2-lite'): Promise<void> {
  if (schedulerStarted) {
    return
  }

  registerScheduledTaskRunner(async (task) => {
    if (task.taskType === 'reminder') {
      emitScheduledTaskEvent({ type: 'reminder', task })
      return runScheduledTaskWithTelegramNotify(task, async () => ({
        summary: task.prompt,
      }))
    }

    emitScheduledTaskEvent({ type: 'agent_task_started', task })

    const client = await getSiyaClient()
    if (!client) {
      throw new Error('Siya client is not available to run scheduled task.')
    }

    try {
      const agentId = task.agentId ?? defaultAgentId
      const projectRoot = getProjectRoot()
      const gatewayContext = buildGatewayRunContext({
        agentDefinitions: loadAgentDefinitions(),
        cwd: projectRoot,
        defaultAgentId: agentId,
        source: 'cli',
      })

      const runState = await client.run({
        agent: agentId,
        cwd: projectRoot,
        prompt: `[Scheduled task${task.label ? `: ${task.label}` : ''}] ${task.prompt}`,
        agentDefinitions: gatewayContext.agentDefinitions,
        customToolDefinitions: gatewayContext.customToolDefinitions,
        maxAgentSteps: MAX_AGENT_STEPS_DEFAULT,
        handleEvent: () => {},
      })

      const output =
        typeof runState.output === 'string'
          ? runState.output
          : JSON.stringify(runState.output)

      emitScheduledTaskEvent({
        type: 'agent_task_completed',
        task,
        summary: output,
      })

      return runScheduledTaskWithTelegramNotify(task, async () => ({
        summary: output,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      emitScheduledTaskEvent({
        type: 'agent_task_failed',
        task,
        error: message,
      })
      throw error
    }
  })

  await startScheduler()
  schedulerStarted = true
  logger.info({}, 'Task scheduler started')
}

export async function stopCliScheduler(): Promise<void> {
  if (!schedulerStarted) {
    return
  }
  await stopScheduler()
  unregisterScheduledTaskRunner()
  schedulerStarted = false
}
