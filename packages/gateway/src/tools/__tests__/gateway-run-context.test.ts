import { describe, expect, test, beforeEach } from 'bun:test'

import { registerTelegramOutbound, unregisterTelegramOutbound } from '../../telegram/outbound'
import { NOTIFY_TELEGRAM_TOOL } from '../telegram-notify-tools'
import { SCHEDULE_TASK_TOOL } from '../schedule-tools'
import { buildGatewayRunContext } from '../gateway-run-context'

import type { AgentDefinition } from '@siya/sdk'
import type { TelegramChannelConfig } from '@siya/common/types/gateway'

const baseAgents: AgentDefinition[] = [
  {
    id: 'base2-lite',
    displayName: 'Lite',
    toolNames: ['read_files', 'spawn_agents'],
  },
]

const telegramConfig: TelegramChannelConfig = {
  enabled: true,
  botToken: 'token',
  defaultAgent: 'base2',
  ownerUserId: '7498724465',
  allowFrom: ['tg:7498724465'],
  groupPolicy: 'allowlist',
  groups: { '*': { requireMention: true } },
  mentionAliases: ['siya'],
  streaming: 'partial',
}

describe('buildGatewayRunContext', () => {
  beforeEach(() => {
    unregisterTelegramOutbound()
  })

  test('adds schedule tools always', () => {
    const ctx = buildGatewayRunContext({
      agentDefinitions: baseAgents,
      source: 'cli',
    })

    const lite = ctx.agentDefinitions.find((def) => def.id === 'base2-lite')
    expect(lite?.toolNames).toContain(SCHEDULE_TASK_TOOL)
    expect(ctx.customToolDefinitions.some((def) => def.toolName === SCHEDULE_TASK_TOOL)).toBe(
      true,
    )
  })

  test('adds telegram tools when outbound is ready', () => {
    registerTelegramOutbound({
      api: { sendMessage: async () => ({ message_id: 1 }) } as never,
      config: telegramConfig,
    })

    const ctx = buildGatewayRunContext({
      agentDefinitions: baseAgents,
      source: 'cli',
      cwd: '/tmp/project',
    })

    const lite = ctx.agentDefinitions.find((def) => def.id === 'base2-lite')
    expect(lite?.toolNames).toContain(NOTIFY_TELEGRAM_TOOL)
    expect(
      ctx.customToolDefinitions.some((def) => def.toolName === NOTIFY_TELEGRAM_TOOL),
    ).toBe(true)
  })

  test('skips telegram tools when not configured and outbound is not ready', () => {
    const ctx = buildGatewayRunContext({
      agentDefinitions: baseAgents,
      source: 'cli',
      includeTelegram: false,
    })

    const lite = ctx.agentDefinitions.find((def) => def.id === 'base2-lite')
    expect(lite?.toolNames).not.toContain(NOTIFY_TELEGRAM_TOOL)
    expect(
      ctx.customToolDefinitions.some((def) => def.toolName === NOTIFY_TELEGRAM_TOOL),
    ).toBe(false)
  })

  test('includes telegram tools when telegramConfigured is true', () => {
    const ctx = buildGatewayRunContext({
      agentDefinitions: baseAgents,
      source: 'cli',
      telegramConfigured: true,
    })

    const lite = ctx.agentDefinitions.find((def) => def.id === 'base2-lite')
    expect(lite?.toolNames).toContain(NOTIFY_TELEGRAM_TOOL)
  })
})
