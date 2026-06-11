import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/** Keys from project .env always override stale shell/system values. */
const FORCE_FROM_FILE = new Set([
  'OPENROUTER_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_ALLOWED_USERS',
])

function loadEnvFile(filePath: string): void {  if (!fs.existsSync(filePath)) {
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim().replace(/\r$/, '')
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (
      key &&
      (FORCE_FROM_FILE.has(key) || process.env[key] === undefined)
    ) {
      process.env[key] = value
    }  }
}

const preInitDir = path.dirname(fileURLToPath(import.meta.url))
const cliRoot = path.resolve(preInitDir, '../..')
const monorepoRoot = path.resolve(cliRoot, '..')

for (const envPath of [
  path.join(cliRoot, '.env'),
  path.join(monorepoRoot, '.env'),
  path.join(cliRoot, '.env.local'),
  path.join(monorepoRoot, '.env.local'),
]) {
  loadEnvFile(envPath)
}
