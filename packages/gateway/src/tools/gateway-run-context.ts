import { isTelegramGatewayConfigured } from '../config/telegram-configured'
import { isTelegramOutboundReady } from '../telegram/outbound'
import {
  createScheduleTools,
  injectScheduleToolsIntoAgents,
} from './schedule-tools'
import {
  createTelegramNotifyTools,
  injectTelegramToolsIntoAgents,
} from './telegram-notify-tools'

import type { AgentDefinition } from '@siya/sdk'
import type { CustomToolDefinition } from '@siya/sdk'

export type GatewayRunContextSource = 'cli' | 'gateway'

export function buildGatewayRunContext(params: {
  agentDefinitions: AgentDefinition[]
  cwd?: string
  defaultAgentId?: string
  source: GatewayRunContextSource
  /** When false, never attach Telegram notify tools */
  includeTelegram?: boolean
  /** When true, always attach Telegram tools (e.g. gateway.json has bot token) */
  telegramConfigured?: boolean
  /** Limit Telegram notify tools to specific agent ids (default: all) */
  telegramAgentIds?: string[] | 'all'
}): {
  agentDefinitions: AgentDefinition[]
  customToolDefinitions: CustomToolDefinition[]
} {
  const configured =
    params.telegramConfigured === true ||
    isTelegramGatewayConfigured(params.cwd)

  const telegramReady =
    params.includeTelegram !== false &&
    (configured || isTelegramOutboundReady())

  let agentDefinitions = injectScheduleToolsIntoAgents(
    params.agentDefinitions,
    'all',
  )

  if (telegramReady) {
    agentDefinitions = injectTelegramToolsIntoAgents(
      agentDefinitions,
      params.telegramAgentIds ?? 'all',
    )
  }

  const customToolDefinitions: CustomToolDefinition[] = [
    ...createScheduleTools({
      defaultAgentId: params.defaultAgentId,
      source: params.source,
    }),
    ...(telegramReady
      ? createTelegramNotifyTools({ cwd: params.cwd })
      : []),
  ]

  return { agentDefinitions, customToolDefinitions }
}
