const chatAgentOverrides = new Map<string, string>()
const chatModeOverrides = new Map<string, string>()

export const TELEGRAM_MODE_TO_AGENT: Record<string, string> = {
  default: 'base2',
  lite: 'base2-lite',
  max: 'base2-max',
  plan: 'base2-plan',
}

export function setChatAgentOverride(chatId: string, agentId: string): void {
  chatAgentOverrides.set(chatId, agentId)
}

export function getChatAgentOverride(chatId: string): string | undefined {
  return chatAgentOverrides.get(chatId)
}

export function clearChatAgentOverride(chatId: string): void {
  chatAgentOverrides.delete(chatId)
}

export function setChatMode(chatId: string, mode: string): string {
  const normalized = mode.toLowerCase().replace(/^mode_/, '')
  const agentId = TELEGRAM_MODE_TO_AGENT[normalized] ?? TELEGRAM_MODE_TO_AGENT.default
  chatModeOverrides.set(chatId, normalized)
  chatAgentOverrides.set(chatId, agentId)
  return agentId
}

export function getChatMode(chatId: string): string | undefined {
  return chatModeOverrides.get(chatId)
}

export function clearChatMode(chatId: string): void {
  chatModeOverrides.delete(chatId)
}

export function clearChatAgentState(chatId: string): void {
  clearChatAgentOverride(chatId)
  clearChatMode(chatId)
}
