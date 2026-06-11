import { describe, expect, test } from 'bun:test'

import {
  getConfigDir,
  getCredentialsPath,
  getUserCredentials,
  getChatGptOAuthCredentials,
  saveChatGptOAuthCredentials,
  clearChatGptOAuthCredentials,
  isChatGptOAuthValid,
  refreshChatGptOAuthToken,
  getValidChatGptOAuthCredentials,
  userFromJson,
} from '../credentials'

describe('credentials', () => {
  const testEnv = {
    NEXT_PUBLIC_CB_ENVIRONMENT: 'test',
  } as const

  describe('getConfigDir', () => {
    test('returns SIYA config directory', () => {
      const dir = getConfigDir(testEnv as any)
      expect(dir).toContain('siya')
      expect(dir).toContain('.config')
    })
  })

  describe('getCredentialsPath', () => {
    test('returns path within config directory', () => {
      const credPath = getCredentialsPath(testEnv as any)
      expect(credPath).toContain('credentials.json')
      expect(credPath).toContain('siya')
    })
  })

  describe('userFromJson', () => {
    test('returns null for any input (stubbed)', () => {
      expect(userFromJson('not valid json')).toBeNull()
      expect(userFromJson('{}')).toBeNull()
    })
  })

  describe('getUserCredentials', () => {
    test('returns null (stubbed)', () => {
      expect(getUserCredentials(testEnv as any)).toBeNull()
    })
  })

  describe('ChatGPT OAuth stubs', () => {
    test('returns null or false for all OAuth helpers', async () => {
      expect(getChatGptOAuthCredentials(testEnv as any)).toBeNull()
      expect(isChatGptOAuthValid(testEnv as any)).toBe(false)
      expect(await refreshChatGptOAuthToken(testEnv as any)).toBeNull()
      expect(await getValidChatGptOAuthCredentials(testEnv as any)).toBeNull()

      saveChatGptOAuthCredentials(
        {
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresAt: Date.now() + 3_600_000,
          connectedAt: Date.now(),
        },
        testEnv as any,
      )
      clearChatGptOAuthCredentials(testEnv as any)
      expect(getChatGptOAuthCredentials(testEnv as any)).toBeNull()
    })
  })
})
