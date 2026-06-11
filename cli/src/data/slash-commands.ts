import { AGENT_MODES } from '../utils/constants'

import type { SkillsMap } from '@siya/common/types/skill'

export interface SlashCommand {
  id: string
  label: string
  description: string
  aliases?: string[]
  implicitCommand?: boolean
  insertText?: string
}

const MODE_DESCRIPTIONS: Record<(typeof AGENT_MODES)[number], string> = {
  DEFAULT:
    'Balanced — full tools, todos, code review, OpenRouter free default',
  LITE: 'Fast — skips todos & review, quicker edits, OpenRouter free default',
  MAX: 'Best-of-N — parallel editors/reviewers, MiMo default, deepest quality',
  PLAN: 'Plan only — read-only tools, no file writes or shell edits',
}

const MODE_COMMANDS: SlashCommand[] = AGENT_MODES.map((mode) => ({
  id: `mode:${mode.toLowerCase()}`,
  label: `mode:${mode.toLowerCase()}`,
  description: `Switch to ${mode} mode — ${MODE_DESCRIPTIONS[mode]}`,
}))

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'help',
    label: 'help',
    description: 'Display keyboard shortcuts and tips',
    aliases: ['h', '?'],
    implicitCommand: true,
  },
  {
    id: 'init',
    label: 'init',
    description: 'Create a starter knowledge.md file',
    implicitCommand: true,
  },
  {
    id: 'interview',
    label: 'interview',
    description: 'AI asks a series of questions to flesh out request into a spec',
  },
  {
    id: 'plan',
    label: 'plan',
    description: 'Create a plan with GPT 5.4',
  },
  {
    id: 'review',
    label: 'review',
    description: 'Review code changes with GPT 5.4',
  },
  {
    id: 'new',
    label: 'new',
    description: 'Clear the conversation history and start a new chat',
    aliases: ['n', 'clear', 'c', 'reset'],
    implicitCommand: true,
  },
  {
    id: 'history',
    label: 'history',
    description: 'Browse and resume past conversations',
    aliases: ['chats'],
  },
  {
    id: 'agent:gpt-5',
    label: 'agent:gpt-5',
    description: 'Spawn the GPT-5 agent to help solve complex problems',
    insertText: '@GPT-5 Agent ',
  },
  {
    id: 'feedback',
    label: 'feedback',
    description: 'Share general feedback about Siya',
  },
  {
    id: 'bash',
    label: 'bash',
    description: 'Enter bash mode ("!" at beginning enters bash mode)',
    aliases: ['!'],
  },
  {
    id: 'image',
    label: 'image',
    description: 'Attach an image file (or Ctrl+V to paste from clipboard)',
    aliases: ['img', 'attach'],
  },
  {
    id: 'model',
    label: 'model',
    description: 'Pick main LLM (↑↓ Enter) — OpenRouter + OpenCode Zen free',
    insertText: '/model ',
  },
  ...MODE_COMMANDS,
  {
    id: 'theme',
    label: 'theme',
    description: 'Pick color palette (↑↓ Enter) — Nightfox, Dracula, Nord…',
    insertText: '/theme ',
  },
  {
    id: 'theme:toggle',
    label: 'theme:toggle',
    description: 'Toggle between light and dark mode',
  },
  {
    id: 'exit',
    label: 'exit',
    description: 'Quit the CLI',
    aliases: ['quit', 'q'],
    implicitCommand: true,
  },
]

export const SLASHLESS_COMMAND_IDS = new Set(
  SLASH_COMMANDS.filter((cmd) => cmd.implicitCommand).map((cmd) =>
    cmd.id.toLowerCase(),
  ),
)

const SKILL_MENU_DESCRIPTION_MAX_LENGTH = 50

function truncateDescription(description: string): string {
  if (description.length <= SKILL_MENU_DESCRIPTION_MAX_LENGTH) {
    return description
  }
  return description.slice(0, SKILL_MENU_DESCRIPTION_MAX_LENGTH - 1) + '…'
}

export function getSlashCommandsWithSkills(skills: SkillsMap): SlashCommand[] {
  const skillCommands: SlashCommand[] = Object.values(skills).map((skill) => ({
    id: `skill:${skill.name}`,
    label: `skill:${skill.name}`,
    description: truncateDescription(skill.description),
  }))

  return [...SLASH_COMMANDS, ...skillCommands]
}
