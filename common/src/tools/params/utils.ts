import z from 'zod/v4'

import {
  endsAgentStepParam,
  endToolTag,
  startToolTag,
  toolNameParam,
} from '../constants'

import type { JSONValue } from '../../types/json'
import type { ToolResultOutput } from '../../types/messages/content-part'

/**
 * Coerces a value into an array if it isn't one already.
 * Handles common LLM mistakes:
 * - Single object/string passed instead of an array → wraps in array
 * - Stringified JSON array passed as a string → parses it
 * - Already an array → passes through
 * - null/undefined → passes through (let Zod handle it)
 */
export function coerceToArray(val: unknown): unknown {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Not valid JSON — fall through to wrap
    }
  }
  if (val != null) return [val]
  return val
}

/**
 * Coerces a stringified JSON object into an object.
 * This is intentionally narrow so malformed values still fail validation.
 */
export function coerceToObject(val: unknown): unknown {
  if (typeof val !== 'string') {
    return val
  }

  try {
    const parsed = JSON.parse(val)
    if (
      parsed != null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed
    }
  } catch {
    // Leave the original value untouched so schema validation can reject it.
  }

  return val
}

const REPLACEMENT_OLD_ALIASES = [
  'old',
  'old_str',
  'old_string',
  'search',
  'find',
  'match',
  'from',
] as const

const REPLACEMENT_NEW_ALIASES = [
  'new',
  'new_str',
  'new_string',
  'replace',
  'replace_with',
  'replaceWith',
  'replacement',
  'to',
  'with',
] as const

function mapReplacementAlias(
  replacement: Record<string, unknown>,
  target: 'oldString' | 'newString',
  aliases: readonly string[],
): void {
  if (replacement[target] !== undefined) {
    return
  }
  const alias = aliases.find((key) => typeof replacement[key] === 'string')
  if (alias) {
    replacement[target] = replacement[alias]
  }
}

/** Catches model typos like `newala` instead of `newString`. */
function mapFuzzyNewStringKey(replacement: Record<string, unknown>): void {
  if (replacement.newString !== undefined) {
    return
  }
  const fuzzyKey = Object.keys(replacement).find(
    (key) =>
      key.startsWith('new') &&
      key !== 'newString' &&
      typeof replacement[key] === 'string',
  )
  if (fuzzyKey) {
    replacement.newString = replacement[fuzzyKey]
  }
}

/**
 * Handles common replacement-key aliases emitted by some models while keeping
 * the documented schema stable.
 */
export function normalizeReplacementAliases(val: unknown): unknown {
  const parsed = coerceToObject(val)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return parsed
  }

  const replacement = { ...(parsed as Record<string, unknown>) }
  mapReplacementAlias(replacement, 'oldString', REPLACEMENT_OLD_ALIASES)
  mapReplacementAlias(replacement, 'newString', REPLACEMENT_NEW_ALIASES)
  mapFuzzyNewStringKey(replacement)

  if (
    typeof replacement.oldString === 'string' &&
    replacement.newString === undefined
  ) {
    replacement.newString = ''
  }

  return replacement
}

/** Normalizes one replacement entry (object or stringified JSON object). */
export function normalizeReplacementEntry(val: unknown): unknown {
  return normalizeReplacementAliases(val)
}

/**
 * Normalizes str_replace / propose_str_replace tool input before validation.
 * Handles singular `replacement`, flat oldString/newString at root, etc.
 */
export function normalizeStrReplaceInput(val: unknown): unknown {
  const parsed = coerceToObject(val)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return parsed
  }

  const input = { ...(parsed as Record<string, unknown>) }

  if (input.replacements === undefined && input.replacement !== undefined) {
    input.replacements = input.replacement
    delete input.replacement
  }

  if (input.replacements === undefined && typeof input.oldString === 'string') {
    input.replacements = [
      {
        oldString: input.oldString,
        newString: input.newString ?? '',
        allowMultiple: input.allowMultiple,
      },
    ]
    delete input.oldString
    delete input.newString
    delete input.allowMultiple
  }

  return input
}

/** Only used for generating tool call strings before all tools are defined.
 *
 * @param toolName - The name of the tool to call
 * @param inputSchema - The zod schema for the tool. This is only used as type validation and is unused otherwise.
 * @param input - The input to the tool
 * @param endsAgentStep - Whether the agent should end its turn after this tool call
 */
export function $getToolCallString<Input>(params: {
  toolName: string
  inputSchema: z.ZodType<any, Input> | null
  input: Input
  endsAgentStep: boolean
}): string {
  const { toolName, input, endsAgentStep } = params
  const obj: Record<string, any> = {
    [toolNameParam]: toolName,
    ...input,
  }
  if (endsAgentStep) {
    obj[endsAgentStepParam] = endsAgentStep satisfies true
  }
  return [startToolTag, JSON.stringify(obj, null, 2), endToolTag].join('')
}

export function $getNativeToolCallExampleString<Input>(params: {
  toolName: string
  inputSchema: z.ZodType<any, Input> | null
  input: Input
  endsAgentStep?: boolean // unused
}): string {
  const { toolName, input } = params
  return [
    `<${toolName}_params_example>\n`,
    JSON.stringify(input, null, 2),
    `\n</${toolName}_params_example>`,
  ].join('')
}

/** Generates the zod schema for a single JSON tool result. */
export function jsonToolResultSchema<T extends JSONValue>(
  valueSchema: z.ZodType<T>,
) {
  return z.tuple([
    z.object({
      type: z.literal('json'),
      value: valueSchema,
    }) satisfies z.ZodType<ToolResultOutput>,
  ])
}

/** Generates the zod schema for an empty tool result. */
export function emptyToolResultSchema() {
  return z.tuple([])
}

/** Generates the zod schema for a simple text tool result. */
export function textToolResultSchema() {
  return z.tuple([
    z.object({
      type: z.literal('json'),
      value: z.object({
        message: z.string(),
      }),
    }) satisfies z.ZodType<ToolResultOutput>,
  ])
}
