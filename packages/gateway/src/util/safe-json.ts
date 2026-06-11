export function safeJsonStringify(value: unknown, indent = 2): string {
  const seen = new WeakSet<object>()

  return JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === 'function' || typeof val === 'symbol') {
        return undefined
      }

      if (val && typeof val === 'object') {
        if (seen.has(val as object)) {
          return undefined
        }
        seen.add(val as object)

        if (
          typeof (val as { parse?: unknown }).parse === 'function' &&
          '_def' in (val as object)
        ) {
          return undefined
        }
      }

      return val
    },
    indent,
  )
}
