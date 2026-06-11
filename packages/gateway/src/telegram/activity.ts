import type { PrintModeEvent } from '@siya/common/types/print-mode'

const HIDDEN_TOOLS = new Set(['end_turn', 'spawn_agent_inline'])

function readPaths(input?: Record<string, unknown>): string[] {
  if (Array.isArray(input?.paths)) {
    return input.paths.filter((p): p is string => typeof p === 'string')
  }
  if (Array.isArray(input?.filePaths)) {
    return input.filePaths.filter((p): p is string => typeof p === 'string')
  }
  return []
}

function capitalizeToolName(toolName: string): string {
  return toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatToolCallLabel(
  toolName: string,
  input?: Record<string, unknown>,
): string {
  const paths = readPaths(input)

  if (toolName === 'read_files' && paths.length > 0) {
    const preview = paths.slice(0, 2).join(', ')
    const suffix = paths.length > 2 ? ` +${paths.length - 2}` : ''
    return `Read ${preview}${suffix}`
  }

  if (toolName === 'read_subtree' && paths.length > 0) {
    return `Read subtree ${paths.slice(0, 2).join(', ')}`
  }

  if (
    toolName === 'run_terminal_command' &&
    typeof input?.command === 'string'
  ) {
    const command = input.command.trim()
    const short = command.length > 72 ? `${command.slice(0, 72)}…` : command
    return `Run: ${short}`
  }

  if (
    (toolName === 'str_replace' ||
      toolName === 'write_file' ||
      toolName === 'propose_str_replace' ||
      toolName === 'propose_write_file') &&
    typeof input?.path === 'string'
  ) {
    const verb =
      toolName.includes('write') || toolName === 'write_file'
        ? 'Write'
        : 'Edit'
    return `${verb} ${input.path}`
  }

  if (toolName === 'change_file' && typeof input?.path === 'string') {
    return `Edit ${input.path}`
  }

  if (toolName === 'apply_patch') {
    return 'Apply patch'
  }

  if (toolName === 'code_search' && typeof input?.query === 'string') {
    return `Search: ${input.query.slice(0, 60)}`
  }

  if (toolName === 'glob' && typeof input?.pattern === 'string') {
    return `Glob: ${input.pattern}`
  }

  if (toolName === 'list_directory' && typeof input?.path === 'string') {
    return `List ${input.path}`
  }

  if (toolName === 'notify_telegram' && typeof input?.message === 'string') {
    const msg = input.message.trim()
    return `Notify TG: ${msg.slice(0, 50)}${msg.length > 50 ? '…' : ''}`
  }

  if (toolName === 'send_telegram_file' && typeof input?.file_path === 'string') {
    return `Send file ${input.file_path}`
  }

  if (toolName === 'ask_user') {
    const count = Array.isArray(input?.questions)
      ? input.questions.length
      : 0
    return count > 0 ? `Ask user (${count} question${count === 1 ? '' : 's'})` : 'Ask user'
  }

  if (toolName === 'spawn_agents' && Array.isArray(input?.agents)) {
    return `Spawn ${input.agents.length} agent${input.agents.length === 1 ? '' : 's'}`
  }

  if (toolName === 'schedule_task' && typeof input?.prompt === 'string') {
    return `Schedule: ${input.prompt.slice(0, 50)}`
  }

  return capitalizeToolName(toolName)
}

function statusIcon(status: ActivityEntry['status']): string {
  if (status === 'done') return '✓'
  if (status === 'error') return '✗'
  return '●'
}

export type ActivityEntry = {
  id: string
  label: string
  status: 'running' | 'done' | 'error'
}

export class TelegramActivityTracker {
  private tools = new Map<string, ActivityEntry>()
  private toolOrder: string[] = []
  private subagents: string[] = []
  private maxToolLines: number

  constructor(options?: { maxToolLines?: number }) {
    this.maxToolLines = options?.maxToolLines ?? 16
  }

  reset(): void {
    this.tools.clear()
    this.toolOrder = []
    this.subagents = []
  }

  hasVisibleContent(): boolean {
    return this.toolOrder.length > 0 || this.subagents.length > 0
  }

  onEvent(event: PrintModeEvent): void {
    switch (event.type) {
      case 'tool_call': {
        if (HIDDEN_TOOLS.has(event.toolName)) {
          return
        }
        const label = formatToolCallLabel(event.toolName, event.input)
        this.tools.set(event.toolCallId, {
          id: event.toolCallId,
          label,
          status: 'running',
        })
        if (!this.toolOrder.includes(event.toolCallId)) {
          this.toolOrder.push(event.toolCallId)
        }
        break
      }
      case 'tool_result': {
        if (HIDDEN_TOOLS.has(event.toolName)) {
          return
        }
        const existing = this.tools.get(event.toolCallId)
        if (existing) {
          existing.status = 'done'
        } else {
          this.tools.set(event.toolCallId, {
            id: event.toolCallId,
            label: formatToolCallLabel(event.toolName),
            status: 'done',
          })
          this.toolOrder.push(event.toolCallId)
        }
        break
      }
      case 'subagent_start': {
        this.subagents.push(`🤖 ${event.displayName || event.agentType}`)
        break
      }
      case 'subagent_finish': {
        const name = event.displayName || event.agentType
        const idx = this.subagents.findIndex((line) => line.includes(name))
        if (idx >= 0) {
          this.subagents[idx] = `✓ ${name}`
        }
        break
      }
      case 'error': {
        const lastId = this.toolOrder[this.toolOrder.length - 1]
        if (lastId) {
          const entry = this.tools.get(lastId)
          if (entry?.status === 'running') {
            entry.status = 'error'
          }
        }
        break
      }
      default:
        break
    }
  }

  formatActivityBlock(): string {
    const lines: string[] = []

    if (this.subagents.length > 0) {
      lines.push(...this.subagents.slice(-6))
    }

    const recentToolIds = this.toolOrder.slice(-this.maxToolLines)
    for (const id of recentToolIds) {
      const entry = this.tools.get(id)
      if (!entry) continue
      lines.push(`${statusIcon(entry.status)} ${entry.label}`)
    }

    return lines.join('\n')
  }

  formatFullMessage(streamText: string, finalText?: string): string {
    const activity = this.formatActivityBlock()
    const body = (finalText ?? streamText).trim()

    if (!activity && !body) {
      return ''
    }

    if (!activity) {
      return body
    }

    if (!body) {
      return activity
    }

    return `${activity}\n\n---\n${body}`
  }
}
