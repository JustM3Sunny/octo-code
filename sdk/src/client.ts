import { getOpenRouterApiKeyFromEnv } from './env'
import { verifyOpenRouterAuth } from './impl/model-provider'
import { run } from './run'

import type { RunOptions, SiyaClientOptions } from './run'
import type { RunState } from './run-state'

export class SiyaClient {
  public options: SiyaClientOptions & {
    apiKey: string
    fingerprintId: string
  }

  constructor(options: SiyaClientOptions) {
    const foundApiKey =
      options.apiKey?.trim() ||
      getOpenRouterApiKeyFromEnv()?.trim() ||
      'local-zen-only'

    this.options = {
      apiKey: foundApiKey,
      handleEvent: (event) => {
        if (event.type === 'error') {
          throw new Error(
            `Received error: ${event.message}.\n\nProvide a handleEvent function to handle this error.`,
          )
        }
      },
      fingerprintId: `siya-sdk-${Math.random().toString(36).substring(2, 15)}`,
      ...options,
    }
  }

  /**
   * Run a Siya agent with the specified options.
   */
  public async run(
    options: RunOptions & SiyaClientOptions,
  ): Promise<RunState> {
    return run({ ...this.options, ...options })
  }

  /**
   * Check connection to OpenRouter by listing available models.
   */
  public async checkConnection(): Promise<boolean> {
    return verifyOpenRouterAuth(this.options.apiKey)
  }
}
