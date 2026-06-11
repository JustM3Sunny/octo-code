import type { AgentStepContext, ToolCall } from '../../types/agent-definition'
import type { SecretAgentDefinition } from '../../types/secret-agent-definition'

export const DEFAULT_BEST_OF_N_STRATEGIES = [
  'Make the minimal possible changes',
  'Modularize your solution by creating new focused files',
  'Optimize for performance; reuse existing helpers and caches',
  'Prioritize readability, clarity, and maintainability',
  'Use defensive programming with thorough error handling',
  'Follow existing project patterns as strictly as possible',
  'Refactor nearby code while implementing the feature',
  'Implement the simplest correct solution first',
  'Design for extensibility and future changes',
  'Maximize reuse of existing utilities and components',
] as const

export function resolveBestOfNStrategyPrompts(params: {
  n?: number
  prompts?: string[]
}): string[] {
  if (Array.isArray(params.prompts) && params.prompts.length > 0) {
    return params.prompts.map((prompt) => prompt.trim()).filter(Boolean)
  }

  const n = Math.min(
    10,
    Math.max(1, params.n ?? 5),
  )
  return DEFAULT_BEST_OF_N_STRATEGIES.slice(0, n)
}

/**
 * Best-of-N editor workflow generator.
 * 
 * IMPORTANT: All helper functions are inlined inside this generator because
 * when prebuild serializes handleSteps via .toString(), external function
 * references become undefined at runtime (eval scope doesn't include imports).
 */
export function* runBestOfNEditorWorkflow(
  params: AgentStepContext,
): ReturnType<NonNullable<SecretAgentDefinition['handleSteps']>> {
  // === INLINED: resolveBestOfNStrategyPrompts ===
  const DEFAULT_STRATEGIES = [
    'Make the minimal possible changes',
    'Modularize your solution by creating new focused files',
    'Optimize for performance; reuse existing helpers and caches',
    'Prioritize readability, clarity, and maintainability',
    'Use defensive programming with thorough error handling',
    'Follow existing project patterns as strictly as possible',
    'Refactor nearby code while implementing the feature',
    'Implement the simplest correct solution first',
    'Design for extensibility and future changes',
    'Maximize reuse of existing utilities and components',
  ]

  function resolveStrategyPrompts(opts: { n?: number; prompts?: string[] }): string[] {
    if (Array.isArray(opts.prompts) && opts.prompts.length > 0) {
      return opts.prompts.map((p) => p.trim()).filter(Boolean)
    }
    const count = Math.min(10, Math.max(1, opts.n ?? 5))
    return DEFAULT_STRATEGIES.slice(0, count)
  }

  // === INLINED: extractSpawnResults ===
  function extractSpawnResults<T>(results: unknown[] | undefined): T[] {
    if (!results || results.length === 0) return []

    const jsonResult = (results as Array<{ type?: string; value?: unknown }>).find(
      (r) => r.type === 'json',
    )
    if (!jsonResult?.value) return []

    const spawnedResults = Array.isArray(jsonResult.value)
      ? jsonResult.value
      : [jsonResult.value]

    return spawnedResults
      .map((result: { value?: unknown }) => result?.value)
      .map((result: { value?: unknown } | unknown) =>
        result && typeof result === 'object' && 'value' in result
          ? (result as { value: unknown }).value
          : result,
      )
      .filter(Boolean) as T[]
  }

  // === MAIN WORKFLOW ===
  const prompts = resolveStrategyPrompts({
    n: params.params?.n as number | undefined,
    prompts: params.params?.prompts as string[] | undefined,
  })

  if (prompts.length === 0) {
    yield {
      toolName: 'set_output',
      input: {
        error: 'No implementation strategies available for best-of-n editor.',
      },
    } satisfies ToolCall<'set_output'>
    return
  }

  const { messageHistory: initialMessageHistory } = params.agentState
  let userMessageIndex = initialMessageHistory.length

  while (userMessageIndex > 0) {
    const message = initialMessageHistory[userMessageIndex - 1]
    if (message.role === 'user') {
      userMessageIndex--
    } else {
      break
    }
  }

  yield {
    toolName: 'set_messages',
    input: {
      messages: initialMessageHistory.slice(0, userMessageIndex),
    },
    includeToolCall: false,
  } satisfies ToolCall<'set_messages'>

  const implementorAgents = prompts.map((prompt) => ({
    agent_type: 'editor-implementor-opus',
    prompt: `Strategy: ${prompt}`,
  }))

  const { toolResult: implementorResults } = yield {
    toolName: 'spawn_agents',
    input: {
      agents: implementorAgents,
    },
    includeToolCall: false,
  } satisfies ToolCall<'spawn_agents'>

  const spawnedImplementations = extractSpawnResults<{
    toolCalls: { toolName: string; input: unknown }[]
    toolResults: unknown[]
    unifiedDiffs: string
  }>(implementorResults)

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const implementations = spawnedImplementations.map((result, index) => {
    if (!result || (typeof result === 'object' && 'errorMessage' in result)) {
      return {
        id: letters[index],
        strategy: prompts[index] ?? 'unknown',
        content: `Error: ${(result as { errorMessage?: string })?.errorMessage ?? 'Unknown error'}`,
        toolCalls: [] as { toolName: string; input: unknown }[],
      }
    }

    return {
      id: letters[index],
      strategy: prompts[index] ?? 'unknown',
      content: result.unifiedDiffs || 'No changes proposed',
      toolCalls: result.toolCalls ?? [],
    }
  })

  const { toolResult: selectorResult } = yield {
    toolName: 'spawn_agents',
    input: {
      agents: [
        {
          agent_type: 'best-of-n-selector2',
          params: {
            implementations: implementations.map((impl) => ({
              id: impl.id,
              strategy: impl.strategy,
              content: impl.content,
            })),
          },
        },
      ],
    },
    includeToolCall: false,
  } satisfies ToolCall<'spawn_agents'>

  const selectorOutput = extractSpawnResults<{
    implementationId: string
    reason: string
    suggestedImprovements: string
  }>(selectorResult)[0]

  if (!selectorOutput || !('implementationId' in selectorOutput)) {
    yield {
      toolName: 'set_output',
      input: { error: 'Selector failed to return an implementation' },
    } satisfies ToolCall<'set_output'>
    return
  }

  const chosenImplementation = implementations.find(
    (implementation) => implementation.id === selectorOutput.implementationId,
  )

  if (!chosenImplementation) {
    yield {
      toolName: 'set_output',
      input: {
        error: `Failed to find chosen implementation: ${selectorOutput.implementationId}`,
      },
    } satisfies ToolCall<'set_output'>
    return
  }

  const appliedToolResults: unknown[] = []
  for (const toolCall of chosenImplementation.toolCalls) {
    const realToolName =
      toolCall.toolName === 'propose_str_replace'
        ? 'str_replace'
        : toolCall.toolName === 'propose_write_file'
          ? 'write_file'
          : toolCall.toolName

    if (realToolName === 'str_replace' || realToolName === 'write_file') {
      const { toolResult } = yield {
        toolName: realToolName,
        input: toolCall.input,
        includeToolCall: true,
      } satisfies ToolCall<'str_replace'> | ToolCall<'write_file'>

      appliedToolResults.push(toolResult)
    }
  }

  yield {
    toolName: 'set_output',
    input: {
      chosenStrategy: chosenImplementation.strategy,
      reason: selectorOutput.reason,
      toolResults: appliedToolResults,
      suggestedImprovements: selectorOutput.suggestedImprovements,
      implementationCount: implementations.length,
    },
    includeToolCall: false,
  } satisfies ToolCall<'set_output'>
}
