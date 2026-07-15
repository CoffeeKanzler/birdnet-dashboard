import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requestJsonMock = vi.hoisted(() => vi.fn())

vi.mock('./apiClient', () => ({
  buildApiUrl: (path: string) => path,
  requestJson: (...args: unknown[]) => requestJsonMock(...args),
}))

import { fetchSummary30d } from './summary'

type OnResponseOptions = { onResponse?: (response: Response) => void }

describe('fetchSummary30d', () => {
  beforeEach(() => {
    requestJsonMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('normalizes snake_case fields and object-shaped hourly bins', async () => {
    requestJsonMock.mockImplementation(async (_url: string, options?: OnResponseOptions) => {
      options?.onResponse?.({ status: 200 } as Response)
      return {
        generated_at: '2026-01-01T00:00:00Z',
        window_start: '2025-12-01T00:00:00Z',
        window_end: '2026-01-01T00:00:00Z',
        stats: {
          total_detections: 42,
          unique_species: 7,
          avg_confidence: 0.8,
          hourly_bins: [{ hour: 3, count: 5 }],
          top_species: [{ common_name: 'Amsel', scientific_name: 'Turdus merula', count: 3 }],
        },
        archive: [{ common_name: 'Kohlmeise', scientific_name: 'Parus major', count: 2 }],
      }
    })

    const result = await fetchSummary30d()

    expect(result.pending).toBe(false)
    expect(result.generatedAt).toBe('2026-01-01T00:00:00Z')
    expect(result.stats.totalDetections).toBe(42)
    expect(result.stats.hourlyBins).toHaveLength(24)
    expect(result.stats.hourlyBins[3]).toBe(5)
    expect(result.stats.topSpecies[0]).toEqual({
      commonName: 'Amsel',
      scientificName: 'Turdus merula',
      count: 3,
      lastSeenAt: undefined,
    })
    expect(result.archive.groups[0]?.commonName).toBe('Kohlmeise')
  })

  it('returns a pending placeholder when the backend responds 202', async () => {
    requestJsonMock.mockImplementation(async (_url: string, options?: OnResponseOptions) => {
      options?.onResponse?.({ status: 202 } as Response)
      return Promise.reject(new Error('not ready yet'))
    })

    const result = await fetchSummary30d()

    expect(result.pending).toBe(true)
    expect(result.stats.totalDetections).toBe(0)
    expect(result.stats.hourlyBins).toEqual(Array.from({ length: 24 }, () => 0))
    expect(result.archive.groups).toEqual([])
  })

  it('rethrows errors that are not a pending (202) response', async () => {
    requestJsonMock.mockImplementation(async (_url: string, options?: OnResponseOptions) => {
      options?.onResponse?.({ status: 500 } as Response)
      return Promise.reject(new Error('boom'))
    })

    await expect(fetchSummary30d()).rejects.toThrow('boom')
  })

  it('falls back to defaults when optional fields are entirely missing', async () => {
    requestJsonMock.mockImplementation(async (_url: string, options?: OnResponseOptions) => {
      options?.onResponse?.({ status: 200 } as Response)
      return {}
    })

    const result = await fetchSummary30d()

    expect(result.windowStart).toBe('')
    expect(result.windowEnd).toBe('')
    expect(result.stats.hourlyBins).toEqual(Array.from({ length: 24 }, () => 0))
    expect(result.stats.topSpecies).toEqual([])
    expect(result.archive.groups).toEqual([])
  })

  it('uses the direct request path with camelCase fields and array-shaped hourly bins in demo mode', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')

    requestJsonMock.mockResolvedValue({
      generatedAt: '2026-02-01T00:00:00Z',
      windowStart: '2026-01-01T00:00:00Z',
      windowEnd: '2026-02-01T00:00:00Z',
      stats: {
        totalDetections: 10,
        uniqueSpecies: 4,
        avgConfidence: 0.5,
        hourlyBins: Array.from({ length: 24 }, (_, i) => i),
        topSpecies: [{ commonName: 'Star', scientificName: 'Sturnus vulgaris', count: 1 }],
      },
      archive: { groups: [{ commonName: 'Star', scientificName: 'Sturnus vulgaris', count: 1 }] },
    })

    const result = await fetchSummary30d()

    expect(result.pending).toBe(false)
    expect(result.generatedAt).toBe('2026-02-01T00:00:00Z')
    expect(result.stats.hourlyBins[5]).toBe(5)
    expect(result.archive.groups).toHaveLength(1)
  })
})
