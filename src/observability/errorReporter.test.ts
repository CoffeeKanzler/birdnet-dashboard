import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearFrontendErrorRecords,
  FRONTEND_ERROR_EVENT,
  getFrontendErrorRecords,
  reportFrontendError,
} from './errorReporter'

describe('errorReporter', () => {
  beforeEach(() => {
    clearFrontendErrorRecords()
    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('records error events with metadata', () => {
    reportFrontendError({
      source: 'unit-test',
      error: new Error('Boom'),
      metadata: { feature: 'tests' },
    })

    const records = getFrontendErrorRecords()
    expect(records).toHaveLength(1)
    expect(records[0]?.source).toBe('unit-test')
    expect(records[0]?.message).toBe('Boom')
    expect(records[0]?.metadata).toEqual({ feature: 'tests' })
    expect(records[0]?.release).toBeTruthy()
  })

  it('emits browser event when reporting errors', () => {
    const listener = vi.fn()
    window.addEventListener(FRONTEND_ERROR_EVENT, listener)

    reportFrontendError({ source: 'event-test', error: new Error('Event failure') })

    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(FRONTEND_ERROR_EVENT, listener)
  })

  it('keeps only latest bounded records', () => {
    for (let index = 0; index < 205; index += 1) {
      reportFrontendError({
        source: 'bounded-test',
        error: new Error(`error-${index}`),
      })
    }

    const records = getFrontendErrorRecords()
    expect(records).toHaveLength(200)
    expect(records[0]?.message).toBe('error-5')
    expect(records[199]?.message).toBe('error-204')
  })
})
