import crypto from 'crypto'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'

import {
  PAIRING_CODE_LENGTH,
  PAIRING_CODE_TTL_MS,
} from '@siya/common/constants/gateway'

import { getConfigDir } from '../config/load-config'

export type PairingChannel = 'telegram'

export type PendingPairingRequest = {
  code: string
  channel: PairingChannel
  userId: string
  chatId: string
  username?: string
  createdAt: number
  expiresAt: number
}

export type PairingStoreData = {
  approved: Record<string, string[]>
  pending: PendingPairingRequest[]
}

const PAIRING_FILE = 'pairing.json'

function getPairingFilePath(): string {
  return path.join(getConfigDir(), PAIRING_FILE)
}

function generateCode(): string {
  let code = ''
  while (code.length < PAIRING_CODE_LENGTH) {
    code += crypto
      .randomBytes(6)
      .toString('base64url')
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase()
  }
  return code.slice(0, PAIRING_CODE_LENGTH)
}

export async function loadPairingStore(): Promise<PairingStoreData> {
  const filePath = getPairingFilePath()
  try {
    const content = await fsPromises.readFile(filePath, 'utf8')
    const data = JSON.parse(content) as PairingStoreData
    return {
      approved: data.approved ?? {},
      pending: data.pending ?? [],
    }
  } catch {
    return { approved: {}, pending: [] }
  }
}

export async function savePairingStore(data: PairingStoreData): Promise<void> {
  const filePath = getPairingFilePath()
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true })
  await fsPromises.writeFile(
    filePath,
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8',
  )
}

function pruneExpired(store: PairingStoreData): PairingStoreData {
  const now = Date.now()
  return {
    ...store,
    pending: store.pending.filter((request) => request.expiresAt > now),
  }
}

export function normalizeTelegramUserId(userId: string | number): string {
  return String(userId).replace(/^(tg:|telegram:)/i, '')
}

export async function isUserApproved(
  channel: PairingChannel,
  userId: string,
): Promise<boolean> {
  const store = pruneExpired(await loadPairingStore())
  const normalized = normalizeTelegramUserId(userId)
  const approved = store.approved[channel] ?? []
  return approved.includes(normalized)
}

export async function createPairingRequest(params: {
  channel: PairingChannel
  userId: string
  chatId: string
  username?: string
}): Promise<PendingPairingRequest> {
  const store = pruneExpired(await loadPairingStore())
  const normalizedUserId = normalizeTelegramUserId(params.userId)

  const existing = store.pending.find(
    (request) =>
      request.channel === params.channel &&
      request.userId === normalizedUserId,
  )
  if (existing) {
    return existing
  }

  const now = Date.now()
  const request: PendingPairingRequest = {
    code: generateCode(),
    channel: params.channel,
    userId: normalizedUserId,
    chatId: params.chatId,
    username: params.username,
    createdAt: now,
    expiresAt: now + PAIRING_CODE_TTL_MS,
  }

  store.pending.push(request)
  await savePairingStore(store)
  return request
}

export async function listPendingPairings(
  channel?: PairingChannel,
): Promise<PendingPairingRequest[]> {
  const store = pruneExpired(await loadPairingStore())
  if (!channel) {
    return store.pending
  }
  return store.pending.filter((request) => request.channel === channel)
}

export async function approvePairingCode(
  channel: PairingChannel,
  code: string,
): Promise<{ userId: string } | null> {
  const store = pruneExpired(await loadPairingStore())
  const normalizedCode = code.trim().toUpperCase()
  const index = store.pending.findIndex(
    (request) =>
      request.channel === channel &&
      request.code.toUpperCase() === normalizedCode,
  )

  if (index === -1) {
    return null
  }

  const [request] = store.pending.splice(index, 1)
  const approved = store.approved[channel] ?? []
  if (!approved.includes(request.userId)) {
    approved.push(request.userId)
  }
  store.approved[channel] = approved

  await savePairingStore(store)
  return { userId: request.userId }
}
