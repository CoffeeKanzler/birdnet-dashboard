import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDetections } from './useDetections'

const fetchDetectionsWithMetaMock = vi.hoisted(() => vi.fn())
const fetchDetectionsPageWithMetaMock = vi.hoisted(() => vi.fn())
const fetchRecentDetectionsWithMetaMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/birdnet', () => ({
  fetchDetectionsWithMeta: (...args: unknown[]) => fetchDetectionsWithMetaMock(...args),
  fetchDetectionsPageWithMeta: (...args: unknown[]) => fetchDetectionsPageWithMetaMock(...args),
  fetchRecentDetectionsWithMeta: (...args: unknown[]) => fetchRecentDetectionsWithMetaMock(...args),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useDetections', () => {
  beforeEach(() => {
    fetchDetectionsWithMetaMock.mockReset()
    fetchDetectionsPageWithMetaMock.mockReset()
    fetchRecentDetectionsWithMetaMock.mockReset()
  })

  it('defaults to the "today" fetch path', async () => {
    fetchDetectionsWithMetaMock.mockResolvedValue({
      detections: [
        { id: '1', commonName: 'Amsel', scientificName: 'Turdus merula', confidence: 0.9, timestamp: '2026-01-01T00:00:00Z' },
      ],
      cacheMode: 'live',
    })

    const { result } = renderHook(() => useDetections(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.detections).toHaveLength(1)
    expect(result.current.cacheMode).toBe('live')
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
    expect(fetchDetectionsWithMetaMock).toHaveBeenCalledTimes(1)
    expect(fetchDetectionsPageWithMetaMock).not.toHaveBeenCalled()
    expect(fetchRecentDetectionsWithMetaMock).not.toHaveBeenCalled()
  })

  it('uses the "recent" fetch path when recentOnly is set', async () => {
    fetchRecentDetectionsWithMetaMock.mockResolvedValue({ detections: [], cacheMode: 'stale' })

    const { result } = renderHook(() => useDetections({ recentOnly: true, limit: 5 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchRecentDetectionsWithMetaMock).toHaveBeenCalledWith({ limit: 5, signal: expect.any(AbortSignal) })
    expect(result.current.cacheMode).toBe('stale')
  })

  it('uses the "page" fetch path when pageOnly is set', async () => {
    fetchDetectionsPageWithMetaMock.mockResolvedValue({ detections: [], cacheMode: 'unknown' })

    const { result } = renderHook(() => useDetections({ pageOnly: true, limit: 20 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchDetectionsPageWithMetaMock).toHaveBeenCalledWith({ limit: 20, signal: expect.any(AbortSignal) })
  })

  it('surfaces a localized error message and defaults on fetch failure', async () => {
    fetchDetectionsWithMetaMock.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useDetections(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.error).not.toBeNull())

    expect(result.current.detections).toEqual([])
    expect(result.current.cacheMode).toBe('unknown')
  })

  it('exposes a refresh function that triggers a refetch', async () => {
    fetchDetectionsWithMetaMock.mockResolvedValue({ detections: [], cacheMode: 'live' })

    const { result } = renderHook(() => useDetections(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchDetectionsWithMetaMock.mockClear()
    await result.current.refresh()

    expect(fetchDetectionsWithMetaMock).toHaveBeenCalledTimes(1)
  })
})
