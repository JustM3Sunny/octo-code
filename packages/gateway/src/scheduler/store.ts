import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'

import { getConfigDir } from '../config/load-config'
import { safeJsonStringify } from '../util/safe-json'

import type { ScheduledTask } from './types'

type SchedulerStoreFile = {
  version: 1
  tasks: ScheduledTask[]
}

function getStorePath(): string {
  return path.join(getConfigDir(), 'scheduler', 'tasks.json')
}

function createEmptyStore(): SchedulerStoreFile {
  return { version: 1, tasks: [] }
}

/**
 * Atomic write: writes to a temporary file first, then renames it to the
 * target path. On POSIX systems `fs.rename` is atomic, so a crash during
 * write cannot leave a half-written file. On Windows the rename overwrites
 * the destination atomically.
 */
async function atomicWriteJson(filePath: string, data: string): Promise<void> {
  const dir = path.dirname(filePath)
  await fsPromises.mkdir(dir, { recursive: true })

  const tmpPath = filePath + '.tmp'
  await fsPromises.writeFile(tmpPath, data, 'utf8')
  await fsPromises.rename(tmpPath, filePath)
}

export async function loadScheduledTasks(): Promise<ScheduledTask[]> {
  const filePath = getStorePath()
  try {
    const content = await fsPromises.readFile(filePath, 'utf8')
    const parsed = JSON.parse(content) as SchedulerStoreFile
    if (!parsed?.tasks || !Array.isArray(parsed.tasks)) {
      return []
    }
    return parsed.tasks
  } catch {
    // If the main file is missing or corrupt, check if there is a
    // leftover temp file from a crash that can be recovered.
    try {
      const tmpPath = filePath + '.tmp'
      const content = await fsPromises.readFile(tmpPath, 'utf8')
      const parsed = JSON.parse(content) as SchedulerStoreFile
      if (parsed?.tasks && Array.isArray(parsed.tasks)) {
        // Recover the temp file as the main store
        await fsPromises.rename(tmpPath, filePath)
        return parsed.tasks
      }
    } catch {
      // No recoverable temp file either
    }
    return []
  }
}

export async function saveScheduledTasks(tasks: ScheduledTask[]): Promise<void> {
  const filePath = getStorePath()
  const payload: SchedulerStoreFile = {
    version: 1,
    tasks,
  }
  await atomicWriteJson(filePath, `${safeJsonStringify(payload)}\n`)
}

export function loadScheduledTasksSync(): ScheduledTask[] {
  const filePath = getStorePath()
  if (!fs.existsSync(filePath)) {
    // Check for leftover temp file
    const tmpPath = filePath + '.tmp'
    if (fs.existsSync(tmpPath)) {
      try {
        const content = fs.readFileSync(tmpPath, 'utf8')
        const parsed = JSON.parse(content) as SchedulerStoreFile
        if (parsed?.tasks && Array.isArray(parsed.tasks)) {
          fs.renameSync(tmpPath, filePath)
          return parsed.tasks
        }
      } catch {
        // Ignore corrupt temp file
      }
    }
    return []
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(content) as SchedulerStoreFile
    return Array.isArray(parsed?.tasks) ? parsed.tasks : []
  } catch {
    return []
  }
}
