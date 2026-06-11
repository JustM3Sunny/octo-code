import {
  approvePairingCode,
  listPendingPairings,
} from '@siya/gateway'

export async function handlePairingCommand(params: {
  subcommand?: string
  commandArgs?: string[]
}): Promise<void> {
  const subcommand = params.subcommand
  const args = params.commandArgs ?? []

  if (!subcommand) {
    console.error('Usage: siya pairing <list|approve> telegram [CODE]')
    process.exit(1)
  }

  if (subcommand === 'list') {
    const channel = args[0] === 'telegram' ? 'telegram' : undefined
    const pending = await listPendingPairings(
      channel === 'telegram' ? 'telegram' : undefined,
    )

    if (pending.length === 0) {
      console.log('No pending pairing requests.')
      return
    }

    console.log('Pending pairing requests:')
    for (const request of pending) {
      const username = request.username ? `@${request.username}` : 'unknown'
      console.log(
        `  [${request.channel}] code=${request.code} user=${request.userId} (${username}) chat=${request.chatId}`,
      )
    }
    return
  }

  if (subcommand === 'approve') {
    const channel = args[0]
    const code = args[1]

    if (channel !== 'telegram' || !code) {
      console.error('Usage: siya pairing approve telegram <CODE>')
      process.exit(1)
    }

    const result = await approvePairingCode('telegram', code)
    if (!result) {
      console.error(`Pairing code not found or expired: ${code}`)
      process.exit(1)
    }

    console.log(`Approved Telegram user ${result.userId}.`)
    return
  }

  console.error(`Unknown pairing subcommand: ${subcommand}`)
  console.error('Usage: siya pairing <list|approve> telegram [CODE]')
  process.exit(1)
}
