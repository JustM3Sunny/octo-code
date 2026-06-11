import { describe, expect, it } from 'bun:test'

import { getProviderOptions } from '../llm'

describe('getProviderOptions — Siya_metadata', () => {
  const baseParams = {
    model: 'openrouter/anthropic/claude-sonnet-4-5',
    runId: 'run-1',
    clientSessionId: 'session-1',
  }

  it('includes run_id and client_id in Siya_metadata', () => {
    const opts = getProviderOptions(baseParams)
    const meta = (opts.Siya as any).Siya_metadata
    expect(meta).toMatchObject({
      run_id: 'run-1',
      client_id: 'session-1',
    })
  })

  it('merges extraSiyaMetadata into Siya_metadata', () => {
    const opts = getProviderOptions({
      ...baseParams,
      extraSiyaMetadata: { freebuff_instance_id: 'abc-123' },
    })
    const meta = (opts.Siya as any).Siya_metadata
    expect(meta).toMatchObject({
      run_id: 'run-1',
      client_id: 'session-1',
      freebuff_instance_id: 'abc-123',
    })
  })

  it('omits extra keys when extraSiyaMetadata is undefined', () => {
    const opts = getProviderOptions(baseParams)
    const meta = (opts.Siya as any).Siya_metadata
    expect(Object.keys(meta)).toEqual(
      expect.arrayContaining(['run_id', 'client_id']),
    )
    expect(meta.freebuff_instance_id).toBeUndefined()
  })

  it('cost_mode passes through alongside extra metadata', () => {
    const opts = getProviderOptions({
      ...baseParams,
      costMode: 'free',
      extraSiyaMetadata: { freebuff_instance_id: 'uuid-xyz' },
    })
    const meta = (opts.Siya as any).Siya_metadata
    expect(meta).toMatchObject({
      cost_mode: 'free',
      freebuff_instance_id: 'uuid-xyz',
    })
  })

  it('extraSiyaMetadata does not overwrite reserved keys', () => {
    const opts = getProviderOptions({
      ...baseParams,
      costMode: 'free',
      extraSiyaMetadata: {
        // These are intentionally the same keys the function already sets —
        // make sure a misuse doesn't let callers override server-trusted
        // identifiers. The spread currently puts caller keys last, which
        // means it WOULD override. If that's ever intentional, change this
        // test; for now, lock it down.
        run_id: 'evil-override',
      },
    })
    const meta = (opts.Siya as any).Siya_metadata
    expect(meta.run_id).toBe('run-1')
  })
})
