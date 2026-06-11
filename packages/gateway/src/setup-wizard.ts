import readline from 'readline'
import path from 'path'

import { DEFAULT_TELEGRAM_AGENT } from '@siya/common/constants/gateway'
import { gatewayFileSchema } from '@siya/common/types/gateway'

import { getConfigDir, saveGatewayConfig } from './config/load-config'

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export async function runGatewaySetupWizard(options?: {
  cwd?: string
}): Promise<string> {
  const cwd = options?.cwd ?? process.cwd()

  console.log('\nSiya Telegram Gateway Setup\n')
  console.log('1. Open Telegram and message @BotFather')
  console.log('2. Run /newbot and copy the bot token')
  console.log('3. Message @userinfobot to get your numeric user ID\n')

  const botToken = await prompt('Telegram bot token: ')
  if (!botToken) {
    throw new Error('Bot token is required.')
  }

  const userId = await prompt('Your Telegram user ID (numeric): ')
  if (!userId || !/^\d+$/.test(userId)) {
    throw new Error('A numeric Telegram user ID is required.')
  }

  const projectCwd =
    (await prompt(`Project directory [${cwd}]: `)) || cwd

  const agentId =
    (await prompt(`Default agent [${DEFAULT_TELEGRAM_AGENT}]: `)) ||
    DEFAULT_TELEGRAM_AGENT

  const config = gatewayFileSchema.parse({
    channels: {
      telegram: {
        enabled: true,
        botToken: '$TELEGRAM_BOT_TOKEN',
        dmPolicy: 'allowlist',
        allowFrom: [`tg:${userId}`],
        ownerUserId: userId,
        groupPolicy: 'allowlist',
        groups: {
          '*': { requireMention: true, enabled: true },
        },
        mentionAliases: ['siya'],
        defaultAgent: agentId,
        cwd: path.resolve(projectCwd),
        streaming: 'partial',
      },
    },
    gateway: {
      port: 8787,
      logLevel: 'info',
    },
  })

  const configPath = await saveGatewayConfig(config, getConfigDir())

  console.log('\nConfiguration saved to:')
  console.log(`  ${configPath}`)
  console.log('\nAdd to your environment (.env or shell profile):')
  console.log(`  TELEGRAM_BOT_TOKEN=${botToken}`)
  console.log(`  OPENROUTER_API_KEY=<your-key>`)
  console.log('\nThen start the gateway:')
  console.log('  siya gateway\n')

  return configPath
}
