import { verifyOpenRouterAuth } from '@siya/sdk'
import {
  getGatewayStatus,
  runGatewaySetupWizard,
  startGateway,
} from '@siya/gateway'
import { hasOpenRouterApiKey } from '@siya/common/constants/openrouter-auth'

import { loadAgentDefinitions } from '../utils/local-agent-registry'
import { getOpenRouterApiKey } from '../utils/siya-client'

export async function handleGatewayCommand(params: {
  subcommand?: string
  cwd?: string
}): Promise<void> {
  const subcommand = params.subcommand ?? 'start'

  if (subcommand === 'setup') {
    await runGatewaySetupWizard({ cwd: params.cwd })
    return
  }

  if (subcommand === 'status') {
    const status = await getGatewayStatus({ cwd: params.cwd })
    console.log('Siya Gateway Status')
    console.log('-------------------')
    console.log(`Configured: ${status.configured ? 'yes' : 'no'}`)
    if (status.sourceFile) {
      console.log(`Config file: ${status.sourceFile}`)
    }
    console.log(`Telegram enabled: ${status.telegramEnabled ? 'yes' : 'no'}`)
    console.log(`Bot token set: ${status.hasToken ? 'yes' : 'no'}`)
    if (status.defaultAgent) {
      console.log(`Default agent: ${status.defaultAgent}`)
    }
    if (status.projectCwd) {
      console.log(`Project cwd: ${status.projectCwd}`)
    }
    return
  }

  if (subcommand !== 'start' && subcommand !== 'run') {
    console.error(`Unknown gateway subcommand: ${subcommand}`)
    console.error('Usage: siya gateway [start|setup|status]')
    process.exit(1)
  }

  const apiKey = getOpenRouterApiKey()
  if (hasOpenRouterApiKey()) {
    const valid = await verifyOpenRouterAuth(apiKey)
    if (!valid) {
      console.warn(
        'OpenRouter API key rejected — gateway will use OpenCode Zen models until you fix OPENROUTER_API_KEY.',
      )
    }
  }

  const agentDefinitions = loadAgentDefinitions()

  const handle = await startGateway({
    apiKey: apiKey ?? 'local-zen-only',
    cwd: params.cwd,
    agentDefinitions,
  })

  const shutdown = async () => {
    console.log('\nStopping gateway...')
    await handle.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await new Promise(() => {})
}
