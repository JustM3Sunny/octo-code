import http from 'http'

import { sendTelegramDocument, sendTelegramText } from './telegram/outbound'

import type { TelegramNotifyTarget } from './telegram/outbound'

export type HealthServerHandle = {
  port: number
  close: () => Promise<void>
}

type JsonRecord = Record<string, unknown>

async function readJsonBody(req: http.IncomingMessage): Promise<JsonRecord> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) {
    return {}
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as JsonRecord
  } catch {
    throw new Error('Invalid JSON body')
  }
}

function writeJson(res: http.ServerResponse, status: number, body: JsonRecord): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

export function startHealthServer(port: number): Promise<HealthServerHandle> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      void (async () => {
        try {
          if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
            writeJson(res, 200, { status: 'ok', service: 'siya-gateway' })
            return
          }

          if (req.method === 'POST' && req.url === '/api/telegram/send') {
            const body = await readJsonBody(req)
            const message = String(body.message ?? '').trim()
            if (!message) {
              writeJson(res, 400, { ok: false, error: 'message is required' })
              return
            }

            const result = await sendTelegramText({
              message,
              target: body.target as TelegramNotifyTarget | undefined,
              chatId: body.chat_id ? String(body.chat_id) : undefined,
            })
            writeJson(res, 200, { ok: true, ...result })
            return
          }

          if (req.method === 'POST' && req.url === '/api/telegram/send-file') {
            const body = await readJsonBody(req)
            const filePath = String(body.file_path ?? '').trim()
            if (!filePath) {
              writeJson(res, 400, { ok: false, error: 'file_path is required' })
              return
            }

            const result = await sendTelegramDocument({
              filePath,
              caption: body.caption ? String(body.caption) : undefined,
              target: body.target as TelegramNotifyTarget | undefined,
              chatId: body.chat_id ? String(body.chat_id) : undefined,
            })
            writeJson(res, 200, { ok: true, ...result })
            return
          }

          writeJson(res, 404, { ok: false, error: 'not found' })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Internal server error'
          writeJson(res, 500, { ok: false, error: message })
        }
      })()
    })

    server.on('error', reject)

    server.listen(port, '127.0.0.1', () => {
      resolve({
        port,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) closeReject(error)
              else closeResolve()
            })
          }),
      })
    })
  })
}
