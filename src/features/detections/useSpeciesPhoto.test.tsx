import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSpeciesPhoto } from './useSpeciesPhoto'

const fetchSpeciesPhotoMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/birdImages', () => ({
  fetchSpeciesPhoto: (...args: unknown[]) => fetchSpeciesPhotoMock(...args),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useSpeciesPhoto', () => {
  beforeEach(() => {
    fetchSpeciesPhotoMock.mockReset()
  })

  it('fetches a photo when a name is provided', async () => {
    fetchSpeciesPhotoMock.mockResolvedValue({
      url: 'https://example.com/amsel.jpg',
      width: 640,
      height: 426,
      sourceUrl: 'https://example.com/amsel',
    })

    const { result } = renderHook(() => useSpeciesPhoto('Amsel', 'Turdus merula'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.photo?.url).toBe('https://example.com/amsel.jpg')
    expect(fetchSpeciesPhotoMock).toHaveBeenCalledWith(
      expect.objectContaining({ commonName: 'Amsel', scientificName: 'Turdus merula' }),
    )
  })

  it('does not fetch when both names are empty', () => {
    const { result } = renderHook(() => useSpeciesPhoto('   ', ''), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.photo).toBeNull()
    expect(fetchSpeciesPhotoMock).not.toHaveBeenCalled()
  })

  it('surfaces a localized error message once retries are exhausted', async () => {
    vi.useFakeTimers()
    try {
      fetchSpeciesPhotoMock.mockRejectedValue(new Error('lookup failed'))

      const { result } = renderHook(() => useSpeciesPhoto('Amsel', 'Turdus merula'), {
        wrapper: createWrapper(),
      })

      await vi.runAllTimersAsync()

      expect(result.current.error).not.toBeNull()
      expect(result.current.photo).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
