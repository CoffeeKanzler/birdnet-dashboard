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
})
