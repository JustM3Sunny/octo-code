import { AskUserBridge } from '@siya/common/utils/ask-user-bridge'
import { SiyaClient, verifyOpenRouterAuth, resetOpenRouterProviderCache } from '@siya/sdk'
import { hasOpenRouterApiKey } from '@siya/common/constants/openrouter-auth'
import { buildGatewayRunContext } from '@siya/gateway'

import { getCliEnv, getSystemProcessEnv } from './env'
import { loadAgentDefinitions } from './local-agent-registry'
import { logger } from './logger'
import { createTraceWriter } from './trace-writer'
import { getRgPath } from '../native/ripgrep'
import { getProjectRoot } from '../project-files'

const OPENROUTER_API_KEY_ENV = 'OPENROUTER_API_KEY'

let clientInstance: SiyaClient | null = null

function removeUndefinedValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues) as T
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = removeUndefinedValues(value)
      }
    }
    return result as T
  }
  return obj
}

export function getOpenRouterApiKey(): string | undefined {
  const key = process.env[OPENROUTER_API_KEY_ENV]?.trim()
  return key || undefined
}

/** Reset the cached SiyaClient instance (e.g. after changing project root). */
export function resetSiyaClient(): void {
  clientInstance = null
  resetOpenRouterProviderCache()
}

/**
 * Initialize the main agent client at startup (gateway + notify tools included).
 * Call after `startEmbeddedGatewayIfConfigured` so Telegram outbound is ready.
 */
export async function warmupMainAgent(): Promise<SiyaClient | null> {
  return getSiyaClient()
}

export async function getSiyaClient(): Promise<SiyaClient | null> {
  if (!clientInstance) {
    if (hasOpenRouterApiKey()) {
      const valid = await verifyOpenRouterAuth()
      if (!valid) {
        logger.warn(
          {},
          'OpenRouter API key rejected. Fix OPENROUTER_API_KEY — requests will use OpenCode Zen until then.',
        )
      }
    }

    const apiKey = getOpenRouterApiKey() ?? 'local-zen-only'

    const projectRoot = getProjectRoot()

    const env = getCliEnv()
    if (env.SIYA_IS_BINARY) {
      try {
        const rgPath = await getRgPath()
        getSystemProcessEnv().SIYA_RG_PATH = rgPath
      } catch (error) {
        logger.error(error, 'Failed to set up ripgrep binary for SDK')
      }
    }

    try {
      const gatewayContext = buildGatewayRunContext({
        agentDefinitions: loadAgentDefinitions(),
        cwd: projectRoot,
        defaultAgentId: 'base2-lite',
        source: 'cli',
      })

      clientInstance = new SiyaClient({
        apiKey,
        cwd: projectRoot,
        agentDefinitions: gatewayContext.agentDefinitions,
        customToolDefinitions: gatewayContext.customToolDefinitions,
        logger,
        traceWriter: createTraceWriter(),
        overrideTools: {
          ask_user: async (input: ClientToolCall<'ask_user'>['input']) => {
            const askUserResponse = await AskUserBridge.request(
              'cli-override',
              input.questions,
            )
            const response = askUserResponse as {
              answers?: Array<{ questionIndex: number; selectedOption: string }>
              skipped?: boolean
            }
            return [
              {
                type: 'json',
                value: removeUndefinedValues(response),
              },
            ]
          },
        },
      })
    } catch (error) {
      logger.error(error, 'Failed to initialize SiyaClient')
      return null
    }
  }

  return clientInstance
}

export function getToolDisplayInfo(toolName: string): {
  name: string
  type: string
} {
  const TOOL_NAME_OVERRIDES: Record<string, string> = {
    read_files: 'Read',
    read_subtree: 'Read',
    write_file: 'Write',
    str_replace: 'Edit',
    propose_str_replace: 'Edit',
    propose_write_file: 'Write',
    run_terminal_command: 'Bash',
    list_directory: 'List',
    glob: 'Glob',
    code_searcher: 'Search',
    researcher_web: 'Web',
    researcher_docs: 'Docs',
    spawn_agents: 'Agent',
    write_todos: 'Todos',
    suggest_followups: 'Followups',
    read_url: 'URL',
    skill: 'Skill',
    ask_user: 'Ask',
    notify_telegram: 'Telegram',
    send_telegram_file: 'Telegram File',
    schedule_task: 'Schedule',
    list_scheduled_tasks: 'Schedules',
    cancel_scheduled_task: 'Cancel Schedule',
  }

  const capitalizeWords = (str: string) => {
    return str.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return {
    name: TOOL_NAME_OVERRIDES[toolName] ?? capitalizeWords(toolName),
    type: 'tool',
  }
}

function toYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent)

  if (obj === null || obj === undefined) {
    return 'null'
  }

  if (typeof obj === 'string') {
    if (obj.includes('\n')) {
      const lines = obj.split('\n')
      return (
        '|\n' + lines.map((line) => '  '.repeat(indent + 1) + line).join('\n')
      )
    }
    return obj.includes(':') || obj.includes('#') ? `"${obj}"` : obj
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj)
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return (
      '\n' +
      obj
        .map((item) => spaces + '- ' + toYaml(item, indent + 1).trimStart())
        .join('\n')
    )
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) return '{}'

    return entries
      .map(([key, value]) => {
        const yamlValue = toYaml(value, indent + 1)
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          Object.keys(value).length > 0
        ) {
          return `${spaces}${key}:\n${yamlValue}`
        }
        if (typeof value === 'string' && value.includes('\n')) {
          return `${spaces}${key}: ${yamlValue}`
        }
        return `${spaces}${key}: ${yamlValue}`
      })
      .join('\n')
  }

  return String(obj)
}

export function formatToolOutput(output: unknown): string {
  if (!output) return ''

  if (Array.isArray(output)) {
    return output
      .map((item) => {
        if (item.type === 'json') {
          if (
            item.value &&
            typeof item.value === 'object' &&
            'errorMessage' in item.value
          ) {
            return String(item.value.errorMessage)
          }
          return toYaml(item.value)
        }
        if (item.type === 'text') {
          return item.text || ''
        }
        return String(item)
      })
      .join('\n')
  }

  if (typeof output === 'string') {
    return output
  }

  return toYaml(output)
}
