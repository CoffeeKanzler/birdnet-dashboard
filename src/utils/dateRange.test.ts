import { describe, expect, it } from 'vitest'

import { formatDisplayDate, parseDateInput, toDateInputValue } from './dateRange'

describe('toDateInputValue', () => {
  it('formats a date as zero-padded YYYY-MM-DD', () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toDateInputValue(new Date(2026, 10, 23))).toBe('2026-11-23')
  })
})

describe('parseDateInput', () => {
  it('returns null for an empty value', () => {
    expect(parseDateInput('')).toBeNull()
  })

  it('returns null when the value has non-numeric or missing parts', () => {
    expect(parseDateInput('not-a-date')).toBeNull()
    expect(parseDateInput('2026-00-01')).toBeNull()
  })

  it('returns null when the constructed date is out of range', () => {
    expect(parseDateInput('99999999999-01-01')).toBeNull()
  })

  it('parses a valid date', () => {
    const parsed = parseDateInput('2026-03-14')
    expect(parsed).toBeInstanceOf(Date)
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(2)
    expect(parsed?.getDate()).toBe(14)
  })
})

describe('formatDisplayDate', () => {
  it('returns a localized medium date for a valid input', () => {
    const formatted = formatDisplayDate('2026-03-14')
    expect(formatted).not.toBe('common.unknown')
    expect(formatted.length).toBeGreaterThan(0)
  })

  it('falls back to the "unknown" label for an unparsable value', () => {
    expect(formatDisplayDate('')).toBe('Unbekannt')
    expect(formatDisplayDate('garbage')).toBe('Unbekannt')
  })
})
