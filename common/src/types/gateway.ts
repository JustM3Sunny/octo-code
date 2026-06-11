import { z } from 'zod/v4'

import {
  DEFAULT_GATEWAY_PORT,
  DEFAULT_TELEGRAM_AGENT,
} from '../constants/gateway'

export const dmPolicySchema = z.enum(['pairing', 'allowlist', 'open'])
export type DmPolicy = z.infer<typeof dmPolicySchema>

export const groupPolicySchema = z.enum(['disabled', 'allowlist', 'open'])
export type GroupPolicy = z.infer<typeof groupPolicySchema>

export const streamingModeSchema = z.enum(['off', 'partial'])
export type StreamingMode = z.infer<typeof streamingModeSchema>

export const telegramGroupEntrySchema = z.strictObject({
  requireMention: z.boolean().default(true),
  enabled: z.boolean().default(true),
})

export type TelegramGroupEntry = z.infer<typeof telegramGroupEntrySchema>

export const telegramChannelSchema = z.strictObject({
  enabled: z.boolean().default(true),
  botToken: z.string().optional(),
  dmPolicy: dmPolicySchema.default('pairing'),
  allowFrom: z.array(z.string()).default(() => []),
  /** Sole operator — only this user may use the bot (DM + groups). Defaults to first allowFrom entry. */
  ownerUserId: z.string().optional(),
  groupPolicy: groupPolicySchema.default('allowlist'),
  groups: z
    .record(z.string(), telegramGroupEntrySchema)
    .default(() => ({ '*': { requireMention: true, enabled: true } })),
  /** Extra @aliases treated as bot mentions in groups (e.g. "siya"). */
  mentionAliases: z.array(z.string()).default(() => ['siya']),
  defaultAgent: z.string().default(DEFAULT_TELEGRAM_AGENT),
  cwd: z.string().optional(),
  streaming: streamingModeSchema.default('partial'),
  historyLimit: z.number().int().positive().default(50),
})

export type TelegramChannelConfig = z.infer<typeof telegramChannelSchema>

export const gatewayServerSchema = z.strictObject({
  port: z.number().int().positive().default(DEFAULT_GATEWAY_PORT),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /** Start Telegram gateway when the main Siya CLI agent starts. */
  autoStart: z.boolean().default(true),
})

export const gatewayFileSchema = z.strictObject({
  channels: z
    .strictObject({
      telegram: telegramChannelSchema.optional(),
    })
    .default(() => ({})),
  gateway: gatewayServerSchema.default(() => ({
    port: DEFAULT_GATEWAY_PORT,
    logLevel: 'info' as const,
    autoStart: true,
  })),
})

export type GatewayFileConfig = z.infer<typeof gatewayFileSchema>

export type LoadedGatewayConfig = GatewayFileConfig & {
  _sourceFilePath: string
}
