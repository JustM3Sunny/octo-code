import { TelegramActivityTracker } from '../telegram/activity'

import type { PrintModeEvent } from '@siya/common/types/print-mode'

export type TelegramStreamState = {
  text: string
}

export class TelegramEventAdapter {
  private streams = new Map<string, TelegramStreamState>()
  private activity = new Map<string, TelegramActivityTracker>()
  private lastEditAt = new Map<string, number>()
  private dirty = new Map<string, boolean>()
  private readonly minEditIntervalMs: number
  private readonly minToolEditIntervalMs: number

  constructor(options?: {
    minEditIntervalMs?: number
    minToolEditIntervalMs?: number
  }) {
    this.minEditIntervalMs = options?.minEditIntervalMs ?? 700
    this.minToolEditIntervalMs = options?.minToolEditIntervalMs ?? 250
  }

  private getActivity(chatId: string): TelegramActivityTracker {
    let tracker = this.activity.get(chatId)
    if (!tracker) {
      tracker = new TelegramActivityTracker()
      this.activity.set(chatId, tracker)
    }
    return tracker
  }

  getStreamText(chatId: string): string {
    return this.streams.get(chatId)?.text ?? ''
  }

  getDisplayText(chatId: string, finalText?: string): string {
    const stream = this.getStreamText(chatId)
    return this.getActivity(chatId).formatFullMessage(stream, finalText)
  }

  resetStream(chatId: string): void {
    this.streams.delete(chatId)
    this.lastEditAt.delete(chatId)
    this.dirty.delete(chatId)
    this.getActivity(chatId).reset()
  }

  onChunk(chatId: string, chunk: string | { type: string; chunk?: string }): void {
    const textChunk =
      typeof chunk === 'string'
        ? chunk
        : typeof chunk.chunk === 'string'
          ? chunk.chunk
          : ''

    if (!textChunk) {
      return
    }

    const current = this.streams.get(chatId) ?? { text: '' }
    current.text += textChunk
    this.streams.set(chatId, current)
    this.dirty.set(chatId, true)
  }

  shouldEdit(chatId: string): boolean {
    const display = this.getDisplayText(chatId).trim()
    if (!display) {
      return false
    }

    const last = this.lastEditAt.get(chatId) ?? 0
    const elapsed = Date.now() - last
    const isDirty = this.dirty.get(chatId) === true

    if (isDirty && elapsed >= this.minToolEditIntervalMs) {
      return true
    }

    return elapsed >= this.minEditIntervalMs
  }

  markEdited(chatId: string): void {
    this.lastEditAt.set(chatId, Date.now())
    this.dirty.set(chatId, false)
  }

  onEvent(chatId: string, event: PrintModeEvent): void {
    if (event.type === 'text' && event.text) {
      this.onChunk(chatId, event.text)
    }

    this.getActivity(chatId).onEvent(event)

    if (
      event.type === 'tool_call' ||
      event.type === 'tool_result' ||
      event.type === 'subagent_start' ||
      event.type === 'subagent_finish' ||
      event.type === 'error' ||
      event.type === 'text'
    ) {
      this.dirty.set(chatId, true)
    }
  }
}
