import { SiyaBridge } from './bridge/siya-bridge'
import { loadGatewayConfig } from './config/load-config'
import { startHealthServer } from './health-server'
import {
  startGatewayScheduler,
  stopGatewayScheduler,
} from './scheduler/gateway-runtime'
import { startTelegramBot } from './telegram/bot'
import { freeGatewayPortIfStale } from './util/port-utils'

import type { AgentDefinition } from '@siya/sdk'
import type { Logger } from '@siya/common/types/contracts/logger'

export type StartGatewayOptions = {
  cwd?: string
  apiKey: string
  agentDefinitions?: AgentDefinition[]
  logger?: Logger
  /** foreground = standalone `siya gateway`; embedded = alongside main CLI */
  mode?: 'foreground' | 'embedded'
}

export type GatewayHandle = {
  stop: () => Promise<void>
}

export async function startGateway(
  options: StartGatewayOptions,
): Promise<GatewayHandle> {
  const cwd = options.cwd ?? process.cwd()
  const config = await loadGatewayConfig({ cwd, verbose: true })

  const telegram = config.channels.telegram
  if (!telegram?.enabled) {
    throw new Error(
      'Telegram channel is not enabled. Run `siya gateway setup` first.',
    )
  }

  if (!telegram.botToken) {
    throw new Error(
      'Telegram bot token missing. Set TELEGRAM_BOT_TOKEN or channels.telegram.botToken in gateway.json.',
    )
  }

  await freeGatewayPortIfStale(config.gateway.port)

  const projectCwd = telegram.cwd ? telegram.cwd : cwd
  const bridge = await SiyaBridge.create({
    apiKey: options.apiKey,
    cwd: projectCwd,
    telegramConfig: telegram,
    agentDefinitions: options.agentDefinitions,
    logger: options.logger,
  })

  const health = await startHealthServer(config.gateway.port)
  const bot = await startTelegramBot({
    token: telegram.botToken,
    config: telegram,
    bridge,
    projectCwd,
  })

  const mode = options.mode ?? 'foreground'
  const log = (message: string) => {
    if (mode === 'embedded') {
      options.logger?.info({}, message)
    } else {
      console.log(message)
    }
  }

  if (mode === 'foreground') {
    await startGatewayScheduler(bridge, telegram.defaultAgent)
  }

  log(
    `Siya Telegram gateway started (agent=${telegram.defaultAgent}, cwd=${projectCwd}, bot=@${bot.botUsername ?? 'unknown'})`,
  )
  log(`Health: http://127.0.0.1:${config.gateway.port}/health`)
  if (mode === 'foreground') {
    console.log('Press Ctrl+C to stop.')
  }

  return {
    stop: async () => {
      await stopGatewayScheduler()
      await bot.stop()
      await health.close()
    },
  }
}

export async function getGatewayStatus(options?: {
  cwd?: string
}): Promise<{
  configured: boolean
  sourceFile?: string
  telegramEnabled: boolean
  hasToken: boolean
  defaultAgent?: string
  projectCwd?: string
}> {
  const config = await loadGatewayConfig({
    cwd: options?.cwd ?? process.cwd(),
    verbose: false,
  })

  const telegram = config.channels.telegram
  return {
    configured: Boolean(config._sourceFilePath),
    sourceFile: config._sourceFilePath || undefined,
    telegramEnabled: Boolean(telegram?.enabled),
    hasToken: Boolean(telegram?.botToken),
    defaultAgent: telegram?.defaultAgent,
    projectCwd: telegram?.cwd,
  }
}
