import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSpeciesDetections } from './useSpeciesDetections'

const fetchSpeciesDetectionsPageMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/birdnet', () => ({
  fetchSpeciesDetectionsPage: (...args: unknown[]) => fetchSpeciesDetectionsPageMock(...args),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const makeDetection = (commonName: string, scientificName: string, id: string) => ({
  id,
  commonName,
  scientificName,
  confidence: 0.8,
  timestamp: '2026-01-01T00:00:00Z',
})

describe('useSpeciesDetections', () => {
  beforeEach(() => {
    fetchSpeciesDetectionsPageMock.mockReset()
  })

  it('filters the fetched page to detections matching the selected scientific name', async () => {
    fetchSpeciesDetectionsPageMock.mockResolvedValue({
      detections: [
        makeDetection('Amsel', 'Turdus merula', 'a'),
        makeDetection('Kohlmeise', 'Parus major', 'b'),
      ],
    })

    const { result } = renderHook(() => useSpeciesDetections('Amsel', 'Turdus merula'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.detections.map((d) => d.id)).toEqual(['a'])
    expect(result.current.hasMore).toBe(false)
    expect(result.current.isLoadingMore).toBe(false)
  })

  it('matches accent-insensitive common names when the scientific name is a placeholder', async () => {
    fetchSpeciesDetectionsPageMock.mockResolvedValue({
      detections: [
        makeDetection('Ámsel', 'Unbekannte Art', 'a'),
        makeDetection('Star', 'Sturnus vulgaris', 'b'),
      ],
    })

    const { result } = renderHook(() => useSpeciesDetections('Amsel', 'unbekannte art'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.detections.map((d) => d.id)).toEqual(['a'])
  })

  it('does not fetch when both names are empty', () => {
    const { result } = renderHook(() => useSpeciesDetections('', ''), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.detections).toEqual([])
    expect(fetchSpeciesDetectionsPageMock).not.toHaveBeenCalled()
  })

  it('surfaces a localized error message on failure', async () => {
    fetchSpeciesDetectionsPageMock.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useSpeciesDetections('Amsel', 'Turdus merula'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.detections).toEqual([])
  })

  it('exposes refresh and a no-op loadMore', async () => {
    fetchSpeciesDetectionsPageMock.mockResolvedValue({ detections: [] })

    const { result } = renderHook(() => useSpeciesDetections('Amsel', 'Turdus merula'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchSpeciesDetectionsPageMock.mockClear()
    await result.current.refresh()
    expect(fetchSpeciesDetectionsPageMock).toHaveBeenCalledTimes(1)

    await expect(result.current.loadMore()).resolves.toBeUndefined()
  })
})
