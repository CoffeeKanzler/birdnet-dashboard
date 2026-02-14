import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiClientError } from '../../api/apiClient'
import { fetchSpeciesDetectionsPage } from '../../api/birdnet'
import { reportFrontendError } from '../../observability/errorReporter'
import { useSpeciesDetections } from './useSpeciesDetections'

vi.mock('../../api/birdnet', () => ({
  fetchSpeciesDetectionsPage: vi.fn(),
}))

vi.mock('../../observability/errorReporter', () => ({
  reportFrontendError: vi.fn(),
}))

describe('useSpeciesDetections', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads detections and keeps only matching species names', async () => {
    vi.mocked(fetchSpeciesDetectionsPage).mockResolvedValue({
      detections: [
        {
          id: '1',
          commonName: 'Mönchsgrasmücke',
          scientificName: 'Sylvia atricapilla',
          confidence: 0.87,
          timestamp: '2026-02-14T12:00:00Z',
        },
        {
          id: '2',
          commonName: 'Monchsgrasmucke',
          scientificName: 'Sylvia atricapilla',
          confidence: 0.72,
          timestamp: '2026-02-14T11:00:00Z',
        },
        {
          id: '3',
          commonName: 'Blaumeise',
          scientificName: 'Cyanistes caeruleus',
          confidence: 0.92,
          timestamp: '2026-02-14T10:00:00Z',
        },
      ],
      total: 3,
    })

    const { result } = renderHook(() =>
      useSpeciesDetections('Mönchsgrasmücke', 'Sylvia atricapilla'),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(fetchSpeciesDetectionsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        scientificName: 'Sylvia atricapilla',
        limit: 50,
        offset: 0,
      }),
    )
    expect(result.current.detections.map((entry) => entry.id)).toEqual(['1', '2'])
    expect(result.current.error).toBeNull()
    expect(result.current.hasMore).toBe(false)
    expect(result.current.isLoadingMore).toBe(false)
  })

  it('returns no detections when no name was selected', async () => {
    const { result } = renderHook(() => useSpeciesDetections('', ''))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(fetchSpeciesDetectionsPage).not.toHaveBeenCalled()
    expect(result.current.detections).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('reports api failures with user facing errors', async () => {
    const error = new ApiClientError({
      code: 'http',
      message: 'HTTP request failed with status 503',
      status: 503,
      url: 'https://api.example.test/api/v2/detections',
      retryable: true,
    })

    vi.mocked(fetchSpeciesDetectionsPage).mockRejectedValue(error)

    const { result } = renderHook(() =>
      useSpeciesDetections('Rotkehlchen', 'Erithacus rubecula'),
    )

    await waitFor(() => {
      expect(result.current.error).toContain('BirdNET ist momentan nicht verfuegbar')
    })

    expect(reportFrontendError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'useSpeciesDetections.loadBatch',
        error,
      }),
    )
  })
})
