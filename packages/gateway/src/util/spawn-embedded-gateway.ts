import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import { probeGatewayHealth } from './port-utils'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveCliEntry(cwd: string): string {
  try {
    const thisDir = path.dirname(fileURLToPath(import.meta.url))
    const fromPackage = path.resolve(thisDir, '../../../../cli/src/index.tsx')
    return fromPackage
  } catch {
    return path.join(cwd, 'cli', 'src', 'index.tsx')
  }
}

export async function spawnEmbeddedGatewayProcess(params: {
  cwd: string
  port: number
}): Promise<{ child: ChildProcess; stop: () => Promise<void> }> {
  const cliEntry = resolveCliEntry(params.cwd)
  const runtime = process.execPath
  const child = spawn(runtime, ['run', cliEntry, 'gateway', 'start'], {
    cwd: params.cwd,
    env: {
      ...process.env,
      SIYA_EMBEDDED_GATEWAY_CHILD: '1',
    },
    detached: false,
    stdio: 'ignore',
    windowsHide: true,
  })

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error('Telegram gateway process exited before becoming ready.')
    }
    if (await probeGatewayHealth(params.port, 1500)) {
      return {
        child,
        stop: async () => {
          if (child.exitCode !== null) {
            return
          }
          child.kill('SIGTERM')
          await sleep(300)
          if (child.exitCode === null) {
            child.kill('SIGKILL')
          }
        },
      }
    }
    await sleep(500)
  }

  child.kill('SIGKILL')
  throw new Error(
    `Telegram gateway did not become ready on port ${params.port} within 15 seconds.`,
  )
}
