import {
  freeGatewayPortIfStale,
  getGatewayStatus,
  loadGatewayConfig,
  probeGatewayHealth,
  spawnEmbeddedGatewayProcess,
  startGateway,
} from '@siya/gateway'

import { loadAgentDefinitions } from './local-agent-registry'
import { logger } from './logger'
import { getOpenRouterApiKey, resetSiyaClient } from './siya-client'

import type { GatewayHandle } from '@siya/gateway'

let embeddedGatewayHandle: GatewayHandle | null = null
let embeddedGatewayExternal = false

export function isEmbeddedGatewayRunning(): boolean {
  return embeddedGatewayHandle !== null
}

export async function startEmbeddedGatewayIfConfigured(params?: {
  cwd?: string
}): Promise<boolean> {
  if (embeddedGatewayHandle) {
    return true
  }

  const cwd = params?.cwd ?? process.cwd()
  const config = await loadGatewayConfig({ cwd, verbose: false })

  if (config.gateway.autoStart === false) {
    return false
  }

  const status = await getGatewayStatus({ cwd })
  if (!status.telegramEnabled || !status.hasToken) {
    return false
  }

  await freeGatewayPortIfStale(config.gateway.port)

  const alreadyHealthy = await probeGatewayHealth(config.gateway.port)
  if (alreadyHealthy) {
    embeddedGatewayHandle = {
      stop: async () => {
        embeddedGatewayHandle = null
        embeddedGatewayExternal = false
      },
    }
    embeddedGatewayExternal = true
    logger.info(
      {},
      `Telegram gateway already running (health: http://127.0.0.1:${config.gateway.port}/health)`,
    )
    return true
  }

  const apiKey = getOpenRouterApiKey() ?? 'local-zen-only'

  try {
    // Run gateway in a child process so the TUI event loop cannot block Telegram polling.
    const spawned = await spawnEmbeddedGatewayProcess({
      cwd,
      port: config.gateway.port,
    })
    embeddedGatewayHandle = {
      stop: spawned.stop,
    }
    embeddedGatewayExternal = false
    resetSiyaClient()
    logger.info(
      {},
      `Telegram gateway auto-started in background (health: http://127.0.0.1:${config.gateway.port}/health)`,
    )
    return true
  } catch (spawnError) {
    logger.warn(
      { error: spawnError },
      'Background Telegram gateway failed — trying in-process start',
    )
  }

  try {
    embeddedGatewayHandle = await startGateway({
      apiKey,
      cwd,
      agentDefinitions: loadAgentDefinitions(),
      logger,
      mode: 'embedded',
    })
    embeddedGatewayExternal = false
    resetSiyaClient()
    logger.info(
      {},
      `Telegram gateway auto-started (health: http://127.0.0.1:${config.gateway.port}/health)`,
    )
    return true
  } catch (error) {
    logger.warn(
      { error },
      'Telegram gateway auto-start failed — main agent will continue',
    )
    embeddedGatewayHandle = null
    embeddedGatewayExternal = false
    return false
  }
}

export async function stopEmbeddedGateway(): Promise<void> {
  if (!embeddedGatewayHandle) {
    return
  }

  if (embeddedGatewayExternal) {
    embeddedGatewayHandle = null
    embeddedGatewayExternal = false
    return
  }

  try {
    await embeddedGatewayHandle.stop()
    logger.info({}, 'Telegram gateway stopped')
  } catch (error) {
    logger.warn({ error }, 'Error stopping Telegram gateway')
  } finally {
    embeddedGatewayHandle = null
    embeddedGatewayExternal = false
  }
}
