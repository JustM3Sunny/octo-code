import { execSync } from 'child_process'
import net from 'net'

export function isPortListening(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host })
    const finish = (value: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(value)
    }

    socket.setTimeout(800)
    socket.on('connect', () => finish(true))
    socket.on('timeout', () => finish(false))
    socket.on('error', () => finish(false))
  })
}

export async function probeGatewayHealth(
  port: number,
  timeoutMs = 2500,
): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      return false
    }
    const body = (await response.json()) as { status?: string; service?: string }
    return body.status === 'ok' && body.service === 'siya-gateway'
  } catch {
    return false
  }
}

function getWindowsPidOnPort(port: number): number | null {
  try {
    const output = execSync(`netstat -ano | findstr ":${port}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    for (const line of output.split('\n')) {
      if (!line.includes('LISTENING')) {
        continue
      }
      const parts = line.trim().split(/\s+/)
      const pid = Number(parts[parts.length - 1])
      if (Number.isFinite(pid) && pid > 0) {
        return pid
      }
    }
  } catch {
    // Port may not be in use
  }
  return null
}

function getUnixPidOnPort(port: number): number | null {
  try {
    const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const pid = Number(output.trim().split('\n')[0])
    return Number.isFinite(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

export function getPidListeningOnPort(port: number): number | null {
  if (process.platform === 'win32') {
    return getWindowsPidOnPort(port)
  }
  return getUnixPidOnPort(port)
}

export function killProcess(pid: number): boolean {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
    } else {
      process.kill(pid, 'SIGTERM')
    }
    return true
  } catch {
    return false
  }
}

/** Free the gateway port when a stale listener blocks startup. */
export async function freeGatewayPortIfStale(port: number): Promise<boolean> {
  const listening = await isPortListening(port)
  if (!listening) {
    return false
  }

  const healthy = await probeGatewayHealth(port)
  if (healthy) {
    return false
  }

  const pid = getPidListeningOnPort(port)
  if (!pid || pid === process.pid) {
    return false
  }

  killProcess(pid)
  await new Promise((resolve) => setTimeout(resolve, 400))
  return true
}
