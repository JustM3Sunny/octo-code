import path from 'node:path'
import os from 'os'

import type { ClientEnv } from '@siya/common/types/contracts/env'
import type { User } from '@siya/common/util/credentials'

export interface ChatGptOAuthCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: number
  connectedAt: number
}

export const userFromJson = (_json: string): User | null => null

export const getConfigDir = (_clientEnv?: ClientEnv): string => {
  return path.join(os.homedir(), '.config', 'siya')
}

export const getCredentialsPath = (clientEnv?: ClientEnv): string => {
  return path.join(getConfigDir(clientEnv), 'credentials.json')
}

export const getUserCredentials = (_clientEnv?: ClientEnv): User | null => null

export const getChatGptOAuthCredentials = (
  _clientEnv?: ClientEnv,
): ChatGptOAuthCredentials | null => null

export const saveChatGptOAuthCredentials = (
  _credentials: ChatGptOAuthCredentials,
  _clientEnv?: ClientEnv,
): void => {}

export const clearChatGptOAuthCredentials = (_clientEnv?: ClientEnv): void => {}

export const isChatGptOAuthValid = (_clientEnv?: ClientEnv): boolean => false

export const refreshChatGptOAuthToken = async (
  _clientEnv?: ClientEnv,
): Promise<ChatGptOAuthCredentials | null> => null

export const getValidChatGptOAuthCredentials = async (
  _clientEnv?: ClientEnv,
): Promise<ChatGptOAuthCredentials | null> => null
