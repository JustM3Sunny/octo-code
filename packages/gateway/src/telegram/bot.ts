import { Bot } from 'grammy'
import { run } from '@grammyjs/runner'

import { registerTelegramBotCommands } from './commands'
import { registerTelegramHandlers } from './handlers'
import { registerTelegramOutbound, unregisterTelegramOutbound } from './outbound'

import type { SiyaBridge } from '../bridge/siya-bridge'
import type { TelegramChannelConfig } from '@siya/common/types/gateway'

export type TelegramBotHandle = {
  stop: () => Promise<void>
  botUsername?: string
}

export async function startTelegramBot(params: {
  token: string
  config: TelegramChannelConfig
  bridge: SiyaBridge
  projectCwd: string
}): Promise<TelegramBotHandle> {
  const bot = new Bot(params.token)
  const me = await bot.api.getMe()

  registerTelegramOutbound({
    api: bot.api,
    config: params.config,
  })

  registerTelegramHandlers(bot, {
    bridge: params.bridge,
    config: params.config,
    botUsername: me.username,
    botToken: params.token,
    projectCwd: params.projectCwd,
  })

  await registerTelegramBotCommands((commands) =>
    bot.api.setMyCommands(commands),
  )

  const runner = run(bot, {
    runner: {
      fetch: {
        allowed_updates: ['message', 'callback_query'],
      },
    },
  })

  return {
    botUsername: me.username,
    stop: async () => {
      await runner.stop()
      unregisterTelegramOutbound()
    },
  }
}
