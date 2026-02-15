import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { type Detection } from '../../api/birdnet'
import { type NotableSpecies } from '../../data/notableSpecies'
import { matchNotableSpecies, useNotableSpotlight } from './useNotableSpotlight'

const makeDetection = (value: Partial<Detection>): Detection => ({
  id: value.id ?? 'id',
  commonName: value.commonName ?? 'Unknown',
  scientificName: value.scientificName ?? 'Unknown',
  confidence: value.confidence ?? 0,
  timestamp: value.timestamp ?? '2026-02-14T00:00:00Z',
})

describe('matchNotableSpecies', () => {
  it('matches by common name, scientific name, and aliases', () => {
    const notables: NotableSpecies[] = [
      {
        commonName: 'Barn Owl',
        scientificName: 'Tyto alba',
        aliases: ['Schleiereule'],
      },
      {
        commonName: 'Mute Swan',
        scientificName: 'Cygnus olor',
      },
    ]

    const detections: Detection[] = [
      makeDetection({
        id: 'a',
        commonName: 'Schleiereule',
        scientificName: 'Tyto alba',
        timestamp: '2026-02-14T06:00:00Z',
      }),
      makeDetection({
        id: 'b',
        commonName: 'Mute Swan',
        scientificName: 'Cygnus olor',
        timestamp: '2026-02-14T05:00:00Z',
      }),
    ]

    const matches = matchNotableSpecies(notables, detections)

    expect(matches).toHaveLength(2)
    expect(matches[0]?.species.commonName).toBe('Barn Owl')
    expect(matches[1]?.species.commonName).toBe('Mute Swan')
  })

  it('tracks count and latest valid timestamp', () => {
    const notables: NotableSpecies[] = [
      {
        commonName: 'Common Kestrel',
        scientificName: 'Falco tinnunculus',
      },
    ]

    const detections: Detection[] = [
      makeDetection({
        id: '1',
        commonName: 'Common Kestrel',
        scientificName: 'Falco tinnunculus',
        timestamp: 'invalid',
      }),
      makeDetection({
        id: '2',
        commonName: 'Common Kestrel',
        scientificName: 'Falco tinnunculus',
        timestamp: '2026-02-14T08:10:00Z',
      }),
      makeDetection({
        id: '3',
        commonName: 'Common Kestrel',
        scientificName: 'Falco tinnunculus',
        timestamp: '2026-02-14T10:25:00Z',
      }),
    ]

    const [spotlight] = matchNotableSpecies(notables, detections)

    expect(spotlight?.detectionCount).toBe(3)
    expect(spotlight?.lastSeenAt?.toISOString()).toBe('2026-02-14T10:25:00.000Z')
  })
})

describe('useNotableSpotlight', () => {
  it('returns first matched notable in list order', () => {
    const notables: NotableSpecies[] = [
      {
        commonName: 'First Match',
        scientificName: 'Species one',
      },
      {
        commonName: 'Second Match',
        scientificName: 'Species two',
      },
    ]

    const detections: Detection[] = [
      makeDetection({
        id: 'x',
        commonName: 'Second Match',
        scientificName: 'Species two',
      }),
      makeDetection({
        id: 'y',
        commonName: 'First Match',
        scientificName: 'Species one',
      }),
    ]

    const { result } = renderHook(() => {
      return useNotableSpotlight({ notables, detections })
    })

    expect(result.current?.species.commonName).toBe('First Match')
  })

  it('returns null when no notables are detected', () => {
    const { result } = renderHook(() => {
      return useNotableSpotlight({
        notables: [{ commonName: 'Rare Bird', scientificName: 'Rare species' }],
        detections: [
          makeDetection({
            commonName: 'Common Bird',
            scientificName: 'Common species',
          }),
        ],
      })
    })

    expect(result.current).toBeNull()
  })
})
