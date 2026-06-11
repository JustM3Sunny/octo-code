import fs from 'fs'
import fsPromises from 'fs/promises'
import os from 'os'
import path from 'path'

import {
  DEFAULT_GATEWAY_PORT,
  DEFAULT_TELEGRAM_AGENT,
  GATEWAY_CONFIG_FILE,
  TELEGRAM_ALLOWED_USERS_ENV,
  TELEGRAM_BOT_TOKEN_ENV,
} from '@siya/common/constants/gateway'
import { gatewayFileSchema, telegramChannelSchema } from '@siya/common/types/gateway'

import { resolveEnvReferences } from './resolve-env'

import type {
  GatewayFileConfig,
  LoadedGatewayConfig,
  TelegramChannelConfig,
} from '@siya/common/types/gateway'

export function getConfigDir(): string {
  const override = process.env.SIYA_CONFIG_DIR?.trim()
  if (override) {
    return override
  }
  return path.join(os.homedir(), '.config', 'siya')
}

export function getDefaultGatewayConfigDirs(cwd = process.cwd()): string[] {
  const globalDir = getConfigDir()
  const projectAgents = path.join(cwd, '.agents')
  const parentAgents = path.join(cwd, '..', '.agents')
  return [globalDir, parentAgents, projectAgents]
}

function applyEnvFallbacks(config: GatewayFileConfig): GatewayFileConfig {
  let telegram = config.channels.telegram

  const botTokenFromEnv = process.env[TELEGRAM_BOT_TOKEN_ENV]?.trim()
  const allowedUsersEnv = process.env[TELEGRAM_ALLOWED_USERS_ENV]?.trim()

  if (!telegram && botTokenFromEnv) {
    const allowFrom = allowedUsersEnv
      ? allowedUsersEnv
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
          .map((id) => (id.startsWith('tg:') ? id : `tg:${id}`))
      : []

    telegram = telegramChannelSchema.parse({
      enabled: true,
      botToken: botTokenFromEnv,
      dmPolicy: allowFrom.length > 0 ? 'allowlist' : 'pairing',
      allowFrom,
      ownerUserId: allowFrom[0]?.replace(/^tg:/, ''),
      defaultAgent: DEFAULT_TELEGRAM_AGENT,
    })
  }

  if (!telegram) {
    return config
  }

  const botToken =
    telegram.botToken?.trim() ||
    botTokenFromEnv ||
    undefined

  let allowFrom = [...telegram.allowFrom]
  if (allowedUsersEnv && allowFrom.length === 0) {
    allowFrom = allowedUsersEnv
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => (id.startsWith('tg:') ? id : `tg:${id}`))
  }

  const ownerUserId =
    telegram.ownerUserId?.trim() ||
    allowFrom[0]?.replace(/^tg:/, '') ||
    undefined

  const dmPolicy =
    ownerUserId && telegram.dmPolicy === 'pairing'
      ? 'allowlist'
      : telegram.dmPolicy

  return {
    ...config,
    channels: {
      ...config.channels,
      telegram: {
        ...telegram,
        botToken,
        allowFrom,
        ownerUserId,
        dmPolicy,
      },
    },
    gateway: {
      port: config.gateway?.port ?? DEFAULT_GATEWAY_PORT,
      logLevel: config.gateway?.logLevel ?? 'info',
      autoStart: config.gateway?.autoStart ?? true,
    },
  }
}

function resolveTelegramSecrets(
  telegram: TelegramChannelConfig,
): TelegramChannelConfig {
  const botToken = telegram.botToken
    ? resolveEnvReferences(telegram.botToken, 'channels.telegram.botToken')
    : undefined

  return {
    ...telegram,
    botToken,
  }
}

export function mergeGatewayConfigs(
  configs: Array<{ config: GatewayFileConfig; source: string }>,
): LoadedGatewayConfig {
  const merged: LoadedGatewayConfig = {
    channels: {},
    gateway: { port: 8787, logLevel: 'info', autoStart: true },
    _sourceFilePath: '',
  }

  for (const { config, source } of configs) {
    if (config.gateway) {
      merged.gateway = { ...merged.gateway, ...config.gateway }
    }
    if (config.channels.telegram) {
      merged.channels.telegram = {
        ...(merged.channels.telegram ?? {}),
        ...config.channels.telegram,
      } as TelegramChannelConfig
      merged._sourceFilePath = source
    }
  }

  const withEnv = applyEnvFallbacks(merged)
  if (withEnv.channels.telegram) {
    try {
      withEnv.channels.telegram = resolveTelegramSecrets(withEnv.channels.telegram)
    } catch {
      withEnv.channels.telegram = {
        ...withEnv.channels.telegram,
        botToken: undefined,
      }
    }
  }

  return {
    ...withEnv,
    _sourceFilePath: merged._sourceFilePath,
  }
}

export async function loadGatewayConfig(options: {
  cwd?: string
  verbose?: boolean
}): Promise<LoadedGatewayConfig> {
  const cwd = options.cwd ?? process.cwd()
  const dirs = getDefaultGatewayConfigDirs(cwd)
  const loaded: Array<{ config: GatewayFileConfig; source: string }> = []

  for (const dir of dirs) {
    const configPath = path.join(dir, GATEWAY_CONFIG_FILE)
    try {
      await fsPromises.access(configPath)
    } catch {
      continue
    }

    try {
      const content = await fsPromises.readFile(configPath, 'utf8')
      const raw = JSON.parse(content)
      const parsed = gatewayFileSchema.safeParse(raw)
      if (!parsed.success) {
        if (options.verbose) {
          console.error(
            `Invalid ${GATEWAY_CONFIG_FILE} at ${configPath}: ${parsed.error.message}`,
          )
        }
        continue
      }
      loaded.push({ config: parsed.data, source: configPath })
    } catch (error) {
      if (options.verbose) {
        console.error(
          `Error loading ${configPath}:`,
          error instanceof Error ? error.message : error,
        )
      }
    }
  }

  if (loaded.length === 0) {
    return applyEnvFallbacks(
      gatewayFileSchema.parse({}),
    ) as LoadedGatewayConfig
  }

  return mergeGatewayConfigs(loaded)
}

export function loadGatewayConfigSync(options: {
  cwd?: string
  verbose?: boolean
}): LoadedGatewayConfig {
  const cwd = options.cwd ?? process.cwd()
  const dirs = getDefaultGatewayConfigDirs(cwd)
  const loaded: Array<{ config: GatewayFileConfig; source: string }> = []

  for (const dir of dirs) {
    const configPath = path.join(dir, GATEWAY_CONFIG_FILE)
    if (!fs.existsSync(configPath)) {
      continue
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8')
      const raw = JSON.parse(content)
      const parsed = gatewayFileSchema.safeParse(raw)
      if (!parsed.success) {
        if (options.verbose) {
          console.error(
            `Invalid ${GATEWAY_CONFIG_FILE} at ${configPath}: ${parsed.error.message}`,
          )
        }
        continue
      }
      loaded.push({ config: parsed.data, source: configPath })
    } catch (error) {
      if (options.verbose) {
        console.error(
          `Error loading ${configPath}:`,
          error instanceof Error ? error.message : error,
        )
      }
    }
  }

  if (loaded.length === 0) {
    return applyEnvFallbacks(
      gatewayFileSchema.parse({}),
    ) as LoadedGatewayConfig
  }

  return mergeGatewayConfigs(loaded)
}

export async function saveGatewayConfig(
  config: GatewayFileConfig,
  targetDir = getConfigDir(),
): Promise<string> {
  await fsPromises.mkdir(targetDir, { recursive: true })
  const configPath = path.join(targetDir, GATEWAY_CONFIG_FILE)
  await fsPromises.writeFile(
    configPath,
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  )
  return configPath
}
