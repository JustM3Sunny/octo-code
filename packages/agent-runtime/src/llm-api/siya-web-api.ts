import type { ClientEnv, CiEnv } from '@siya/common/types/contracts/env'
import type { JSONObject } from '@siya/common/types/json'
import type { Logger } from '@siya/common/types/contracts/logger'

interface SiyaWebApiEnv {
  clientEnv: ClientEnv
  ciEnv: CiEnv
}

/** Stubbed: external Siya web API is disabled in SIYA. */
export async function callWebSearchAPI(_params: {
  query: string
  depth?: 'standard' | 'deep'
  repoUrl?: string | null
  fetch: typeof globalThis.fetch
  logger: Logger
  env: SiyaWebApiEnv
  baseUrl?: string
  apiKey?: string
}): Promise<{ result?: string; error?: string; creditsUsed?: number }> {
  return { result: '', creditsUsed: 0 }
}

/** Stubbed: external Siya web API is disabled in SIYA. */
export async function callDocsSearchAPI(_params: {
  libraryTitle: string
  topic?: string
  maxTokens?: number
  repoUrl?: string | null
  fetch: typeof globalThis.fetch
  logger: Logger
  env: SiyaWebApiEnv
  baseUrl?: string
  apiKey?: string
}): Promise<{ documentation?: string; error?: string; creditsUsed?: number }> {
  return { documentation: '', creditsUsed: 0 }
}

/** Stubbed: external Siya web API is disabled in SIYA. */
export async function callGravityIndexAPI(_params: {
  input: JSONObject
  fetch: typeof globalThis.fetch
  logger: Logger
  env: SiyaWebApiEnv
  baseUrl?: string
  apiKey?: string
}): Promise<{
  result?: JSONObject
  error?: string
  creditsUsed?: number
}> {
  return { result: {}, creditsUsed: 0 }
}

/** Stubbed: external Siya web API is disabled in SIYA. */
export async function callTokenCountAPI(_params: {
  messages: unknown[]
  system?: string
  model?: string
  tools?: Array<{ name: string; description?: string; input_schema?: unknown }>
  fetch: typeof globalThis.fetch
  logger: Logger
  env: SiyaWebApiEnv
  baseUrl?: string
  apiKey?: string
}): Promise<{ inputTokens?: number; error?: string }> {
  return { inputTokens: 0 }
}
