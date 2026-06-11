import { loadGatewayConfigSync } from './load-config'

export function isTelegramGatewayConfigured(cwd?: string): boolean {
  const config = loadGatewayConfigSync({
    cwd: cwd ?? process.cwd(),
    verbose: false,
  })
  const telegram = config.channels.telegram
  return Boolean(telegram?.enabled && telegram.botToken?.trim())
}
