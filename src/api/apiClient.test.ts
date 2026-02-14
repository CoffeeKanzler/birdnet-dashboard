import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildApiUrl, requestJson } from './apiClient'

const jsonResponse = (payload: unknown, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('builds relative and absolute api urls with query params', () => {
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test/')

    expect(buildApiUrl('/api/v2/detections')).toBe('https://api.example.test/api/v2/detections')
    expect(buildApiUrl('/api/v2/detections', new URLSearchParams({ search: 'Great tit' }))).toBe(
      'https://api.example.test/api/v2/detections?search=Great+tit',
    )
    expect(buildApiUrl('https://other.example.test/ping')).toBe('https://other.example.test/ping')
  })

  it('requests json with defaults and returns parsed payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const payload = await requestJson<{ ok: boolean }>('https://api.example.test/check')

    expect(payload).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/check',
      expect.objectContaining({
        cache: 'no-store',
        headers: { accept: 'application/json' },
      }),
    )
  })

  it('retries retryable HTTP statuses and then resolves', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'temporarily unavailable' }, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200))
    vi.stubGlobal('fetch', fetchMock)

    const request = requestJson<{ ok: boolean }>('https://api.example.test/retry', {
      retries: 1,
      retryDelayMs: 20,
    })

    await vi.advanceTimersByTimeAsync(20)
    await expect(request).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws non-retryable HTTP failures without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'bad request' }, 400))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestJson('https://api.example.test/bad')).rejects.toMatchObject({
      code: 'http',
      status: 400,
      retryable: false,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws parse errors for invalid json payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('not-json', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestJson('https://api.example.test/invalid')).rejects.toMatchObject({
      code: 'parse',
      status: 200,
    })
  })

  it('maps timeout aborts to timeout errors', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortError = new Error('Aborted')
          abortError.name = 'AbortError'
          reject(abortError)
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const request = requestJson('https://api.example.test/slow', {
      retries: 0,
      timeoutMs: 10,
    })
    const assertion = expect(request).rejects.toMatchObject({
      code: 'timeout',
      retryable: true,
    })

    await vi.advanceTimersByTimeAsync(11)
    await assertion
  })
})
