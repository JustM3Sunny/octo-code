import { describe, expect, test } from 'bun:test'

import { createBase2 } from '../base2/base2'
import codeReviewerLite from '../reviewer/code-reviewer-lite'

describe('base2 reviewer selection', () => {
  test('default base2 includes code-reviewer in spawnable agents', () => {
    const base2 = createBase2()

    expect(base2.model).toBe('openrouter/free')
    expect(base2.spawnableAgents).toContain('code-reviewer')
    expect(base2.instructionsPrompt).toContain('Spawn a code-reviewer')
    expect(base2.stepPrompt).toContain('spawn a code-reviewer')
  })

  test('code-reviewer-lite uses DeepSeek V4 Flash', () => {
    expect(codeReviewerLite.model).toBe('deepseek/deepseek-v4-flash')
  })

  test('fast mode skips code review in prompts', () => {
    const base2 = createBase2({ fast: true, noReview: true })

    expect(base2.spawnableAgents).not.toContain('code-reviewer')
    expect(base2.instructionsPrompt).not.toContain('Spawn a code-reviewer')
  })
})

describe('base2 context pruning', () => {
  const getContextPrunerParams = (
    options?: Parameters<typeof createBase2>[0],
    params?: Record<string, unknown>,
  ) => {
    const base2 = createBase2(options)
    const generator = base2.handleSteps!({ params } as any)
    const step = generator.next().value as any
    return step.input.params
  }

  test('defaults context pruning to 400k tokens', () => {
    const base2 = createBase2()
    const generator = base2.handleSteps!({ params: undefined } as any)

    expect(generator.next().value).toMatchObject({
      toolName: 'spawn_agent_inline',
      input: {
        agent_type: 'context-pruner',
        params: {
          maxContextLength: 400_000,
        },
      },
      includeToolCall: false,
    })
  })

  test('preserves explicit context pruning params', () => {
    const base2 = createBase2()
    const generator = base2.handleSteps!({
      params: { maxContextLength: 123_000, assistantToolBudget: 10_000 },
    } as any)

    expect(generator.next().value).toMatchObject({
      input: {
        params: {
          maxContextLength: 123_000,
          assistantToolBudget: 10_000,
        },
      },
    })
  })

  test('fast mode uses the same default context pruning limit', () => {
    expect(getContextPrunerParams({ fast: true })).toEqual({
      maxContextLength: 400_000,
    })
  })
})
