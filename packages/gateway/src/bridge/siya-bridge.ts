import { MAX_AGENT_STEPS_DEFAULT } from '@siya/common/constants/agents'
import { SiyaClient, loadLocalAgents } from '@siya/sdk'

import { TelegramEventAdapter } from './event-adapter'
import { extractTextFromAgentOutput } from '../telegram/format'
import {
  loadTelegramSession,
  saveTelegramSession,
} from '../session/session-store'
import { requestTelegramAskUser } from '../telegram/ask-user'
import { getActiveTelegramChatId, getTelegramApi, setActiveTelegramChat } from '../telegram/outbound'
import {
  createScheduleTools,
  injectScheduleToolsIntoAgents,
} from '../tools/schedule-tools'
import {
  createTelegramNotifyTools,
  injectTelegramToolsIntoAgents,
} from '../tools/telegram-notify-tools'

import type { AgentDefinition, MessageContent } from '@siya/sdk'
import type { Logger } from '@siya/common/types/contracts/logger'
import type { TelegramChannelConfig } from '@siya/common/types/gateway'
import type { RunState } from '@siya/sdk'

export type SiyaBridgeOptions = {
  apiKey: string
  cwd: string
  telegramConfig: TelegramChannelConfig
  agentDefinitions?: AgentDefinition[]
  logger?: Logger
}

export type ProcessMessageResult = {
  reply: string
  runState: RunState
}

const defaultLogger: Logger = {
  debug: () => {},
  info: (_data, msg) => {
    if (msg) console.log(msg)
  },
  warn: (_data, msg) => {
    console.warn(msg ?? _data)
  },
  error: (_data, msg) => {
    console.error(msg ?? _data)
  },
}

export class SiyaBridge {
  private client: SiyaClient
  private agentId: string
  private agentDefinitions: AgentDefinition[]
  private logger: Logger
  private telegramTools: ReturnType<typeof createTelegramNotifyTools>
  private scheduleTools: ReturnType<typeof createScheduleTools>
  private adapters = new Map<string, TelegramEventAdapter>()

  constructor(options: SiyaBridgeOptions) {
    this.agentId = options.telegramConfig.defaultAgent
    this.telegramTools = createTelegramNotifyTools({ cwd: options.cwd })
    this.scheduleTools = createScheduleTools({
      defaultAgentId: this.agentId,
      source: 'gateway',
    })
    const withScheduleTools = injectScheduleToolsIntoAgents(
      options.agentDefinitions ?? [],
      'all',
    )
    this.agentDefinitions = injectTelegramToolsIntoAgents(
      withScheduleTools,
      [this.agentId, 'base2', 'base2-max', 'base2-lite', 'base2-fast'],
    )
    this.logger = options.logger ?? defaultLogger

    this.client = new SiyaClient({
      apiKey: options.apiKey,
      cwd: options.cwd,
      agentDefinitions: this.agentDefinitions,
      customToolDefinitions: [...this.scheduleTools, ...this.telegramTools],
      logger: this.logger,
      overrideTools: {
        ask_user: async (input) => {
          const chatId = getActiveTelegramChatId()
          const api = getTelegramApi()
          if (!chatId || !api) {
            return [
              {
                type: 'json',
                value: { skipped: true, answers: [] },
              },
            ]
          }

          const response = await requestTelegramAskUser({
            chatId,
            api,
            questions: input.questions,
          })

          return [
            {
              type: 'json',
              value: response,
            },
          ]
        },
      },
    })
  }

  static async create(options: SiyaBridgeOptions): Promise<SiyaBridge> {
    let agentDefinitions = options.agentDefinitions
    if (!agentDefinitions || agentDefinitions.length === 0) {
      const loaded = await loadLocalAgents({ verbose: false })
      agentDefinitions = Object.values(loaded)
    }
    return new SiyaBridge({ ...options, agentDefinitions })
  }

  private getAdapter(chatId: string): TelegramEventAdapter {
    let adapter = this.adapters.get(chatId)
    if (!adapter) {
      adapter = new TelegramEventAdapter()
      this.adapters.set(chatId, adapter)
    }
    return adapter
  }

  async processMessage(params: {
    chatId: string
    text: string
    content?: MessageContent[]
    signal?: AbortSignal
    agentId?: string
  }): Promise<ProcessMessageResult> {
    const { chatId, text, content, signal, agentId } = params
    const adapter = this.getAdapter(chatId)
    adapter.resetStream(chatId)
    setActiveTelegramChat(chatId)

    const session = await loadTelegramSession(chatId)

    const runState = await this.client.run({
      agent: agentId ?? this.agentId,
      prompt: text,
      content,
      agentDefinitions: this.agentDefinitions,
      customToolDefinitions: [...this.scheduleTools, ...this.telegramTools],
      previousRun: session?.runState ?? undefined,
      maxAgentSteps: MAX_AGENT_STEPS_DEFAULT,
      signal,
      handleEvent: (event) => adapter.onEvent(chatId, event),
      handleStreamChunk: async (chunk) => {
        if (typeof chunk === 'string') {
          adapter.onChunk(chatId, chunk)
          return
        }
        if (chunk.type === 'reasoning_chunk' && chunk.chunk) {
          adapter.onChunk(chatId, chunk.chunk)
        }
      },
    })

    try {
      await saveTelegramSession({
        chatId,
        runState,
        updatedAt: Date.now(),
      })
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to persist Telegram session (agent reply still sent)',
      )
    }

    const streamed = adapter.getStreamText(chatId).trim()
    const agentText =
      streamed || extractTextFromAgentOutput(runState.output)
    const reply = adapter.getDisplayText(chatId, agentText)

    return { reply, runState }
  }

  getStreamingText(chatId: string): string {
    return this.getAdapter(chatId).getDisplayText(chatId)
  }

  getDisplayText(chatId: string, finalText?: string): string {
    return this.getAdapter(chatId).getDisplayText(chatId, finalText)
  }

  shouldStreamEdit(chatId: string): boolean {
    return this.getAdapter(chatId).shouldEdit(chatId)
  }

  markStreamEdited(chatId: string): void {
    this.getAdapter(chatId).markEdited(chatId)
  }
}

export async function createGatewayBridge(
  options: SiyaBridgeOptions,
): Promise<SiyaBridge> {
  return SiyaBridge.create(options)
}
