import type { BotCommand } from 'grammy/types'

/** Maps CLI slash ids / aliases → canonical Telegram command name */
export const TELEGRAM_COMMAND_ALIASES: Record<string, string> = {
  h: 'help',
  '?': 'help',
  n: 'new',
  c: 'clear',
  clear: 'new',
  reset: 'new',
  chats: 'history',
  img: 'image',
  attach: 'image',
  q: 'cancel',
  quit: 'cancel',
  exit: 'cancel',
  bug: 'feedback',
  report: 'feedback',
  '!': 'bash',
  'mode:default': 'mode_default',
  'mode:lite': 'mode_lite',
  'mode:max': 'mode_max',
  'mode:plan': 'mode_plan',
  'theme:toggle': 'theme_toggle',
  'agent:gpt-5': 'gpt5',
  'gpt-5-agent': 'gpt5',
  userid: 'chatid',
}

export const TELEGRAM_BOT_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'Welcome and connect' },
  { command: 'help', description: 'All commands (same as CLI)' },
  { command: 'new', description: 'Fresh chat / clear session' },
  { command: 'cancel', description: 'Stop current agent run' },
  { command: 'ping', description: 'Bot health check' },
  { command: 'status', description: 'Gateway + scheduler status' },
  { command: 'health', description: 'Health endpoint URL' },
  { command: 'chatid', description: 'This chat ID' },
  { command: 'groupid', description: 'Group chat ID' },
  { command: 'agent', description: 'Show/set agent id' },
  { command: 'agents', description: 'List available agents' },
  { command: 'mode', description: 'Set mode: default|lite|max|plan' },
  { command: 'mode_default', description: 'Switch to DEFAULT mode' },
  { command: 'mode_lite', description: 'Switch to LITE mode' },
  { command: 'mode_max', description: 'Switch to MAX mode' },
  { command: 'mode_plan', description: 'Switch to PLAN mode' },
  { command: 'init', description: 'Create knowledge.md + .agents/' },
  { command: 'interview', description: 'Interview → spec (ask_user)' },
  { command: 'plan', description: 'Planning workflow' },
  { command: 'review', description: 'Code review workflow' },
  { command: 'bash', description: 'Run shell via agent' },
  { command: 'image', description: 'How to send screenshots' },
  { command: 'model', description: 'Model / mode info' },
  { command: 'history', description: 'Telegram session list' },
  { command: 'tasks', description: 'List scheduled tasks' },
  { command: 'schedule', description: 'Schedule task (in 5m …)' },
  { command: 'cancel_task', description: 'Cancel scheduled task by id' },
  { command: 'notify', description: 'Send test Telegram message' },
  { command: 'feedback', description: 'Send feedback to owner' },
  { command: 'skills', description: 'List project skills' },
  { command: 'skill', description: 'Run skill by name' },
  { command: 'pairing', description: 'Pairing status (owner)' },
  { command: 'gpt5', description: 'Spawn GPT-5 agent' },
  { command: 'theme', description: 'CLI-only theme info' },
  { command: 'theme_toggle', description: 'CLI-only theme toggle info' },
]

export const TELEGRAM_COMMAND_NAMES = TELEGRAM_BOT_COMMANDS.map(
  (cmd) => cmd.command,
)

export function normalizeTelegramCommand(command: string): string {
  const lower = command.toLowerCase().replace(/:/g, '_')
  return TELEGRAM_COMMAND_ALIASES[lower] ?? lower
}
