import { fireEvent, screen } from '@testing-library/react'
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
})
