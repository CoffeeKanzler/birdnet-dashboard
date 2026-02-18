import { describe, expect, it } from 'vitest'

import { ApiClientError } from '../api/apiClient'
import { toUserErrorMessage } from './errorMessages'

describe('toUserErrorMessage', () => {
  it('maps timeout errors to friendly service message', () => {
    const error = new ApiClientError({
      message: 'Request timed out',
      code: 'timeout',
      url: '/api/v2/detections',
      retryable: true,
    })

    const message = toUserErrorMessage(error, 'Fallback', 'BirdNET')

    expect(message).toContain('BirdNET')
    expect(message).toContain('nicht rechtzeitig')
  })

  it('maps http status details for plain errors', () => {
    const message = toUserErrorMessage(
      new Error('BirdNET-Anfrage fehlgeschlagen: 503'),
      'Fallback',
      'BirdNET',
    )

    expect(message).toContain('momentan nicht verfuegbar')
  })

  it('falls back to provided message for unknown errors', () => {
    const message = toUserErrorMessage({ reason: 'unknown' }, 'Eigene Fallback-Meldung')
    expect(message).toBe('Eigene Fallback-Meldung')
  })

  it('maps network and parse api-client error codes', () => {
    const networkError = new ApiClientError({
      message: 'Network request failed',
      code: 'network',
      url: '/api/test',
      retryable: true,
    })
    const parseError = new ApiClientError({
      message: 'Response JSON parsing failed',
      code: 'parse',
      url: '/api/test',
    })

    expect(toUserErrorMessage(networkError, 'Fallback', 'BirdNET')).toContain('Verbindung zu BirdNET')
    expect(toUserErrorMessage(parseError, 'Fallback', 'BirdNET')).toContain('nicht verarbeitet')
  })

  it('maps http statuses from ApiClientError', () => {
    const makeHttpError = (status: number) =>
      new ApiClientError({
        message: `HTTP request failed with status ${status}`,
        code: 'http',
        url: '/api/test',
        status,
      })

    expect(toUserErrorMessage(makeHttpError(401), 'Fallback', 'BirdNET')).toContain('wurde verweigert')
    expect(toUserErrorMessage(makeHttpError(404), 'Fallback', 'BirdNET')).toContain('nicht finden')
    expect(toUserErrorMessage(makeHttpError(408), 'Fallback', 'BirdNET')).toContain('ist fehlgeschlagen')
    expect(toUserErrorMessage(makeHttpError(425), 'Fallback', 'BirdNET')).toContain('ist fehlgeschlagen')
    expect(toUserErrorMessage(makeHttpError(429), 'Fallback', 'BirdNET')).toContain('Zu viele Anfragen')
    expect(toUserErrorMessage(makeHttpError(502), 'Fallback', 'BirdNET')).toContain('momentan nicht verfuegbar')
    expect(toUserErrorMessage(makeHttpError(503), 'Fallback', 'BirdNET')).toContain('momentan nicht verfuegbar')
    expect(toUserErrorMessage(makeHttpError(500), 'Fallback', 'BirdNET')).toContain('momentan nicht verfuegbar')
    expect(toUserErrorMessage(makeHttpError(418), 'Fallback', 'BirdNET')).toContain('ist fehlgeschlagen')
  })

  it('returns fallback for aborted errors', () => {
    const apiAbort = new ApiClientError({
      message: 'Request aborted',
      code: 'aborted',
      url: '/api/test',
    })
    const nativeAbort = new Error('aborted')
    nativeAbort.name = 'AbortError'

    expect(toUserErrorMessage(apiAbort, 'Fallback')).toBe('Fallback')
    expect(toUserErrorMessage(nativeAbort, 'Fallback')).toBe('Fallback')
  })

  it('uses Backend as default service label when none is provided', () => {
    const message = toUserErrorMessage(
      new Error('Request failed with status 500'),
      'Fallback',
      ' ',
    )

    expect(message).toContain('Backend')
  })

  it('falls back for ApiClientError http code without explicit status', () => {
    const error = new ApiClientError({
      message: 'http without status',
      code: 'http',
      url: '/api/test',
    })

    expect(toUserErrorMessage(error, 'Fallback', 'BirdNET')).toBe('Fallback')
  })
})
