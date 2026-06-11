import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'

import { getConfigDir } from '../config/load-config'
import { safeJsonStringify } from '../util/safe-json'

import type { RunState } from '@siya/sdk'

/** Default session TTL: 24 hours of inactivity before session is expired */
export const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000

export type TelegramSession = {
  chatId: string
  runState: RunState | null
  updatedAt: number
}

function getSessionsDir(): string {
  return path.join(getConfigDir(), 'sessions', 'telegram')
}

function getSessionPath(chatId: string): string {
  const safeId = chatId.replace(/[^0-9-]/g, '_')
  return path.join(getSessionsDir(), `${safeId}.json`)
}

function sanitizeRunStateForPersistence(runState: RunState): RunState {
  const fileContext = runState.sessionState?.fileContext
  if (fileContext && 'customToolDefinitions' in fileContext) {
    return {
      ...runState,
      sessionState: runState.sessionState
        ? {
            ...runState.sessionState,
            fileContext: {
              ...fileContext,
              customToolDefinitions: {},
            },
          }
        : runState.sessionState,
    }
  }
  return runState
}

/**
 * Atomic write: writes to a temporary file first, then renames it to the
 * target path. On POSIX systems `fs.rename` is atomic, so a crash during
 * write cannot leave a half-written file.
 */
async function atomicWriteJson(filePath: string, data: string): Promise<void> {
  const dir = path.dirname(filePath)
  await fsPromises.mkdir(dir, { recursive: true })
  const tmpPath = filePath + '.tmp'
  await fsPromises.writeFile(tmpPath, data, 'utf8')
  await fsPromises.rename(tmpPath, filePath)
}

export async function loadTelegramSession(
  chatId: string,
): Promise<TelegramSession | null> {
  const filePath = getSessionPath(chatId)
  try {
    const content = await fsPromises.readFile(filePath, 'utf8')
    const session = JSON.parse(content) as TelegramSession

    // Check if session has expired (older than TTL)
    if (Date.now() - session.updatedAt > DEFAULT_SESSION_TTL_MS) {
      // Session is expired — delete it and return null
      await clearTelegramSession(chatId)
      return null
    }

    return session
  } catch {
    return null
  }
}

export async function saveTelegramSession(session: TelegramSession): Promise<void> {
  const filePath = getSessionPath(session.chatId)

  const persisted: TelegramSession = {
    chatId: session.chatId,
    updatedAt: session.updatedAt,
    runState: session.runState
      ? sanitizeRunStateForPersistence(session.runState)
      : null,
  }

  const payload = `${safeJsonStringify(persisted)}\n`
  await atomicWriteJson(filePath, payload)
}

export async function clearTelegramSession(chatId: string): Promise<void> {
  const filePath = getSessionPath(chatId)
  try {
    await fsPromises.unlink(filePath)
  } catch {
    // Session file may not exist yet
  }
  // Also clean up any leftover temp files
  try {
    await fsPromises.unlink(filePath + '.tmp')
  } catch {
    // Ignore
  }
}

export function listTelegramSessions(): string[] {
  const dir = getSessionsDir()
  if (!fs.existsSync(dir)) {
    return []
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
}

/**
 * Prune all expired sessions. Can be called periodically by the scheduler
 * or on gateway startup to clean up stale sessions.
 *
 * Returns the number of sessions pruned.
 */
export async function pruneExpiredSessions(): Promise<number> {
  const sessions = listTelegramSessions()
  let pruned = 0

  for (const chatId of sessions) {
    try {
      const filePath = getSessionPath(chatId)
      const content = await fsPromises.readFile(filePath, 'utf8')
      const session = JSON.parse(content) as TelegramSession

      if (Date.now() - session.updatedAt > DEFAULT_SESSION_TTL_MS) {
        await clearTelegramSession(chatId)
        pruned++
      }
    } catch {
      // If we can't read the session file, try to clean it up anyway
      try {
        await clearTelegramSession(chatId)
        pruned++
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  return pruned
}
