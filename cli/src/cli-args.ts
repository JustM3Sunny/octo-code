import { createRequire } from 'module'

import { Command } from 'commander'

import { type AgentMode } from './utils/constants'
import { getCliEnv } from './utils/env'

const require = createRequire(import.meta.url)

const HEADLESS_COMMANDS = ['gateway', 'pairing'] as const
export type HeadlessCommand = (typeof HEADLESS_COMMANDS)[number]

export type ParsedArgs = {
  initialPrompt: string | null
  command?: HeadlessCommand
  subcommand?: string
  commandArgs?: string[]
  agent?: string
  clearLogs: boolean
  continue: boolean
  continueId?: string | null
  cwd?: string
  initialMode?: AgentMode
}

export function loadPackageVersion(): string {
  const env = getCliEnv()
  if (env.SIYA_CLI_VERSION) {
    return env.SIYA_CLI_VERSION
  }

  try {
    const pkg = require('../package.json') as { version?: string }
    if (pkg.version) {
      return pkg.version
    }
  } catch {
    // Continue to dev fallback
  }

  return 'dev'
}

export function parseArgs({
  argv = process.argv,
  version = loadPackageVersion(),
}: {
  argv?: string[]
  version?: string
} = {}): ParsedArgs {
  const program = new Command()

  program
    .name('siya')
    .description('Siya CLI - AI-powered coding assistant')
    .version(version, '-v, --version', 'Print the CLI version')
    .option(
      '--agent <agent-id>',
      'Run a specific agent id (skips loading local .agents overrides)',
    )
    .option(
      '--clear-logs',
      'Remove any existing CLI log files before starting',
    )
    .option(
      '--continue [conversation-id]',
      'Continue from a previous conversation (optionally specify a conversation id)',
    )
    .option(
      '--cwd <directory>',
      'Set the working directory (default: current directory)',
    )
    .option('--lite', 'Start in LITE mode')
    .option('--max', 'Start in MAX mode')
    .option('--plan', 'Start in PLAN mode')
    .addHelpText(
      'after',
      '\nGateway commands:\n' +
        '  gateway [start|setup|status]   Telegram gateway daemon\n' +
        '  pairing list telegram            List pending pairing requests\n' +
        '  pairing approve telegram <CODE>  Approve a Telegram user',
    )
    .helpOption('-h, --help', 'Show this help message')
    .argument('[prompt...]', 'Initial prompt or gateway/pairing command')
    .allowExcessArguments(true)

  program.parse(argv)

  const options = program.opts()
  const args = program.args

  const continueFlag = options.continue

  let initialMode: AgentMode | undefined
  if (options.lite) initialMode = 'LITE'
  if (options.max) initialMode = 'MAX'
  if (options.plan) initialMode = 'PLAN'

  const firstArg = args[0]
  const isHeadlessCommand = HEADLESS_COMMANDS.includes(
    firstArg as HeadlessCommand,
  )

  let command: HeadlessCommand | undefined
  let subcommand: string | undefined
  let commandArgs: string[] | undefined
  let initialPrompt: string | null = null

  if (isHeadlessCommand) {
    command = firstArg as HeadlessCommand
    subcommand = args[1]
    commandArgs = args.slice(2)
  } else if (args.length > 0) {
    initialPrompt = args.join(' ')
  }

  return {
    initialPrompt,
    command,
    subcommand,
    commandArgs,
    agent: options.agent,
    clearLogs: options.clearLogs || false,
    continue: Boolean(continueFlag),
    continueId:
      typeof continueFlag === 'string' && continueFlag.trim().length > 0
        ? continueFlag.trim()
        : null,
    cwd: options.cwd,
    initialMode,
  }
}
