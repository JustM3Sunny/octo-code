import { env, DEBUG_ANALYTICS } from '@siya/common/env'

import { createPostHogClient, type AnalyticsClient } from './analytics-core'
import { AnalyticsEvent } from './constants/analytics-events'

import type { TrackEventFn } from '@siya/common/types/contracts/analytics'
import type { Logger } from '@siya/common/types/contracts/logger'

let client: AnalyticsClient | undefined

export async function flushAnalytics(logger?: Logger) {
  if (!client) {
    return
  }
  try {
    await client.flush()
  } catch (error) {
    // Log the error but don't throw - flushing is best-effort
    logger?.warn({ error }, 'Failed to flush analytics')

    // Track the flush failure event (will be queued for next successful flush)
    try {
      client.capture({
        distinctId: 'system',
        event: AnalyticsEvent.FLUSH_FAILED,
        properties: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
    } catch {
      // Silently ignore if we can't even track the failure
    }
  }
}

export function withDefaultProperties(
  trackEventFn: TrackEventFn,
  defaultProperties: Record<string, unknown>,
): TrackEventFn {
  return (params) => {
    trackEventFn({
      ...params,
      properties: { ...defaultProperties, ...params.properties },
    })
  }
}

export function trackEvent({
  event,
  userId,
  properties,
  logger,
}: {
  event: AnalyticsEvent
  userId: string
  properties?: Record<string, any>
  logger: Logger
}) {
  // Don't track events in non-production environments
  if (env.NEXT_PUBLIC_CB_ENVIRONMENT !== 'prod') {
    if (DEBUG_ANALYTICS) {
      logger.debug({ event, userId, properties }, `[analytics] ${event}`)
    }
    return
  }

  if (!client) {
    client = createPostHogClient('', {
      host: '',
      flushAt: 1,
      flushInterval: 0,
    })
  }

  try {
    client.capture({
      distinctId: userId,
      event,
      properties,
    })
  } catch (error) {
    logger.error({ error }, 'Failed to track event')
  }
}
