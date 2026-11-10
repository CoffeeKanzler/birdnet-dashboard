import { describe, expect, it } from 'vitest'

import {
  normalizeDetectionsQuery,
  parseBoundedPositiveInt,
  sliceDetectionsPage,
} from './request-limits.mjs'

describe('parseBoundedPositiveInt', () => {
  it('keeps valid values within the requested range', () => {
    expect(parseBoundedPositiveInt('125', 100, 2000)).toBe(125)
  })

  it('caps oversized values before they reach an upstream API', () => {
    expect(parseBoundedPositiveInt('999999', 100, 2000)).toBe(2000)
  })

  it('uses the fallback for invalid or unsafe integers', () => {
    expect(parseBoundedPositiveInt('1e309', 100, 2000)).toBe(100)
    expect(parseBoundedPositiveInt('-1', 100, 2000)).toBe(100)
  })

  it('uses the fallback for missing or blank values', () => {
    expect(parseBoundedPositiveInt(null, 100, 2000)).toBe(100)
    expect(parseBoundedPositiveInt('', 100, 2000)).toBe(100)
    expect(parseBoundedPositiveInt('  ', 100, 2000)).toBe(100)
    expect(normalizeDetectionsQuery(new URLSearchParams('offset=0')).get('numResults')).toBe('500')
  })

  it('caps archive page size and offset while preserving search filters', () => {
    const params = normalizeDetectionsQuery(
      new URLSearchParams(
        'numResults=999999&offset=999999999&queryType=search&search=Parus%20major',
      ),
    )

    expect(params.toString()).toBe(
      'numResults=500&offset=100000&queryType=search&search=Parus+major',
    )
  })

  it('applies the archive page cap to cached fallback results', () => {
    const rows = Array.from({ length: 1000 }, (_, index) => index)
    const result = sliceDetectionsPage(
      rows,
      new URLSearchParams('numResults=999999&offset=0'),
    )

    expect(result).toHaveLength(500)
    expect(result[0]).toBe(0)
    expect(result.at(-1)).toBe(499)
  })
})
