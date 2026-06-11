import { useEffect } from 'react'

import { onScheduledTask } from '../utils/schedule-runtime'
import { getSystemMessage } from '../utils/message-history'
import { logger } from '../utils/logger'

import type { ChatMessage } from '../types/chat'

export function useScheduledTasks(options: {
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
}) {
  const { setMessages } = options

  useEffect(() => {
    return onScheduledTask((event) => {
      if (event.type === 'reminder') {
        const label = event.task.label ? `${event.task.label}: ` : ''
        setMessages((prev) => [
          ...prev,
          getSystemMessage(`⏰ Reminder — ${label}${event.task.prompt}`),
        ])
        return
      }

      if (event.type === 'agent_task_started') {
        const label = event.task.label ?? 'Scheduled task'
        setMessages((prev) => [
          ...prev,
          getSystemMessage(`🕒 Running scheduled task: ${label}`),
        ])
        return
      }

      if (event.type === 'agent_task_completed') {
        const label = event.task.label ?? 'Scheduled task'
        const summary = event.summary?.trim()
        setMessages((prev) => [
          ...prev,
          getSystemMessage(
            summary
              ? `✅ Scheduled task finished (${label}):\n${summary}`
              : `✅ Scheduled task finished: ${label}`,
          ),
        ])
        return
      }

      if (event.type === 'agent_task_failed') {
        setMessages((prev) => [
          ...prev,
          getSystemMessage(
            `❌ Scheduled task failed${event.task.label ? ` (${event.task.label})` : ''}: ${event.error}`,
          ),
        ])
        return
      }

      logger.debug({ event }, 'Unhandled scheduled task event')
    })
  }, [setMessages])
}
