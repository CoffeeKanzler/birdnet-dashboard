import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithQuery } from '../../test/renderWithQuery'
import LandingView from './LandingView'

const mocks = vi.hoisted(() => ({
  useDetections: vi.fn(),
  useSpeciesPhoto: vi.fn(),
}))

vi.mock('../detections/useDetections', () => ({
  useDetections: mocks.useDetections,
}))

vi.mock('../detections/useSpeciesPhoto', () => ({
  useSpeciesPhoto: mocks.useSpeciesPhoto,
}))

vi.mock('../../i18n', () => ({
  t: (key: string) => key,
  getLocalizedCommonName: (commonName: string) => commonName,
}))

describe('LandingView', () => {
  beforeEach(() => {
    mocks.useDetections.mockReturnValue({
      detections: [],
      isLoading: false,
      error: null,
      cacheMode: 'live',
    })
    mocks.useSpeciesPhoto.mockReturnValue({
      photo: null,
      isLoading: false,
    })
  })

  it('shows skeleton cards while loading with no detections', () => {
    mocks.useDetections.mockReturnValue({
      detections: [],
      isLoading: true,
      error: null,
      cacheMode: 'live',
    })

    renderWithQuery(<LandingView />)
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows error state from detections hook', () => {
    mocks.useDetections.mockReturnValue({
      detections: [],
      isLoading: false,
      error: 'load failed',
      cacheMode: 'live',
    })

    renderWithQuery(<LandingView />)
    expect(screen.getByText('load failed')).toBeInTheDocument()
  })

  it('shows empty state when there are no detections', () => {
    renderWithQuery(<LandingView />)
    expect(screen.getByText('live.noDetections')).toBeInTheDocument()
  })

  it('calls species and attribution callbacks from live card', () => {
    const onSpeciesSelect = vi.fn()
    const onAttributionOpen = vi.fn()

    mocks.useDetections.mockReturnValue({
      detections: [
        {
          id: 'd1',
          commonName: 'Amsel',
          scientificName: 'Turdus merula',
          timestamp: '2026-02-18T11:55:00.000Z',
        },
      ],
      isLoading: false,
      error: null,
      cacheMode: 'live',
    })
    mocks.useSpeciesPhoto.mockReturnValue({
      photo: {
        url: 'https://example.test/amsel.jpg',
        sourceUrl: 'https://example.test/source',
        attribution: {
          author: 'Author',
          license: 'CC',
        },
      },
      isLoading: false,
    })

    renderWithQuery(
      <LandingView
        onAttributionOpen={onAttributionOpen}
        onSpeciesSelect={onSpeciesSelect}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Amsel/ }))
    expect(onSpeciesSelect).toHaveBeenCalledWith({
      commonName: 'Amsel',
      scientificName: 'Turdus merula',
    })

    fireEvent.click(screen.getByRole('button', { name: '©' }))
    expect(onAttributionOpen).toHaveBeenCalledTimes(1)
  })

  it('supports keyboard activation of a live highlight card', () => {
    const onSpeciesSelect = vi.fn()

    mocks.useDetections.mockReturnValue({
      detections: [
        {
          id: 'd1',
          commonName: 'Amsel',
          scientificName: 'Turdus merula',
          timestamp: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      cacheMode: 'live',
    })

    renderWithQuery(<LandingView onSpeciesSelect={onSpeciesSelect} />)

    const card = screen.getByRole('button', { name: /Amsel/ })
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onSpeciesSelect).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(card, { key: ' ' })
    expect(onSpeciesSelect).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(card, { key: 'a' })
    expect(onSpeciesSelect).toHaveBeenCalledTimes(2)
  })

  it('shows "unknown" status for an unparsable timestamp, and age-based labels otherwise', () => {
    mocks.useDetections.mockReturnValue({
      detections: [
        {
          id: 'd1',
          commonName: 'Garbage Timestamp Bird',
          scientificName: 'Bird garbage',
          timestamp: 'garbage',
        },
        {
          id: 'd2',
          commonName: 'Just Now Bird',
          scientificName: 'Bird now',
          timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
        },
        {
          id: 'd3',
          commonName: 'Half Hour Bird',
          scientificName: 'Bird half hour',
          timestamp: new Date(Date.now() - 30 * 60_000).toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      cacheMode: 'live',
    })

    renderWithQuery(<LandingView />)

    expect(screen.getByText('common.unknown')).toBeInTheDocument()
    expect(screen.getByText('live.statusLive')).toBeInTheDocument()
    expect(screen.getByText('live.statusMinutesAgo')).toBeInTheDocument()
  })

  it('deduplicates repeated species and caps the list at maxItems', () => {
    mocks.useDetections.mockReturnValue({
      detections: [
        { id: 'd1', commonName: 'Amsel', scientificName: 'Turdus merula', timestamp: new Date().toISOString() },
        { id: 'd2', commonName: 'Amsel', scientificName: 'Turdus merula', timestamp: new Date().toISOString() },
        { id: 'd3', commonName: 'Star', scientificName: 'Sturnus vulgaris', timestamp: new Date().toISOString() },
        { id: 'd4', commonName: 'Zilpzalp', scientificName: 'Phylloscopus collybita', timestamp: new Date().toISOString() },
        { id: 'd5', commonName: 'Kohlmeise', scientificName: 'Parus major', timestamp: new Date().toISOString() },
      ],
      isLoading: false,
      error: null,
      cacheMode: 'live',
    })

    renderWithQuery(<LandingView />)

    // jsdom's matchMedia stub always reports no match, so maxItems defaults to 3.
    expect(screen.getByText('Amsel')).toBeInTheDocument()
    expect(screen.getByText('Star')).toBeInTheDocument()
    expect(screen.getByText('Zilpzalp')).toBeInTheDocument()
    expect(screen.queryByText('Kohlmeise')).not.toBeInTheDocument()
  })

  it('reacts to matchMedia change events for responsive item counts', () => {
    const listeners: Record<string, (event: { matches: boolean }) => void> = {}
    const originalMatchMedia = window.matchMedia

    window.matchMedia = vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: (_event: string, handler: (event: { matches: boolean }) => void) => {
        listeners[query] = handler
      },
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia

    try {
      renderWithQuery(<LandingView />)

      expect(() => {
        act(() => {
          listeners['(min-width: 640px)']?.({ matches: true } as MediaQueryListEvent)
        })
      }).not.toThrow()
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })
})
