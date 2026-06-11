/** Cached result of OpenRouter key verification (null = not checked yet). */

let openRouterAuthValid: boolean | null = null



/** Shared across SDK bundle + CLI so auth state is not duplicated. */

const AUTH_CACHE_ENV = 'SIYA_OPENROUTER_AUTH_VALID'



function readCachedAuthFromEnv(): boolean | null {

  const flag = process.env[AUTH_CACHE_ENV]

  if (flag === '1') return true

  if (flag === '0') return false

  return null

}



function syncAuthCache(valid: boolean): void {

  openRouterAuthValid = valid

  process.env[AUTH_CACHE_ENV] = valid ? '1' : '0'

}



// Hydrate from env when this module loads in a different bundle than verify ran in.

openRouterAuthValid = readCachedAuthFromEnv()



export function hasOpenRouterApiKey(): boolean {

  const key = process.env.OPENROUTER_API_KEY?.trim()

  return Boolean(key && key.length >= 20)

}



export function setOpenRouterAuthValid(valid: boolean): void {

  syncAuthCache(valid)

}



export function getOpenRouterAuthValid(): boolean | null {

  if (openRouterAuthValid !== null) {

    return openRouterAuthValid

  }

  const fromEnv = readCachedAuthFromEnv()

  if (fromEnv !== null) {

    openRouterAuthValid = fromEnv

  }

  return openRouterAuthValid

}



/** True when OpenRouter can be used (key present and not proven invalid). */

export function isOpenRouterUsable(): boolean {

  if (!hasOpenRouterApiKey()) return false

  return getOpenRouterAuthValid() !== false

}



export function resetOpenRouterAuthState(): void {

  openRouterAuthValid = null

  delete process.env[AUTH_CACHE_ENV]

}

