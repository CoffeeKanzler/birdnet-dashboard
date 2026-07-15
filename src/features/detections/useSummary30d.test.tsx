import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSummary30d } from './useSummary30d'

const fetchSummary30dMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/summary', () => ({
  fetchSummary30d: (...args: unknown[]) => fetchSummary30dMock(...args),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const baseSummary = {
  generatedAt: '2026-01-01T00:00:00Z',
  windowStart: '2025-12-01T00:00:00Z',
  windowEnd: '2026-01-01T00:00:00Z',
  pending: false,
  stats: {
    totalDetections: 12,
    uniqueSpecies: 4,
    avgConfidence: 0.7,
    hourlyBins: Array.from({ length: 24 }, () => 0),
    topSpecies: [],
  },
  archive: { groups: [] },
}

describe('useSummary30d', () => {
  beforeEach(() => {
    fetchSummary30dMock.mockReset()
  })

  it('returns summary data once loaded', async () => {
    fetchSummary30dMock.mockResolvedValue(baseSummary)

    const { result } = renderHook(() => useSummary30d(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.summary?.stats.totalDetections).toBe(12)
    expect(result.current.isPending).toBe(false)
  })

  it('treats a pending backend response as still loading', async () => {
    fetchSummary30dMock.mockResolvedValue({ ...baseSummary, pending: true })

    const { result } = renderHook(() => useSummary30d(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.summary).not.toBeNull())

    expect(result.current.isPending).toBe(true)
    expect(result.current.isLoading).toBe(true)
  })

  it('surfaces a localized error message on failure', async () => {
    fetchSummary30dMock.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useSummary30d(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.summary).toBeNull()
  })

  it('exposes a refresh function that triggers a refetch', async () => {
    fetchSummary30dMock.mockResolvedValue(baseSummary)

    const { result } = renderHook(() => useSummary30d(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchSummary30dMock.mockClear()
    await result.current.refresh()

    expect(fetchSummary30dMock).toHaveBeenCalledTimes(1)
  })
})
