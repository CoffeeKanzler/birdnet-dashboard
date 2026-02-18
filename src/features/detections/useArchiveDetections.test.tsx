import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useArchiveDetections } from './useArchiveDetections'

const fetchDetectionsPageMock = vi.hoisted(() => vi.fn())
const fetchDetectionsRangePageMock = vi.hoisted(() => vi.fn())
const getDayCachedPageMock = vi.hoisted(() => vi.fn())
const setDayCachedPageMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/birdnet', () => ({
  fetchDetectionsPage: (...args: unknown[]) => fetchDetectionsPageMock(...args),
  fetchDetectionsRangePage: (...args: unknown[]) => fetchDetectionsRangePageMock(...args),
}))

vi.mock('./dayCache', () => ({
  getDayCachedPage: (...args: unknown[]) => getDayCachedPageMock(...args),
  setDayCachedPage: (...args: unknown[]) => setDayCachedPageMock(...args),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useArchiveDetections', () => {
  beforeEach(() => {
    fetchDetectionsPageMock.mockReset()
    fetchDetectionsRangePageMock.mockReset()
    getDayCachedPageMock.mockReset()
    setDayCachedPageMock.mockReset()
  })

  it('uses cached first page, fetches follow-up pages, and deduplicates range results', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-03T00:00:00.000Z')

    getDayCachedPageMock.mockReturnValue(null)

    fetchDetectionsRangePageMock
      .mockResolvedValueOnce({
        detections: [
          {
            id: 'a',
            commonName: 'Amsel',
            scientificName: 'Turdus merula',
            confidence: 0.9,
            timestamp: '2026-01-02T08:00:00.000Z',
          },
          {
            id: 'outside',
            commonName: 'Alt',
            scientificName: 'Old',
            confidence: 0.7,
            timestamp: '2025-12-31T23:00:00.000Z',
          },
          ...Array.from({ length: 498 }, (_, index) => ({
            id: `seed-${index}`,
            commonName: `Seed ${index}`,
            scientificName: `Seed species ${index}`,
            confidence: 0.5,
            timestamp: '2026-01-02T07:00:00.000Z',
          })),
        ],
        total: 500,
      })
      .mockResolvedValueOnce({
      detections: [
        {
          id: 'a',
          commonName: 'Amsel',
          scientificName: 'Turdus merula',
          confidence: 0.9,
          timestamp: '2026-01-02T08:00:00.000Z',
        },
        {
          id: 'b',
          commonName: 'Kohlmeise',
          scientificName: 'Parus major',
          confidence: 0.8,
          timestamp: '2026-01-01T10:00:00.000Z',
        },
      ],
      total: 2,
    })

    const { result } = renderHook(
      () => useArchiveDetections(start, end, { queryMode: 'range' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const ids = result.current.detections.map((item) => item.id)
    expect(ids.filter((id) => id === 'a')).toHaveLength(1)
    expect(ids).toContain('b')
    expect(fetchDetectionsRangePageMock).toHaveBeenCalledTimes(2)
    expect(setDayCachedPageMock).toHaveBeenCalledTimes(2)
  })

  it('supports global mode pagination path', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-03T00:00:00.000Z')

    fetchDetectionsPageMock.mockResolvedValue([
      {
        id: 'x',
        commonName: 'Rotmilan',
        scientificName: 'Milvus milvus',
        confidence: 0.8,
        timestamp: '2026-01-01T09:00:00.000Z',
      },
    ])

    const { result } = renderHook(
      () => useArchiveDetections(start, end, { queryMode: 'global' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.detections).toHaveLength(1)
    expect(fetchDetectionsPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 500,
        offset: 0,
      }),
    )
  })
})
