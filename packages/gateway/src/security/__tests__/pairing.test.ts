import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  approvePairingCode,
  createPairingRequest,
  isUserApproved,
  listPendingPairings,
} from '../pairing'

const testConfigDir = path.join(os.tmpdir(), `siya-gateway-test-${Date.now()}`)

afterEach(() => {
  fs.rmSync(testConfigDir, { recursive: true, force: true })
})

describe('pairing store', () => {
  test('creates and approves pairing request', async () => {
    process.env.SIYA_CONFIG_DIR = testConfigDir

    const request = await createPairingRequest({
      channel: 'telegram',
      userId: '7498724465',
      chatId: '7498724465',
      username: 'testuser',
    })

    expect(request.code).toHaveLength(8)

    const pending = await listPendingPairings('telegram')
    expect(pending.some((item) => item.code === request.code)).toBe(true)

    const approved = await approvePairingCode('telegram', request.code)
    expect(approved?.userId).toBe('7498724465')

    expect(await isUserApproved('telegram', '7498724465')).toBe(true)
    expect(await listPendingPairings('telegram')).toHaveLength(0)
  })
})
