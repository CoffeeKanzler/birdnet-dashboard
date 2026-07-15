import { describe, expect, it } from 'vitest'

import { getMockBirdnetJson } from './mockBirdnetApi'

type SummaryPayload = {
  generated_at: string
  window_start: string
  window_end: string
  stats: {
    total_detections: number
    unique_species: number
    avg_confidence: number
    hourly_bins: number[]
    top_species: Array<{ common_name: string; scientific_name: string; count: number }>
  }
  archive: { groups: Array<{ common_name: string }> }
}

type DetectionPayload = Array<{
  id: string
  common_name: string
  scientific_name: string
  timestamp: string
}>

type SpeciesPayload =
  | { message: string }
  | {
      scientific_name: string
      common_name: string
      rarity: { status: string }
      taxonomy: { family_common: string }
      metadata: { source: string }
    }

type FamilyMatchesPayload = {
  family_common: string
  matches: Array<{ commonName: string; scientificName: string }>
}

describe('getMockBirdnetJson', () => {
  it('returns null for an unknown path', () => {
    expect(getMockBirdnetJson('/api/v2/does-not-exist')).toBeNull()
  })

  it('builds a 30-day summary with hourly bins and grouped species counts', () => {
    const result = getMockBirdnetJson('/api/v2/summary/30d')
    expect(result?.headers).toEqual({ 'x-summary-cache': 'fresh' })

    const payload = result?.payload as SummaryPayload
    expect(payload.stats.total_detections).toBe(25)
    expect(payload.stats.unique_species).toBe(8)
    expect(payload.stats.hourly_bins).toHaveLength(24)
    expect(payload.stats.hourly_bins.reduce((sum, n) => sum + n, 0)).toBe(25)
    expect(payload.stats.top_species.length).toBeLessThanOrEqual(10)
    expect(payload.archive.groups.length).toBe(8)
    expect(payload.archive.groups[0]?.common_name).toBe('Blue Tit')
  })

  it('returns recent detections, defaulting to a limit of 30', () => {
    const result = getMockBirdnetJson('/api/v2/detections/recent')
    expect(result?.headers).toEqual({ 'x-detections-cache': 'fresh' })
    expect(result?.payload as DetectionPayload).toHaveLength(25)
  })

  it('applies an explicit limit to recent detections', () => {
    const result = getMockBirdnetJson('/api/v2/detections/recent?limit=5')
    expect(result?.payload as DetectionPayload).toHaveLength(5)
  })

  it('filters detections by search term across common and scientific name', () => {
    const result = getMockBirdnetJson('/api/v2/detections?queryType=search&search=Blue')
    const payload = result?.payload as DetectionPayload
    expect(payload.length).toBeGreaterThan(0)
    expect(payload.every((d) => d.common_name === 'Blue Tit')).toBe(true)
  })

  it('filters detections by date range, excluding everything outside it', () => {
    const outOfRange = getMockBirdnetJson(
      '/api/v2/detections?start_date=2000-01-01&end_date=2000-01-02',
    )
    expect(outOfRange?.payload as DetectionPayload).toHaveLength(0)

    const wideRange = getMockBirdnetJson(
      '/api/v2/detections?start_date=2000-01-01&end_date=2100-01-01',
    )
    expect(wideRange?.payload as DetectionPayload).toHaveLength(25)
  })

  it('paginates detections using numResults and offset', () => {
    const result = getMockBirdnetJson('/api/v2/detections?numResults=3&offset=2')
    const payload = result?.payload as DetectionPayload
    expect(payload).toHaveLength(3)

    const firstPage = getMockBirdnetJson('/api/v2/detections?numResults=3&offset=0')
      ?.payload as DetectionPayload
    expect(payload[0]?.id).not.toBe(firstPage[0]?.id)
  })

  it('clamps the detections limit to at least 1', () => {
    const result = getMockBirdnetJson('/api/v2/detections?numResults=0')
    expect(result?.payload as DetectionPayload).toHaveLength(1)
  })

  it('looks up a known species by scientific name', () => {
    const result = getMockBirdnetJson(
      '/api/v2/species?scientific_name=Cyanistes%20caeruleus',
    )
    expect(result?.headers).toBeUndefined()

    const payload = result?.payload as SpeciesPayload
    expect(payload).toEqual({
      scientific_name: 'Cyanistes caeruleus',
      common_name: 'Blue Tit',
      rarity: { status: 'very_common' },
      taxonomy: { family_common: 'Tits, Chickadees, and Titmice' },
      metadata: { source: 'demo' },
    })
  })

  it('returns a not-found payload for an unknown species', () => {
    const result = getMockBirdnetJson('/api/v2/species?scientific_name=Does%20Not%20Exist')
    expect(result?.payload).toEqual({ message: 'not found' })
    expect(result?.headers).toBeUndefined()
  })

  it('returns family matches excluding the requesting species, honoring the limit', () => {
    const result = getMockBirdnetJson(
      '/api/v2/family-matches?familyCommon=Tits%2C%20Chickadees%2C%20and%20Titmice&scientificName=Cyanistes%20caeruleus&limit=2',
    )
    const payload = result?.payload as FamilyMatchesPayload
    expect(result?.headers).toEqual({ 'x-family-cache': 'fresh' })
    expect(payload.family_common).toBe('Tits, Chickadees, and Titmice')
    expect(payload.matches).toHaveLength(2)
    expect(payload.matches.some((m) => m.scientificName === 'Cyanistes caeruleus')).toBe(false)
  })

  it('clamps the family-matches limit to at most 50 and at least 1', () => {
    const overLimit = getMockBirdnetJson(
      '/api/v2/family-matches?familyCommon=Tits%2C%20Chickadees%2C%20and%20Titmice&limit=100',
    )
    const overPayload = overLimit?.payload as FamilyMatchesPayload
    expect(overPayload.matches.length).toBeLessThanOrEqual(50)

    const zeroLimit = getMockBirdnetJson(
      '/api/v2/family-matches?familyCommon=Tits%2C%20Chickadees%2C%20and%20Titmice&limit=0',
    )
    const zeroPayload = zeroLimit?.payload as FamilyMatchesPayload
    expect(zeroPayload.matches).toHaveLength(1)
  })

  it('returns an empty matches list for an unknown family', () => {
    const result = getMockBirdnetJson('/api/v2/family-matches?familyCommon=Nonexistent')
    expect((result?.payload as FamilyMatchesPayload).matches).toEqual([])
  })

  it('resolves a relative URL against window.location.origin', () => {
    expect(() => getMockBirdnetJson('/api/v2/summary/30d')).not.toThrow()
  })
})
