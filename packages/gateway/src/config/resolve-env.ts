const processEnv = process.env as NodeJS.ProcessEnv

export function resolveEnvReferences(
  value: string,
  context: string,
): string {
  if (!value.startsWith('$')) {
    return value
  }

  const envVarName = value.slice(1)
  const envValue = processEnv[envVarName]

  if (envValue === undefined || envValue.trim() === '') {
    throw new Error(
      `Missing environment variable '${envVarName}' required by ${context}`,
    )
  }

  return envValue.trim()
}
