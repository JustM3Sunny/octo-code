/**
 * SDK environment helper for dependency injection.
 *
 * This module provides SDK-specific env helpers that extend the base
 * process env with SDK-specific vars for binary paths and WASM.
 */

import { getBaseEnv } from '@siya/common/env-process'

import type { SdkEnv } from './types/env'

/**
 * Get SDK environment values.
 * Composes from getBaseEnv() + SDK-specific vars.
 */
export const getSdkEnv = (): SdkEnv => ({
  ...getBaseEnv(),

  // SDK-specific paths
  SIYA_RG_PATH: process.env.SIYA_RG_PATH,
  SIYA_WASM_DIR: process.env.SIYA_WASM_DIR,

  // Build flags
  VERBOSE: process.env.VERBOSE,
  OVERRIDE_TARGET: process.env.OVERRIDE_TARGET,
  OVERRIDE_PLATFORM: process.env.OVERRIDE_PLATFORM,
  OVERRIDE_ARCH: process.env.OVERRIDE_ARCH,
})

export const getOpenRouterApiKeyFromEnv = (): string | undefined => {
  return process.env.OPENROUTER_API_KEY
}

export const getSystemProcessEnv = (): NodeJS.ProcessEnv => {
  return process.env
}
