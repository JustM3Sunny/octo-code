import { describe, expect, test, beforeEach } from 'bun:test'

import {
  getEffectiveModel,
  isOpenCodeZenModel,
  isOpenRouterModel,
  OPENROUTER_FREE_MODEL,
  resolveRunnableModel,
  resolveSiyaModel,
  SIYA_ZEN_DEFAULT_MODEL,
  toProviderApiModelId,
} from '../constants/siya-models'
import {
  resetOpenRouterAuthState,
  setOpenRouterAuthValid,
} from '../constants/openrouter-auth'

describe('siya-models provider routing', () => {
  beforeEach(() => {
    resetOpenRouterAuthState()
  })

  test('openrouter/free is OpenRouter, not OpenCode Zen', () => {
    expect(isOpenRouterModel(OPENROUTER_FREE_MODEL)).toBe(true)
    expect(isOpenCodeZenModel(OPENROUTER_FREE_MODEL)).toBe(false)
  })

  test('opencode-zen models route to OpenCode Zen', () => {
    expect(isOpenCodeZenModel('opencode-zen/mimo-v2.5-free')).toBe(true)
    expect(isOpenRouterModel('opencode-zen/mimo-v2.5-free')).toBe(false)
    expect(isOpenCodeZenModel('mimo-v2.5-free')).toBe(true)
  })

  test('resolveSiyaModel returns correct provider', () => {
    expect(resolveSiyaModel(OPENROUTER_FREE_MODEL)?.provider).toBe('openrouter')
    expect(resolveSiyaModel('opencode-zen/big-pickle')?.provider).toBe(
      'opencode-zen',
    )
  })

  test('toProviderApiModelId keeps openrouter/free for OpenRouter API', () => {
    expect(toProviderApiModelId(OPENROUTER_FREE_MODEL)).toBe('openrouter/free')
    expect(toProviderApiModelId('opencode-zen/mimo-v2.5-free')).toBe(
      'mimo-v2.5-free',
    )
  })

  test('resolveRunnableModel falls back to zen when OpenRouter unusable', () => {
    setOpenRouterAuthValid(false)
    expect(resolveRunnableModel(OPENROUTER_FREE_MODEL)).toBe(
      SIYA_ZEN_DEFAULT_MODEL,
    )
  })

  test('getEffectiveModel falls back to zen when OpenRouter unusable', () => {
    setOpenRouterAuthValid(false)
    expect(getEffectiveModel('DEFAULT', OPENROUTER_FREE_MODEL)).toBe(
      SIYA_ZEN_DEFAULT_MODEL,
    )
  })
})
