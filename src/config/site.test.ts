import { afterEach, describe, expect, it, vi } from 'vitest'

describe('siteConfig.enableHighlights', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults to enabled when env var is missing', async () => {
    vi.unstubAllEnvs()
    const { siteConfig } = await import('./site')
    expect(siteConfig.enableHighlights).toBe(true)
  })

  it('disables highlights when env var is set to false', async () => {
    vi.stubEnv('VITE_ENABLE_HIGHLIGHTS', 'false')
    const { siteConfig } = await import('./site')
    expect(siteConfig.enableHighlights).toBe(false)
  })
})
