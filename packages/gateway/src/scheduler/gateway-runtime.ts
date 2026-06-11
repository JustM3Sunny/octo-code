import { runScheduledTaskWithTelegramNotify } from '../tools/schedule-tools'
import { pruneExpiredSessions } from '../session/session-store'

import {
  registerScheduledTaskRunner,
  startScheduler,
  stopScheduler,
  unregisterScheduledTaskRunner,
} from './engine'

import type { SiyaBridge } from '../bridge/siya-bridge'

let gatewaySchedulerStarted = false

export async function startGatewayScheduler(
  bridge: SiyaBridge,
  defaultAgentId: string,
): Promise<void> {
  if (gatewaySchedulerStarted) {
    return
  }

  // Prune stale sessions on startup
  try {
    const pruned = await pruneExpiredSessions()
    if (pruned > 0) {
      console.log(`Pruned ${pruned} expired Telegram session(s)`)
    }
  } catch {
    // Non-critical — continue startup
  }

  registerScheduledTaskRunner(async (task) => {
    if (task.taskType === 'reminder') {
      return runScheduledTaskWithTelegramNotify(task, async () => ({
        summary: task.prompt,
      }))
    }

    const chatId = task.metadata?.telegram_chat_id ?? 'scheduled-task'
    const agentId = task.agentId ?? defaultAgentId
    const result = await bridge.processMessage({
      chatId,
      text: `[Scheduled task${task.label ? `: ${task.label}` : ''}] ${task.prompt}`,
      agentId,
    })

    return runScheduledTaskWithTelegramNotify(task, async () => ({
      summary: result.reply,
    }))
  })

  await startScheduler()
  gatewaySchedulerStarted = true
}

export async function stopGatewayScheduler(): Promise<void> {
  if (!gatewaySchedulerStarted) {
    return
  }
  await stopScheduler()
  unregisterScheduledTaskRunner()
  gatewaySchedulerStarted = false
}
