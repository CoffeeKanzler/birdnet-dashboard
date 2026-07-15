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

  const makeDetections = (
    count: number,
    opts: { idPrefix: string; timestamp: string | ((index: number) => string) },
  ) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${opts.idPrefix}-${index}`,
      commonName: `Species ${opts.idPrefix}-${index}`,
      scientificName: `Sci ${opts.idPrefix}-${index}`,
      confidence: 0.8,
      timestamp: typeof opts.timestamp === 'function' ? opts.timestamp(index) : opts.timestamp,
    }))

  it('range mode: stops fetching more pages once maxDetections is reached', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-10T00:00:00.000Z')

    getDayCachedPageMock.mockReturnValue(null)
    fetchDetectionsRangePageMock.mockImplementation(async ({ offset }: { offset: number }) => {
      if (offset === 0) {
        return { detections: makeDetections(500, { idPrefix: 'p0', timestamp: '2026-01-05T00:00:00.000Z' }), total: 1000 }
      }
      if (offset === 500) {
        return { detections: makeDetections(500, { idPrefix: 'p1', timestamp: '2026-01-05T00:00:00.000Z' }), total: 1000 }
      }
      throw new Error(`unexpected offset ${offset}`)
    })

    const { result } = renderHook(
      () => useArchiveDetections(start, end, { queryMode: 'range', maxDetections: 700 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.detections).toHaveLength(1000)
    expect(fetchDetectionsRangePageMock).toHaveBeenCalledTimes(2)
  })

  it('range mode: stops fetching once earlyStopLookupKeys/earlyStopTarget are satisfied within the first page', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-10T00:00:00.000Z')

    const items = makeDetections(500, { idPrefix: 'p0', timestamp: '2026-01-05T00:00:00.000Z' })
    items[0] = { ...items[0], commonName: 'Amsel', scientificName: 'Turdus merula' }
    items[1] = { ...items[1], commonName: 'Kohlmeise', scientificName: 'Parus major' }

    getDayCachedPageMock.mockReturnValue(null)
    fetchDetectionsRangePageMock.mockImplementation(async ({ offset }: { offset: number }) => {
      if (offset === 0) {
        return { detections: items, total: 500 }
      }
      throw new Error(`should not fetch offset ${offset}`)
    })

    const { result } = renderHook(
      () =>
        useArchiveDetections(start, end, {
          queryMode: 'range',
          earlyStopLookupKeys: new Set(['amsel', 'parus major']),
          earlyStopTarget: 2,
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.detections).toHaveLength(500)
    expect(fetchDetectionsRangePageMock).toHaveBeenCalledTimes(1)
  })

  it('range mode: breaks the pagination loop when a page is older than the start of the range', async () => {
    const start = new Date('2026-01-05T00:00:00.000Z')
    const end = new Date('2026-01-10T00:00:00.000Z')

    getDayCachedPageMock.mockReturnValue(null)
    fetchDetectionsRangePageMock.mockImplementation(async ({ offset }: { offset: number }) => {
      if (offset === 0) {
        return { detections: makeDetections(500, { idPrefix: 'p0', timestamp: '2026-01-06T00:00:00.000Z' }), total: 1000 }
      }
      if (offset === 500) {
        const page = makeDetections(500, { idPrefix: 'p1', timestamp: '2026-01-06T00:00:00.000Z' })
        page[page.length - 1] = { ...page[page.length - 1], timestamp: '2026-01-01T00:00:00.000Z' }
        return { detections: page, total: 1000 }
      }
      throw new Error(`unexpected offset ${offset}`)
    })

    const { result } = renderHook(
      () => useArchiveDetections(start, end, { queryMode: 'range' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchDetectionsRangePageMock).toHaveBeenCalledTimes(2)
  })

  it('range mode: keeps paginating across multiple full pages until a short page ends it', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-10T00:00:00.000Z')

    getDayCachedPageMock.mockReturnValue(null)
    fetchDetectionsRangePageMock.mockImplementation(async ({ offset }: { offset: number }) => {
      if (offset === 0 || offset === 500) {
        return {
          detections: makeDetections(500, { idPrefix: `p${offset}`, timestamp: '2026-01-05T00:00:00.000Z' }),
          total: 1005,
        }
      }
      if (offset === 1000) {
        return { detections: makeDetections(5, { idPrefix: 'p1000', timestamp: '2026-01-05T00:00:00.000Z' }), total: 1005 }
      }
      throw new Error(`unexpected offset ${offset}`)
    })

    const { result } = renderHook(
      () => useArchiveDetections(start, end, { queryMode: 'range' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.detections).toHaveLength(1005)
    expect(fetchDetectionsRangePageMock).toHaveBeenCalledTimes(3)
  })

  it('range mode: fetches multiple offsets concurrently when parallelBatchSize > 1', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-10T00:00:00.000Z')

    getDayCachedPageMock.mockReturnValue(null)
    fetchDetectionsRangePageMock.mockImplementation(async ({ offset }: { offset: number }) => {
      if (offset === 0) {
        return { detections: makeDetections(500, { idPrefix: 'p0', timestamp: '2026-01-05T00:00:00.000Z' }), total: 510 }
      }
      if (offset === 500 || offset === 1000) {
        return {
          detections: makeDetections(5, { idPrefix: `p${offset}`, timestamp: '2026-01-05T00:00:00.000Z' }),
          total: 510,
        }
      }
      throw new Error(`unexpected offset ${offset}`)
    })

    const { result } = renderHook(
      () => useArchiveDetections(start, end, { queryMode: 'range', parallelBatchSize: 2 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchDetectionsRangePageMock).toHaveBeenCalledTimes(3)
    expect(setDayCachedPageMock).toHaveBeenCalledTimes(3)
  })

  it('global mode: keeps paginating across multiple full pages until a short page ends it', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-10T00:00:00.000Z')

    fetchDetectionsPageMock.mockImplementation(async ({ offset }: { offset: number }) => {
      if (offset === 0 || offset === 500) {
        return makeDetections(500, { idPrefix: `g${offset}`, timestamp: '2026-01-05T00:00:00.000Z' })
      }
      if (offset === 1000) {
        return makeDetections(5, { idPrefix: 'g1000', timestamp: '2026-01-05T00:00:00.000Z' })
      }
      throw new Error(`unexpected offset ${offset}`)
    })

    const { result } = renderHook(
      () => useArchiveDetections(start, end, { queryMode: 'global' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.detections).toHaveLength(1005)
    expect(fetchDetectionsPageMock).toHaveBeenCalledTimes(3)
  })

  it('global mode: stops fetching more pages once maxDetections is reached', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-10T00:00:00.000Z')

    fetchDetectionsPageMock.mockImplementation(async ({ offset }: { offset: number }) => {
      if (offset === 0 || offset === 500) {
        return makeDetections(500, { idPrefix: `g${offset}`, timestamp: '2026-01-05T00:00:00.000Z' })
      }
      throw new Error(`unexpected offset ${offset}`)
    })

    const { result } = renderHook(
      () => useArchiveDetections(start, end, { queryMode: 'global', maxDetections: 700 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.detections).toHaveLength(1000)
    expect(fetchDetectionsPageMock).toHaveBeenCalledTimes(2)
  })

  it('does not fetch and stays disabled for an invalid date range', () => {
    const { result } = renderHook(
      () => useArchiveDetections(new Date('invalid'), new Date('invalid')),
      { wrapper: createWrapper() },
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.detections).toEqual([])
    expect(fetchDetectionsRangePageMock).not.toHaveBeenCalled()
    expect(fetchDetectionsPageMock).not.toHaveBeenCalled()
  })

  it('exposes a refresh function that triggers a refetch', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-03T00:00:00.000Z')

    getDayCachedPageMock.mockReturnValue(null)
    fetchDetectionsRangePageMock.mockResolvedValue({ detections: [], total: 0 })

    const { result } = renderHook(
      () => useArchiveDetections(start, end, { queryMode: 'range' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchDetectionsRangePageMock.mockClear()
    await result.current.refresh()

    expect(fetchDetectionsRangePageMock).toHaveBeenCalledTimes(1)
  })
})
