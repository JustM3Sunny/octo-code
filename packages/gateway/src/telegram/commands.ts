import { loadGatewayConfigSync } from '../config/load-config'
import {
  cancelScheduledTask,
  createScheduledTask,
  isSchedulerRunning,
  listScheduledTasks,
} from '../scheduler/engine'
import { clearTelegramSession, listTelegramSessions } from '../session/session-store'
import { listPendingPairings } from '../security/pairing'
import { isOwnerUser } from '../security/group-access'
import {
  TELEGRAM_BOT_COMMANDS,
  TELEGRAM_COMMAND_NAMES,
  normalizeTelegramCommand,
} from './command-catalog'
import {
  GPT5_AGENT_PROMPT_PREFIX,
  INIT_AGENT_PROMPT,
  buildInterviewPrompt,
  buildPlanPrompt,
  buildReviewPromptFromArgs,
} from './command-prompts'
import {
  TELEGRAM_MODE_TO_AGENT,
  getChatMode,
  setChatMode,
  clearChatAgentState,
} from './chat-agent'
import { runTelegramInitProject } from './init-project'
import { chunkTelegramMessage } from './format'
import { getTelegramOutboundDebugState, sendTelegramText } from './outbound'

import { loadSkills } from '@siya/sdk'

import type { BotCommand } from 'grammy/types'
import type { Context } from 'grammy'
import type { TelegramChannelConfig } from '@siya/common/types/gateway'
import type { SiyaBridge } from '../bridge/siya-bridge'

export { TELEGRAM_BOT_COMMANDS, TELEGRAM_COMMAND_NAMES, normalizeTelegramCommand }

export async function registerTelegramBotCommands(
  setCommands: (commands: BotCommand[]) => Promise<boolean>,
): Promise<void> {
  await setCommands(TELEGRAM_BOT_COMMANDS)
}

function formatHelpText(botUsername?: string): string {
  const mention = botUsername ? `@${botUsername}` : 'the bot'
  const lines = TELEGRAM_BOT_COMMANDS.map(
    (cmd) => `/${cmd.command} — ${cmd.description}`,
  )

  return (
    `Siya commands (matches CLI slash commands)\n\n` +
    lines.join('\n') +
    `\n\nAliases: /clear /reset → /new, /h /? → /help, /chats → /history, /img → /image` +
    `\nModes: /mode_lite or /mode lite` +
    `\n\nChat: send any message to talk to the agent.` +
    `\nGroups: mention ${mention}.` +
    `\nPhotos/files: send directly (or /image).` +
    `\nAgent questions: inline buttons (ask_user).`
  )
}

async function replyLong(ctx: Context, text: string): Promise<void> {
  for (const chunk of chunkTelegramMessage(text)) {
    await ctx.reply(chunk)
  }
}

function parseScheduleArgs(args: string): {
  delay?: string
  prompt: string
} | null {
  const inMatch = args.trim().match(/^in\s+(\d+)\s*(s|m|h|d)\s+(.+)$/is)
  if (inMatch) {
    return {
      delay: `${inMatch[1]}${inMatch[2]}`,
      prompt: inMatch[3]!.trim(),
    }
  }
  if (args.trim()) {
    return { prompt: args.trim() }
  }
  return null
}

export type CommandHandlerContext = {
  bridge: SiyaBridge
  config: TelegramChannelConfig
  botUsername?: string
  projectCwd: string
  abortRun: (chatId: string) => void
  getChatAgent: (chatId: string) => string | undefined
  setChatAgent: (chatId: string, agentId: string) => void
  clearChatAgent: (chatId: string) => void
  runAgent: (ctx: Context, prompt: string) => Promise<void>
}

export async function handleTelegramCommand(
  ctx: Context,
  deps: CommandHandlerContext,
  command: string,
  args: string,
): Promise<boolean> {
  const chatId = String(ctx.chat?.id ?? ctx.from?.id)
  const normalized = normalizeTelegramCommand(command)

  switch (normalized) {
    case 'start':
      await ctx.reply(
        'Siya Telegram gateway is connected.\n\n' +
          'Type /help for all commands (same as CLI).\n' +
          'Send text, screenshots, or files to work with your agent.\n' +
          'The agent uses ask_user with inline buttons on Telegram.\n' +
          (deps.botUsername
            ? `In groups, mention @${deps.botUsername}.`
            : ''),
      )
      return true

    case 'help':
      await replyLong(ctx, formatHelpText(deps.botUsername))
      return true

    case 'chatid':
    case 'groupid':
      await ctx.reply(
        `Chat ID: ${chatId}\n` +
          `User ID: ${ctx.from?.id ?? 'unknown'}\n` +
          `Type: ${ctx.chat?.type ?? 'unknown'}`,
      )
      return true

    case 'ping':
      await ctx.reply('pong')
      return true

    case 'health': {
      const config = loadGatewayConfigSync({
        cwd: deps.projectCwd,
        verbose: false,
      })
      await ctx.reply(`Health: http://127.0.0.1:${config.gateway.port}/health`)
      return true
    }

    case 'status': {
      const outbound = getTelegramOutboundDebugState()
      const agent = deps.getChatAgent(chatId) ?? deps.config.defaultAgent
      const mode = getChatMode(chatId) ?? 'default'
      await ctx.reply(
        `Gateway: ${outbound.ready ? 'running' : 'not ready'}\n` +
          `Scheduler: ${isSchedulerRunning() ? 'running' : 'stopped'}\n` +
          `Mode: ${mode}\n` +
          `Agent: ${agent}\n` +
          `Default agent: ${deps.config.defaultAgent}\n` +
          `Owner: ${outbound.ownerUserId ?? deps.config.ownerUserId ?? 'not set'}\n` +
          `Project: ${deps.projectCwd}`,
      )
      return true
    }

    case 'tasks': {
      const tasks = await listScheduledTasks({ includeCompleted: false })
      if (tasks.length === 0) {
        await ctx.reply('No scheduled tasks.')
        return true
      }
      const lines = tasks.slice(0, 20).map((task) => {
        const when = task.nextRunAt
          ? new Date(task.nextRunAt).toLocaleString()
          : 'n/a'
        return `• ${task.id.slice(0, 8)} — ${task.label ?? task.taskType} — ${when}`
      })
      await replyLong(
        ctx,
        `Scheduled tasks (${tasks.length}):\n\n${lines.join('\n')}\n\nCancel: /cancel_task <id>`,
      )
      return true
    }

    case 'schedule': {
      const parsed = parseScheduleArgs(args)
      if (!parsed) {
        await ctx.reply(
          'Usage:\n' +
            '/schedule in 10m check build status\n' +
            '/schedule in 1h remind me to review PR\n' +
            '/schedule <prompt> (runs once ASAP as agent task)',
        )
        return true
      }
      const task = await createScheduledTask({
        prompt: parsed.prompt,
        taskType: 'agent_task',
        delay: parsed.delay,
        notifyTelegram: true,
        agentId: deps.getChatAgent(chatId) ?? deps.config.defaultAgent,
        source: 'telegram',
        metadata: { chatId },
      })
      await ctx.reply(
        `Scheduled task ${task.id.slice(0, 8)}\n` +
          `Next run: ${new Date(task.nextRunAt).toLocaleString()}\n` +
          `Prompt: ${task.prompt.slice(0, 200)}`,
      )
      return true
    }

    case 'cancel_task': {
      const taskId = args.trim()
      if (!taskId) {
        await ctx.reply('Usage: /cancel_task <task-id-prefix>\nUse /tasks to list.')
        return true
      }
      const tasks = await listScheduledTasks({ includeCompleted: true })
      const match = tasks.find(
        (task) => task.id === taskId || task.id.startsWith(taskId),
      )
      if (!match) {
        await ctx.reply(`No task found matching "${taskId}".`)
        return true
      }
      await cancelScheduledTask(match.id)
      await ctx.reply(`Cancelled task ${match.id.slice(0, 8)}.`)
      return true
    }

    case 'notify': {
      const message = args.trim() || 'Test notification from Siya Telegram bot.'
      try {
        await sendTelegramText({ message, target: 'current_chat', chatId })
        await ctx.reply('Notification sent.')
      } catch (error) {
        await ctx.reply(
          `Failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      return true
    }

    case 'feedback': {
      const text = args.trim()
      if (!text) {
        await ctx.reply('Usage: /feedback your message here')
        return true
      }
      try {
        await sendTelegramText({
          message: `📩 Feedback from Telegram (${ctx.from?.id}):\n\n${text}`,
          target: 'owner_dm',
        })
        await ctx.reply('Thanks — feedback sent to the owner.')
      } catch {
        await ctx.reply('Could not deliver feedback. Owner DM may be unavailable.')
      }
      return true
    }

    case 'pairing': {
      const userId = String(ctx.from?.id ?? '')
      if (!isOwnerUser(deps.config, userId)) {
        await ctx.reply('Only the bot owner can view pairing requests.')
        return true
      }
      const pending = await listPendingPairings('telegram')
      if (pending.length === 0) {
        await ctx.reply('No pending pairing requests.')
        return true
      }
      const lines = pending.map(
        (req) =>
          `• ${req.code} — user ${req.userId}${req.username ? ` (@${req.username})` : ''}`,
      )
      await replyLong(
        ctx,
        `Pending pairing (${pending.length}):\n\n${lines.join('\n')}\n\nApprove on PC:\n  siya pairing approve telegram <CODE>`,
      )
      return true
    }

    case 'agent': {
      const trimmed = args.trim()
      if (!trimmed) {
        const current = deps.getChatAgent(chatId) ?? deps.config.defaultAgent
        const mode = getChatMode(chatId)
        await ctx.reply(
          `Agent: ${current}${mode ? ` (mode: ${mode})` : ''}\n\n` +
            `Set: /agent base2-lite\n` +
            `Modes: /mode_lite /mode_max /mode_plan /mode_default`,
        )
        return true
      }
      deps.setChatAgent(chatId, trimmed)
      await ctx.reply(`Agent set to: ${trimmed}`)
      return true
    }

    case 'agents':
      await ctx.reply(
        'Built-in agents:\n' +
          '• base2 — DEFAULT\n' +
          '• base2-lite — LITE\n' +
          '• base2-max — MAX\n' +
          '• base2-plan — PLAN\n' +
          '• base2-fast\n\n' +
          'Use /agent <id> or /mode_lite etc.',
      )
      return true

    case 'mode': {
      const parts = args.trim().split(/\s+/).filter(Boolean)
      const modeArg = parts[0]?.toLowerCase() || 'default'
      const rest = parts.slice(1).join(' ')
      const agentId = setChatMode(chatId, modeArg)
      await ctx.reply(`Mode: ${modeArg} → agent ${agentId}`)
      if (rest) {
        await deps.runAgent(ctx, rest)
      }
      return true
    }

    case 'mode_default':
    case 'mode_lite':
    case 'mode_max':
    case 'mode_plan': {
      const modeKey = normalized.replace('mode_', '')
      const agentId = setChatMode(chatId, modeKey)
      await ctx.reply(`Switched to ${modeKey.toUpperCase()} mode (${agentId}).`)
      return true
    }

    case 'model': {
      const agent = deps.getChatAgent(chatId) ?? deps.config.defaultAgent
      const mode = getChatMode(chatId) ?? 'default'
      await ctx.reply(
        `Telegram uses agent/mode (not CLI model picker).\n\n` +
          `Current: ${agent} (${mode})\n\n` +
          `Switch:\n` +
          `/mode_default /mode_lite /mode_max /mode_plan\n` +
          `or /mode lite`,
      )
      return true
    }

    case 'theme':
      await ctx.reply(
        'Theme commands are CLI-only (TUI color palettes).\n' +
          'Telegram uses your Telegram app theme automatically.',
      )
      return true

    case 'theme_toggle':
      await ctx.reply('Theme toggle is CLI-only. Use /theme in the Siya terminal app.')
      return true

    case 'image':
      await ctx.reply(
        'Send a photo or image document directly to this chat.\n' +
          'Optional caption becomes your prompt.\n' +
          'Screenshots are analyzed by the vision-capable agent.',
      )
      return true

    case 'history': {
      const sessions = listTelegramSessions()
      if (sessions.length === 0) {
        await ctx.reply('No saved Telegram sessions yet.')
        return true
      }
      await replyLong(
        ctx,
        `Telegram sessions (${sessions.length}):\n\n${sessions.slice(0, 30).join('\n')}`,
      )
      return true
    }

    case 'skills': {
      try {
        const skills = await loadSkills({ cwd: deps.projectCwd, verbose: false })
        const names = Object.keys(skills)
        if (names.length === 0) {
          await ctx.reply('No skills found in this project.')
          return true
        }
        await replyLong(
          ctx,
          `Skills (${names.length}):\n\n${names.map((n) => `• ${n}`).join('\n')}\n\nRun: /skill <name> [prompt]`,
        )
      } catch (error) {
        await ctx.reply(
          `Failed to load skills: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      return true
    }

    case 'skill': {
      const trimmed = args.trim()
      if (!trimmed) {
        await ctx.reply('Usage: /skill <skill-name> [optional prompt]')
        return true
      }
      const space = trimmed.indexOf(' ')
      const skillName = space === -1 ? trimmed : trimmed.slice(0, space)
      const userArgs = space === -1 ? '' : trimmed.slice(space + 1).trim()
      const skills = await loadSkills({ cwd: deps.projectCwd, verbose: false })
      const skill = skills[skillName]
      if (!skill) {
        await ctx.reply(`Skill not found: ${skillName}\nUse /skills to list.`)
        return true
      }
      const prompt =
        `I invoke the following skill:\n\n<skill name="${skill.name}">\n${skill.content}\n</skill>\n\n` +
        (userArgs ? `User request: ${userArgs}` : '')
      await deps.runAgent(ctx, prompt)
      return true
    }

    case 'init': {
      const messages = runTelegramInitProject(deps.projectCwd)
      await replyLong(ctx, messages.join('\n'))
      if (args.trim()) {
        await deps.runAgent(ctx, `${INIT_AGENT_PROMPT}\n\n${args.trim()}`)
      } else {
        await deps.runAgent(ctx, INIT_AGENT_PROMPT)
      }
      return true
    }

    case 'interview': {
      await deps.runAgent(ctx, buildInterviewPrompt(args))
      return true
    }

    case 'plan': {
      await deps.runAgent(ctx, buildPlanPrompt(args))
      return true
    }

    case 'review': {
      await deps.runAgent(ctx, buildReviewPromptFromArgs(args))
      return true
    }

    case 'bash': {
      const cmd = args.trim()
      if (!cmd) {
        await ctx.reply('Usage: /bash <command>\nExample: /bash npm test')
        return true
      }
      await deps.runAgent(
        ctx,
        `Run this terminal command in the project and show me the full output:\n\n${cmd}`,
      )
      return true
    }

    case 'gpt5': {
      const prompt = args.trim()
        ? `${GPT5_AGENT_PROMPT_PREFIX}${args.trim()}`
        : `${GPT5_AGENT_PROMPT_PREFIX}Help me with my current project.`
      await deps.runAgent(ctx, prompt)
      return true
    }

    case 'new': {
      deps.abortRun(chatId)
      deps.clearChatAgent(chatId)
      await clearTelegramSession(chatId)
      if (args.trim()) {
        await deps.runAgent(ctx, args.trim())
      } else {
        await ctx.reply('Fresh conversation. Send your next message.')
      }
      return true
    }

    case 'cancel':
      deps.abortRun(chatId)
      await ctx.reply('Cancelled the current run.')
      return true

    default:
      return false
  }
}

export function parseBotCommand(text: string): {
  command: string
  args: string
} | null {
  const match = text.trim().match(/^\/([a-zA-Z0-9_]+)(?:@[\w_]+)?(?:\s+(.*))?$/s)
  if (!match) {
    return null
  }
  const command = normalizeTelegramCommand(match[1] ?? '')
  return {
    command,
    args: (match[2] ?? '').trim(),
  }
}

export function listTelegramModeAgents(): string {
  return Object.entries(TELEGRAM_MODE_TO_AGENT)
    .map(([mode, id]) => `${mode} → ${id}`)
    .join(', ')
}
