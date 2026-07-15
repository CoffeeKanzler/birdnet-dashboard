import { beforeEach, describe, expect, it, vi } from 'vitest'

const reportFrontendErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../observability/errorReporter', () => ({
  reportFrontendError: (...args: unknown[]) => reportFrontendErrorMock(...args),
}))

import { queryClient } from './queryClient'

describe('queryClient', () => {
  beforeEach(() => {
    reportFrontendErrorMock.mockReset()
    queryClient.clear()
  })

  it('is configured with sane defaults', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.staleTime).toBe(30_000)
    expect(defaults.queries?.gcTime).toBe(5 * 60_000)
    expect(defaults.queries?.retry).toBe(1)
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false)
  })

  it('applies exponential backoff for retry delay', () => {
    const retryDelay = defaultsRetryDelay()
    expect(retryDelay(0)).toBe(300)
    expect(retryDelay(1)).toBe(300)
    expect(retryDelay(2)).toBe(600)
    expect(retryDelay(3)).toBe(1200)
  })

  function defaultsRetryDelay() {
    const retryDelay = queryClient.getDefaultOptions().queries?.retryDelay
    if (typeof retryDelay !== 'function') {
      throw new Error('retryDelay is not configured as a function')
    }
    return retryDelay as (attempt: number) => number
  }

  it('reports frontend errors with the query meta source and metadata on failure', async () => {
    const error = new Error('boom')

    await queryClient
      .fetchQuery({
        queryKey: ['test-error-with-meta'],
        queryFn: () => Promise.reject(error),
        retry: false,
        meta: { source: 'test.source', extra: 'value' },
      })
      .catch(() => undefined)

    expect(reportFrontendErrorMock).toHaveBeenCalledWith({
      source: 'test.source',
      error,
      metadata: { source: 'test.source', extra: 'value' },
    })
  })

  it('falls back to "unknown" as the source when query meta has none', async () => {
    const error = new Error('boom')

    await queryClient
      .fetchQuery({
        queryKey: ['test-error-without-meta'],
        queryFn: () => Promise.reject(error),
        retry: false,
      })
      .catch(() => undefined)

    expect(reportFrontendErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'unknown', error }),
    )
  })
})
