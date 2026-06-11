import {
  checkGroupMessageAccess,
  isBotMentioned,
  isGroupChatType,
  isOwnerUser,
} from '../security/group-access'
import { checkDmAccess } from '../security/allowlist'
import { createPairingRequest, isUserApproved } from '../security/pairing'
import {
  cancelAskUser,
  handleAskUserCallback,
  handleAskUserTextReply,
  hasPendingAskUser,
} from './ask-user'
import {
  clearChatAgentState,
  getChatAgentOverride,
  setChatAgentOverride,
} from './chat-agent'
import {
  TELEGRAM_COMMAND_NAMES,
  handleTelegramCommand,
  parseBotCommand,
} from './commands'
import { chunkTelegramMessage, escapeHtml } from './format'
import { extractMediaFromMessage } from './media'
import { getTelegramApi, registerOwnerDmChat, setActiveTelegramChat } from './outbound'

import type { Bot, Context } from 'grammy'
import type { SiyaBridge } from '../bridge/siya-bridge'
import type { MessageContent } from '@siya/sdk'
import type { TelegramChannelConfig } from '@siya/common/types/gateway'

const activeRuns = new Map<string, AbortController>()

export type TelegramHandlerDeps = {
  bridge: SiyaBridge
  config: TelegramChannelConfig
  botUsername?: string
  botToken: string
  projectCwd: string
}

function abortActiveRun(chatId: string): void {
  const existing = activeRuns.get(chatId)
  if (existing) {
    existing.abort()
    activeRuns.delete(chatId)
  }
  cancelAskUser(chatId)
}

async function sendLongReply(ctx: Context, text: string): Promise<void> {
  const chunks = chunkTelegramMessage(text)
  for (const chunk of chunks) {
    await ctx.reply(chunk)
  }
}

async function processAgentMessage(
  ctx: Context,
  deps: TelegramHandlerDeps,
  params: { promptText: string; content?: MessageContent[] },
): Promise<void> {
  const { bridge } = deps
  const { promptText, content } = params
  const chatId = String(ctx.chat?.id ?? ctx.from?.id)
  setActiveTelegramChat(chatId)
  if (ctx.from?.id) {
    registerOwnerDmChat(chatId, String(ctx.from.id))
  }

  abortActiveRun(chatId)

  const controller = new AbortController()
  activeRuns.set(chatId, controller)

  const hasMedia = Boolean(content?.some((part) => part.type === 'image'))
  const statusMessage = await ctx.reply(
    hasMedia ? 'Analyzing image…' : 'Thinking…',
  )

  try {
    const streamMessageId = statusMessage.message_id
    const agentId = getChatAgentOverride(chatId)

    const runPromise = bridge.processMessage({
      chatId,
      text: promptText,
      content,
      signal: controller.signal,
      agentId,
    })

    let lastPushed = ''
    const pushLiveUpdate = async (force = false) => {
      const display = bridge.getDisplayText(chatId).trim()
      if (!display) {
        return
      }
      if (!force && display === lastPushed) {
        return
      }
      if (!force && !bridge.shouldStreamEdit(chatId)) {
        return
      }
      try {
        const text = display.slice(0, 4000)
        await ctx.api.editMessageText(chatId, streamMessageId, text)
        bridge.markStreamEdited(chatId)
        lastPushed = display
      } catch {
        // Ignore edit rate limits / unchanged message errors
      }
    }

    void pushLiveUpdate(true)
    const interval = setInterval(() => {
      void pushLiveUpdate(false)
    }, 400)

    try {
      const result = await runPromise
      clearInterval(interval)
      const finalText = result.reply.trim() || 'Done.'
      if (finalText.length <= 4000) {
        try {
          await ctx.api.editMessageText(
            chatId,
            streamMessageId,
            finalText,
          )
        } catch {
          await sendLongReply(ctx, finalText)
        }
      } else {
        try {
          await ctx.api.deleteMessage(chatId, streamMessageId)
        } catch {
          // status message may already be gone
        }
        await sendLongReply(ctx, finalText)
      }
    } catch (error) {
      clearInterval(interval)
      throw error
    }
  } catch (error) {
    if (controller.signal.aborted) {
      await ctx.api.editMessageText(
        chatId,
        statusMessage.message_id,
        'Cancelled.',
      )
      return
    }

    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.'
    await ctx.api.editMessageText(
      chatId,
      statusMessage.message_id,
      `Error: ${escapeHtml(message)}`,
      { parse_mode: 'HTML' },
    )
  } finally {
    activeRuns.delete(chatId)
  }
}

function checkAccessForText(
  ctx: Context,
  deps: TelegramHandlerDeps,
  text: string,
): { allowed: boolean; cleanedText?: string; replyWith?: string } {
  const user = ctx.from
  if (!user) {
    return { allowed: false }
  }

  const chatId = String(ctx.chat?.id ?? user.id)
  const senderUserId = String(user.id)
  const isGroup = isGroupChatType(ctx.chat?.type)

  if (isGroup) {
    return checkGroupMessageAccess({
      config: deps.config,
      chatId,
      senderUserId,
      text,
      entities: ctx.message?.caption
        ? ctx.message.entities
        : ctx.message?.entities,
      botUsername: deps.botUsername,
    })
  }

  if (isOwnerUser(deps.config, senderUserId)) {
    registerOwnerDmChat(chatId, senderUserId)
    return { allowed: true, cleanedText: text }
  }

  return { allowed: false, cleanedText: text }
}

async function checkDmAccessForMessage(
  ctx: Context,
  deps: TelegramHandlerDeps,
  text: string,
): Promise<{ allowed: boolean; cleanedText?: string; replyWith?: string }> {
  const user = ctx.from
  if (!user) {
    return { allowed: false }
  }

  const chatId = String(ctx.chat?.id ?? user.id)
  const senderUserId = String(user.id)

  if (isGroupChatType(ctx.chat?.type)) {
    return checkAccessForText(ctx, deps, text)
  }

  if (isOwnerUser(deps.config, senderUserId)) {
    registerOwnerDmChat(chatId, senderUserId)
    return { allowed: true, cleanedText: text }
  }

  const approved = await isUserApproved('telegram', senderUserId)
  const dmAccess = checkDmAccess({
    config: deps.config,
    userId: senderUserId,
    isApproved: approved,
  })

  if (dmAccess.allowed) {
    registerOwnerDmChat(chatId, senderUserId)
    return { allowed: true, cleanedText: text }
  }

  if (dmAccess.reason === 'pairing_required') {
    const request = await createPairingRequest({
      channel: 'telegram',
      userId: senderUserId,
      chatId,
      username: user.username,
    })

    return {
      allowed: false,
      replyWith:
        `Siya pairing required.\n\n` +
        `Your pairing code: ${request.code}\n\n` +
        `On your computer run:\n` +
        `  siya pairing approve telegram ${request.code}\n\n` +
        `Code expires in 15 minutes.`,
    }
  }

  return {
    allowed: false,
    replyWith:
      'You are not authorized to use this bot. Ask the owner to add your Telegram user ID to allowFrom in gateway.json.',
  }
}

function getCommandContext(deps: TelegramHandlerDeps) {
  return {
    bridge: deps.bridge,
    config: deps.config,
    botUsername: deps.botUsername,
    projectCwd: deps.projectCwd,
    abortRun: abortActiveRun,
    getChatAgent: getChatAgentOverride,
    setChatAgent: setChatAgentOverride,
    clearChatAgent: clearChatAgentState,
    runAgent: async (ctx: Context, prompt: string) => {
      await processAgentMessage(ctx, deps, { promptText: prompt })
    },
  }
}

async function tryHandleCommand(
  ctx: Context,
  deps: TelegramHandlerDeps,
  text: string,
): Promise<boolean> {
  const parsed = parseBotCommand(text)
  if (!parsed) {
    return false
  }

  const access = await checkDmAccessForMessage(ctx, deps, text)
  if (access.replyWith) {
    await ctx.reply(access.replyWith)
    return true
  }
  if (!access.allowed) {
    return true
  }

  return handleTelegramCommand(
    ctx,
    getCommandContext(deps),
    parsed.command,
    parsed.args,
  )
}

async function handleIncomingMessage(
  ctx: Context,
  deps: TelegramHandlerDeps,
  options: { text: string; content?: MessageContent[] },
): Promise<void> {
  const chatId = String(ctx.chat?.id ?? ctx.from?.id)

  if (await tryHandleCommand(ctx, deps, options.text)) {
    return
  }

  const api = getTelegramApi()
  if (api && hasPendingAskUser(chatId)) {
    const handled = await handleAskUserTextReply(chatId, options.text, api)
    if (handled) {
      return
    }
  }

  const access = await checkDmAccessForMessage(ctx, deps, options.text)
  if (access.replyWith) {
    await ctx.reply(access.replyWith)
    return
  }
  if (!access.allowed) {
    return
  }

  const promptText = access.cleanedText ?? options.text
  await processAgentMessage(ctx, deps, {
    promptText,
    content: options.content,
  })
}

export function registerTelegramHandlers(
  bot: Bot,
  deps: TelegramHandlerDeps,
): void {
  const commandCtx = getCommandContext(deps)

  for (const commandName of TELEGRAM_COMMAND_NAMES) {
    bot.command(commandName, async (ctx) => {
      const access = await checkDmAccessForMessage(
        ctx,
        deps,
        `/${commandName}`,
      )
      if (access.replyWith) {
        await ctx.reply(access.replyWith)
        return
      }
      if (!access.allowed) {
        return
      }

      const text = ctx.message?.text ?? `/${commandName}`
      const parsed = parseBotCommand(text)
      await handleTelegramCommand(
        ctx,
        commandCtx,
        parsed?.command ?? commandName,
        parsed?.args ?? '',
      )
    })
  }

  bot.on('callback_query:data', async (ctx) => {
    const chatId = String(ctx.chat?.id ?? ctx.from?.id)
    const data = ctx.callbackQuery.data
    const api = getTelegramApi()

    if (!api || !data) {
      await ctx.answerCallbackQuery()
      return
    }

    const handled = await handleAskUserCallback(chatId, data, api)
    await ctx.answerCallbackQuery()
    if (!handled) {
      return
    }
  })

  bot.on('message:text', async (ctx) => {
    const text = ctx.message?.text?.trim()
    if (!text) {
      return
    }

    await handleIncomingMessage(ctx, deps, { text })
  })

  bot.on('message:photo', async (ctx) => {
    const caption = ctx.message?.caption?.trim() ?? ''
    const isGroup = isGroupChatType(ctx.chat?.type)

    if (isGroup) {
      if (
        !caption ||
        !isBotMentioned({
          text: caption,
          entities: ctx.message?.caption_entities,
          botUsername: deps.botUsername,
          mentionAliases: deps.config.mentionAliases,
        })
      ) {
        return
      }
    }

    const access = await checkDmAccessForMessage(
      ctx,
      deps,
      isGroup ? caption : caption || 'Analyze this screenshot.',
    )
    if (access.replyWith) {
      await ctx.reply(access.replyWith)
      return
    }
    if (!access.allowed) {
      return
    }

    try {
      const media = await extractMediaFromMessage({
        ctx,
        botToken: deps.botToken,
        projectCwd: deps.projectCwd,
        fallbackPrompt: access.cleanedText ?? 'Analyze this screenshot.',
      })

      await processAgentMessage(ctx, deps, {
        promptText: media.promptText,
        content: media.content.length > 0 ? media.content : undefined,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to process image.'
      await ctx.reply(`Error: ${message}`)
    }
  })

  bot.on('message:document', async (ctx) => {
    const caption = ctx.message?.caption?.trim() ?? ''
    const isGroup = isGroupChatType(ctx.chat?.type)

    if (isGroup) {
      if (
        !caption ||
        !isBotMentioned({
          text: caption,
          entities: ctx.message?.caption_entities,
          botUsername: deps.botUsername,
          mentionAliases: deps.config.mentionAliases,
        })
      ) {
        return
      }
    }

    const access = await checkDmAccessForMessage(
      ctx,
      deps,
      isGroup ? caption : caption || 'Analyze this file.',
    )
    if (access.replyWith) {
      await ctx.reply(access.replyWith)
      return
    }
    if (!access.allowed) {
      return
    }

    try {
      const media = await extractMediaFromMessage({
        ctx,
        botToken: deps.botToken,
        projectCwd: deps.projectCwd,
        fallbackPrompt: access.cleanedText ?? 'Analyze this file.',
      })

      await processAgentMessage(ctx, deps, {
        promptText: media.promptText,
        content: media.content.length > 0 ? media.content : undefined,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to process file.'
      await ctx.reply(`Error: ${message}`)
    }
  })
}
