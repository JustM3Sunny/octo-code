import { InlineKeyboard } from 'grammy'

import type { AskUserQuestion } from '@siya/common/tools/params/tool/ask-user'
import type { Api } from 'grammy'

type AskUserAnswer = {
  questionIndex: number
  selectedOption?: string
  selectedOptions?: string[]
  otherText?: string
}

type PendingAskUser = {
  chatId: string
  questions: AskUserQuestion[]
  currentIndex: number
  answers: AskUserAnswer[]
  multiSelected: Set<number>
  awaitingCustomText: boolean
  resolve: (value: { answers?: AskUserAnswer[]; skipped?: boolean }) => void
  messageIds: number[]
}

const pendingByChat = new Map<string, PendingAskUser>()

function getOptionLabel(
  option: string | { label: string; description?: string },
): string {
  return typeof option === 'string' ? option : option.label
}

function formatQuestion(
  question: AskUserQuestion,
  index: number,
  total: number,
): string {
  const header = question.header ? `[${question.header}] ` : ''
  const mode = question.multiSelect
    ? '\n(Multi-select: tap options, then Done)'
    : '\n(Tap an option or use "Type custom answer")'
  return `${header}Question ${index}/${total}\n\n${question.question}${mode}`
}

async function sendCurrentQuestion(
  api: Api,
  state: PendingAskUser,
): Promise<void> {
  const question = state.questions[state.currentIndex]
  if (!question) {
    finishAskUser(state)
    return
  }

  state.multiSelected.clear()
  state.awaitingCustomText = false

  const keyboard = new InlineKeyboard()
  question.options.forEach((option, optionIndex) => {
    const label = getOptionLabel(option)
    const prefix =
      question.multiSelect && state.multiSelected.has(optionIndex)
        ? '✓ '
        : ''
    keyboard
      .text(`${prefix}${label}`.slice(0, 64), `au:${state.currentIndex}:${optionIndex}`)
      .row()
  })

  if (question.multiSelect) {
    keyboard.text('✓ Done selecting', `au:${state.currentIndex}:done`).row()
  }

  keyboard
    .text('✏️ Type custom answer', `au:${state.currentIndex}:custom`)
    .text('⏭ Skip all', 'au:skip')

  const text = formatQuestion(
    question,
    state.currentIndex + 1,
    state.questions.length,
  )
  const message = await api.sendMessage(state.chatId, text, {
    reply_markup: keyboard,
  })
  state.messageIds.push(message.message_id)
}

function finishAskUser(state: PendingAskUser): void {
  pendingByChat.delete(state.chatId)
  state.resolve({ answers: state.answers })
}

function skipAskUser(state: PendingAskUser): void {
  pendingByChat.delete(state.chatId)
  state.resolve({ skipped: true, answers: [] })
}

function recordAnswer(state: PendingAskUser, answer: AskUserAnswer): void {
  state.answers.push(answer)
  state.currentIndex += 1

  if (state.currentIndex >= state.questions.length) {
    finishAskUser(state)
    return
  }
}

export function hasPendingAskUser(chatId: string): boolean {
  return pendingByChat.has(chatId)
}

export function cancelAskUser(chatId: string): void {
  const state = pendingByChat.get(chatId)
  if (!state) {
    return
  }
  skipAskUser(state)
}

export async function requestTelegramAskUser(params: {
  chatId: string
  api: Api
  questions: AskUserQuestion[]
}): Promise<{ answers?: AskUserAnswer[]; skipped?: boolean }> {
  if (pendingByChat.has(params.chatId)) {
    cancelAskUser(params.chatId)
  }

  if (params.questions.length === 0) {
    return { skipped: true, answers: [] }
  }

  return new Promise((resolve) => {
    const state: PendingAskUser = {
      chatId: params.chatId,
      questions: params.questions,
      currentIndex: 0,
      answers: [],
      multiSelected: new Set(),
      awaitingCustomText: false,
      resolve,
      messageIds: [],
    }
    pendingByChat.set(params.chatId, state)
    void sendCurrentQuestion(params.api, state)
  })
}

export async function handleAskUserCallback(
  chatId: string,
  data: string,
  api: Api,
): Promise<boolean> {
  const state = pendingByChat.get(chatId)
  if (!state) {
    return false
  }

  if (data === 'au:skip') {
    skipAskUser(state)
    return true
  }

  const match = data.match(/^au:(\d+):(\w+)$/)
  if (!match) {
    return false
  }

  const questionIndex = Number(match[1])
  const action = match[2]

  if (questionIndex !== state.currentIndex) {
    await api.sendMessage(chatId, 'That question has already been answered.')
    return true
  }

  const question = state.questions[questionIndex]
  if (!question) {
    return false
  }

  if (action === 'custom') {
    state.awaitingCustomText = true
    await api.sendMessage(
      chatId,
      'Reply with your custom answer as your next message.',
    )
    return true
  }

  if (action === 'done' && question.multiSelect) {
    const selected = [...state.multiSelected]
      .sort((a, b) => a - b)
      .map((index) => getOptionLabel(question.options[index] ?? ''))
      .filter(Boolean)

    if (selected.length === 0) {
      await api.sendMessage(chatId, 'Select at least one option, or type a custom answer.')
      return true
    }

    recordAnswer(state, {
      questionIndex,
      selectedOptions: selected,
    })

    if (pendingByChat.has(chatId)) {
      await sendCurrentQuestion(api, state)
    }
    return true
  }

  const optionIndex = Number(action)
  if (Number.isNaN(optionIndex) || !question.options[optionIndex]) {
    return false
  }

  if (question.multiSelect) {
    if (state.multiSelected.has(optionIndex)) {
      state.multiSelected.delete(optionIndex)
    } else {
      state.multiSelected.add(optionIndex)
    }

    await sendCurrentQuestion(api, state)
    return true
  }

  recordAnswer(state, {
    questionIndex,
    selectedOption: getOptionLabel(question.options[optionIndex]),
  })

  if (pendingByChat.has(chatId)) {
    await sendCurrentQuestion(api, state)
  }
  return true
}

export async function handleAskUserTextReply(
  chatId: string,
  text: string,
  api: Api,
): Promise<boolean> {
  const state = pendingByChat.get(chatId)
  if (!state) {
    return false
  }

  const trimmed = text.trim()
  if (!trimmed) {
    return true
  }

  if (trimmed === '/skip' || trimmed.toLowerCase() === 'skip') {
    skipAskUser(state)
    return true
  }

  const questionIndex = state.currentIndex
  recordAnswer(state, {
    questionIndex,
    otherText: trimmed,
  })

  if (pendingByChat.has(chatId)) {
    await sendCurrentQuestion(api, state)
  } else {
    await api.sendMessage(chatId, 'Thanks — continuing…')
  }

  return true
}
