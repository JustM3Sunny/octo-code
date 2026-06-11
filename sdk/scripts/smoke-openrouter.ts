import fs from 'fs'
import path from 'path'

import { streamText } from 'ai'

import { getModelForRequest, verifyOpenRouterAuth } from '../src/impl/model-provider'

const envPath = path.join(import.meta.dir, '../../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const i = line.indexOf('=')
    if (i > 0 && line.slice(0, i).trim() === 'OPENROUTER_API_KEY') {
      process.env.OPENROUTER_API_KEY = line.slice(i + 1).trim()
    }
  }
}

const ok = await verifyOpenRouterAuth()
console.log('verify:', ok)

const { model } = await getModelForRequest({
  model: 'openrouter/free',
  apiKey: process.env.OPENROUTER_API_KEY,
})

const result = streamText({
  model,
  messages: [{ role: 'user', content: 'Reply with exactly: SIYA_OK' }],
  maxOutputTokens: 64,
})

const text = await result.text
console.log('chat:', text.trim() || '(empty)')
