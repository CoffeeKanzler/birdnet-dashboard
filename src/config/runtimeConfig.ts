type RuntimeConfig = Partial<Record<string, string>>

const toRuntimeConfig = (): RuntimeConfig => {
  if (typeof window === 'undefined') {
    return {}
  }

  const candidate = window.__BIRDNET_CONFIG__
  if (!candidate || typeof candidate !== 'object') {
    return {}
  }

  return candidate
}

export const getRuntimeConfigValue = (key: string): string | undefined => {
  const runtimeConfig = toRuntimeConfig()
  const value = runtimeConfig[key]
  return typeof value === 'string' ? value : undefined
}
