import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildApiUrl, getApiBaseUrl, requestJson } from './apiClient'

const jsonResponse = (payload: unknown, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

const abortError = () => {
  const error = new Error('aborted')
  error.name = 'AbortError'
  return error
}

describe('apiClient helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('normalizes base URL and composes request URLs', () => {
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test/')

    expect(getApiBaseUrl()).toBe('https://api.example.test')
    expect(buildApiUrl('/api/v2/detections')).toBe('https://api.example.test/api/v2/detections')

    const query = new URLSearchParams({ limit: '10' })
    expect(buildApiUrl('https://other.example/path', query)).toBe('https://other.example/path?limit=10')
  })

  it('returns JSON payload when request succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestJson<{ ok: boolean }>('/api/test')

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries retryable HTTP failures and then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'try later' }, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200))
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestJson<{ ok: boolean }>('/api/retry', {
      retries: 1,
      retryDelayMs: 0,
    })

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws non-retryable HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'bad' }, 400)))

    await expect(requestJson('/api/fail', { retries: 2, retryDelayMs: 0 })).rejects.toEqual(
      expect.objectContaining({
        code: 'http',
        status: 400,
        retryable: false,
      }),
    )
  })

  it('throws parse errors for malformed JSON payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(requestJson('/api/parse')).rejects.toEqual(
      expect.objectContaining({
        code: 'parse',
      }),
    )
  })

  it('retries on network errors and eventually fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestJson('/api/network', { retries: 1, retryDelayMs: 0 })).rejects.toEqual(
      expect.objectContaining({
        code: 'network',
        retryable: true,
      }),
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('maps caller-aborted requests to aborted error code', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(requestJson('/api/abort-before', { signal: controller.signal })).rejects.toEqual(
      expect.objectContaining({
        code: 'aborted',
      }),
    )
  })

  it('maps timeout aborts to timeout error code', async () => {
    vi.useFakeTimers()

    vi.stubGlobal(
      'fetch',
      vi.fn((_: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(abortError())
          })
        })
      }),
    )

    const promise = requestJson('/api/slow', { timeoutMs: 5, retries: 0 })
    const assertion = expect(promise).rejects.toEqual(
      expect.objectContaining({
        code: 'timeout',
        retryable: true,
      }),
    )

    await vi.advanceTimersByTimeAsync(10)
    await assertion
  })

  it('maps in-flight caller abort to aborted code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(abortError())
          })
        })
      }),
    )

    const controller = new AbortController()
    const promise = requestJson('/api/abort-mid-flight', {
      signal: controller.signal,
      timeoutMs: 0,
    })
    controller.abort()

    await expect(promise).rejects.toEqual(
      expect.objectContaining({
        code: 'aborted',
      }),
    )
  })
})
