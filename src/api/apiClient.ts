export type ApiClientErrorCode =
  | 'aborted'
  | 'timeout'
  | 'network'
  | 'http'
  | 'parse'

type RequestJsonOptions = {
  signal?: AbortSignal
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  retryOnStatuses?: number[]
  headers?: HeadersInit
  cache?: RequestCache
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_RETRIES = 1
const DEFAULT_RETRY_DELAY_MS = 300
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

const isAbortError = (error: unknown): boolean => {
  return error instanceof Error && error.name === 'AbortError'
}

const toRetryDelay = (attempt: number, baseDelayMs: number): number => {
  return baseDelayMs * 2 ** Math.max(0, attempt - 1)
}

const wait = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export class ApiClientError extends Error {
  readonly code: ApiClientErrorCode
  readonly status?: number
  readonly url: string
  readonly retryable: boolean

  constructor({
    message,
    code,
    url,
    status,
    retryable,
  }: {
    message: string
    code: ApiClientErrorCode
    url: string
    status?: number
    retryable?: boolean
  }) {
    super(message)
    this.name = code === 'aborted' ? 'AbortError' : 'ApiClientError'
    this.code = code
    this.url = url
    this.status = status
    this.retryable = Boolean(retryable)
  }
}

export const getApiBaseUrl = (): string => {
  const baseUrl = import.meta.env.VITE_BIRDNET_API_BASE_URL ?? ''
  if (!baseUrl) {
    return ''
  }

  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export const buildApiUrl = (path: string, query?: URLSearchParams): string => {
  const isAbsolute = /^https?:\/\//i.test(path)
  const base = isAbsolute ? path : `${getApiBaseUrl()}${path}`

  if (!query) {
    return base
  }

  const encodedQuery = query.toString()
  return encodedQuery ? `${base}?${encodedQuery}` : base
}

export const requestJson = async <T>(
  url: string,
  options: RequestJsonOptions = {},
): Promise<T> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retries = options.retries ?? DEFAULT_RETRIES
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const retryOnStatuses = new Set(options.retryOnStatuses ?? Array.from(RETRYABLE_HTTP_STATUSES))
  const maxAttempts = Math.max(1, retries + 1)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController()
    let timedOut = false
    const timeoutId =
      timeoutMs > 0
        ? window.setTimeout(() => {
            timedOut = true
            controller.abort()
          }, timeoutMs)
        : undefined

    const abortFromCaller = () => {
      controller.abort()
    }

    if (options.signal?.aborted) {
      throw new ApiClientError({
        message: 'Request aborted',
        code: 'aborted',
        url,
      })
    }

    options.signal?.addEventListener('abort', abortFromCaller, { once: true })

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: options.cache ?? 'no-store',
        headers: {
          accept: 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        const isRetryableStatus = retryOnStatuses.has(response.status)
        const error = new ApiClientError({
          message: `HTTP request failed with status ${response.status}`,
          code: 'http',
          url,
          status: response.status,
          retryable: isRetryableStatus,
        })

        if (attempt < maxAttempts && error.retryable) {
          await wait(toRetryDelay(attempt, retryDelayMs))
          continue
        }

        throw error
      }

      try {
        return (await response.json()) as T
      } catch (error) {
        throw new ApiClientError({
          message: 'Response JSON parsing failed',
          code: 'parse',
          url,
          status: response.status,
        })
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error
      }

      if (isAbortError(error)) {
        const code: ApiClientErrorCode =
          options.signal?.aborted || !timedOut ? 'aborted' : 'timeout'
        const retryable = code === 'timeout'
        const wrapped = new ApiClientError({
          message: code === 'timeout' ? 'Request timed out' : 'Request aborted',
          code,
          url,
          retryable,
        })

        if (attempt < maxAttempts && wrapped.retryable) {
          await wait(toRetryDelay(attempt, retryDelayMs))
          continue
        }

        throw wrapped
      }

      const wrapped = new ApiClientError({
        message: 'Network request failed',
        code: 'network',
        url,
        retryable: true,
      })

      if (attempt < maxAttempts && wrapped.retryable) {
        await wait(toRetryDelay(attempt, retryDelayMs))
        continue
      }

      throw wrapped
    } finally {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      options.signal?.removeEventListener('abort', abortFromCaller)
    }
  }

  throw new ApiClientError({
    message: 'Request attempts exhausted',
    code: 'network',
    url,
  })
}
