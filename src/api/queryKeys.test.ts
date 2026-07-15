import { describe, expect, it } from 'vitest'

import { queryKeys } from './queryKeys'

describe('queryKeys', () => {
  it('builds the summary key', () => {
    expect(queryKeys.summary.thirtyDays()).toEqual(['birdnet', 'summary', '30d'])
  })

  it('builds detections keys with and without a limit', () => {
    expect(queryKeys.detections.today(10)).toEqual(['birdnet', 'detections', 'today', 10])
    expect(queryKeys.detections.today()).toEqual(['birdnet', 'detections', 'today', undefined])
    expect(queryKeys.detections.recent(5)).toEqual(['birdnet', 'detections', 'recent', 5])
    expect(queryKeys.detections.page(20)).toEqual(['birdnet', 'detections', 'page', 20])
    expect(queryKeys.detections.species('Turdus merula')).toEqual([
      'birdnet',
      'detections',
      'species',
      'Turdus merula',
    ])
  })

  it('builds range keys, defaulting maxDetections to 0', () => {
    expect(queryKeys.detections.range('2026-01-01', '2026-01-02', 'range', 100)).toEqual([
      'birdnet',
      'detections',
      'range',
      '2026-01-01',
      '2026-01-02',
      'range',
      100,
    ])
    expect(queryKeys.detections.range('2026-01-01', '2026-01-02', 'range')).toEqual([
      'birdnet',
      'detections',
      'range',
      '2026-01-01',
      '2026-01-02',
      'range',
      0,
    ])
  })

  it('builds species-info, species-photo, and family-match keys', () => {
    expect(queryKeys.speciesInfo('Turdus merula')).toEqual(['birdnet', 'species-info', 'Turdus merula'])
    expect(queryKeys.speciesPhoto('Amsel', 'Turdus merula')).toEqual([
      'birdnet',
      'species-photo',
      'Amsel',
      'Turdus merula',
    ])
    expect(queryKeys.familyMatches('corvidae')).toEqual(['birdnet', 'family-matches', 'corvidae'])
  })
})
