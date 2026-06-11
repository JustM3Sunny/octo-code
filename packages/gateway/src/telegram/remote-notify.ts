import { DEFAULT_GATEWAY_PORT } from '@siya/common/constants/gateway'

import { loadGatewayConfigSync } from '../config/load-config'
import { probeGatewayHealth } from '../util/port-utils'

import type { TelegramNotifyTarget } from './outbound'

export function getGatewayPort(cwd?: string): number {
  const config = loadGatewayConfigSync({ cwd, verbose: false })
  return config.gateway.port ?? DEFAULT_GATEWAY_PORT
}

export async function isRemoteGatewayHealthy(cwd?: string): Promise<boolean> {
  return probeGatewayHealth(getGatewayPort(cwd))
}

export async function sendTelegramViaGatewayHttp(params: {
  message: string
  target?: TelegramNotifyTarget
  chatId?: string
  cwd?: string
}): Promise<{ chatId: string; messageCount: number }> {
  const port = getGatewayPort(params.cwd)
  const response = await fetch(`http://127.0.0.1:${port}/api/telegram/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: params.message,
      target: params.target,
      chat_id: params.chatId,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      text || `Gateway notify failed (${response.status}). Is \`siya gateway\` running?`,
    )
  }

  const body = (await response.json()) as {
    ok?: boolean
    chatId?: string
    messageCount?: number
    error?: string
  }

  if (!body.ok || !body.chatId) {
    throw new Error(body.error ?? 'Gateway notify failed.')
  }

  return {
    chatId: body.chatId,
    messageCount: body.messageCount ?? 1,
  }
}

export async function sendTelegramFileViaGatewayHttp(params: {
  filePath: string
  caption?: string
  target?: TelegramNotifyTarget
  chatId?: string
  cwd?: string
}): Promise<{ chatId: string }> {
  const port = getGatewayPort(params.cwd)
  const response = await fetch(`http://127.0.0.1:${port}/api/telegram/send-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_path: params.filePath,
      caption: params.caption,
      target: params.target,
      chat_id: params.chatId,
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      text || `Gateway file send failed (${response.status}). Is \`siya gateway\` running?`,
    )
  }

  const body = (await response.json()) as {
    ok?: boolean
    chatId?: string
    error?: string
  }

  if (!body.ok || !body.chatId) {
    throw new Error(body.error ?? 'Gateway file send failed.')
  }

  return { chatId: body.chatId }
}
