import { describe, expect, test } from 'bun:test'

import { checkDmAccess, isUserInAllowlist } from '../allowlist'

import type { TelegramChannelConfig } from '@siya/common/types/gateway'

const baseConfig: TelegramChannelConfig = {
  enabled: true,
  dmPolicy: 'pairing',
  allowFrom: ['tg:7498724465'],
  groupPolicy: 'disabled',
  defaultAgent: 'base2',
  streaming: 'partial',
  historyLimit: 50,
}

describe('allowlist', () => {
  test('matches tg-prefixed user ids', () => {
    expect(isUserInAllowlist(['tg:7498724465'], '7498724465')).toBe(true)
  })

  test('allows approved or allowlisted users under pairing policy', () => {
    expect(
      checkDmAccess({
        config: baseConfig,
        userId: '7498724465',
        isApproved: false,
      }).allowed,
    ).toBe(true)

    expect(
      checkDmAccess({
        config: baseConfig,
        userId: '9999999999',
        isApproved: true,
      }).allowed,
    ).toBe(true)

    expect(
      checkDmAccess({
        config: baseConfig,
        userId: '9999999999',
        isApproved: false,
      }),
    ).toEqual({ allowed: false, reason: 'pairing_required' })
  })
})
