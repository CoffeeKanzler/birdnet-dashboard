import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithQuery } from '../../test/renderWithQuery'
import SpeciesDetailView from './SpeciesDetailView'

const mocks = vi.hoisted(() => ({
  useSpeciesDetections: vi.fn(),
  useSpeciesPhoto: vi.fn(),
  fetchSpeciesInfo: vi.fn(),
  fetchDetectionsPage: vi.fn(),
}))

vi.mock('./useSpeciesDetections', () => ({
  useSpeciesDetections: mocks.useSpeciesDetections,
}))

vi.mock('../detections/useSpeciesPhoto', () => ({
  useSpeciesPhoto: mocks.useSpeciesPhoto,
}))

vi.mock('../../api/birdnet', () => ({
  fetchSpeciesInfo: (...args: unknown[]) => mocks.fetchSpeciesInfo(...args),
  fetchDetectionsPage: (...args: unknown[]) => mocks.fetchDetectionsPage(...args),
}))

vi.mock('../../i18n', () => ({
  t: (key: string) => key,
  getSpeciesData: () => ({ description: '' }),
}))

describe('SpeciesDetailView', () => {
  beforeEach(() => {
    mocks.useSpeciesDetections.mockReturnValue({
      detections: [],
      isLoading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
    })
    mocks.useSpeciesPhoto.mockReturnValue({
      photo: null,
      isLoading: false,
    })
    mocks.fetchSpeciesInfo.mockResolvedValue({
      rarityStatus: 'common',
    })
    mocks.fetchDetectionsPage.mockResolvedValue([])
  })

  it('shows loading state for species detections', () => {
    mocks.useSpeciesDetections.mockReturnValue({
      detections: [],
      isLoading: true,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
    })

    renderWithQuery(
      <SpeciesDetailView
        commonName="Amsel"
        scientificName="Turdus merula"
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('species.detectionsLoading')).toBeInTheDocument()
  })

  it('shows error state when detections hook returns an error', () => {
    mocks.useSpeciesDetections.mockReturnValue({
      detections: [],
      isLoading: false,
      error: 'load failed',
      refresh: vi.fn().mockResolvedValue(undefined),
    })

    renderWithQuery(
      <SpeciesDetailView
        commonName="Amsel"
        scientificName="Turdus merula"
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('load failed')).toBeInTheDocument()
  })

  it('shows empty state when no detections exist', () => {
    renderWithQuery(
      <SpeciesDetailView
        commonName="Amsel"
        scientificName="Turdus merula"
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('species.detectionsEmpty')).toBeInTheDocument()
  })

  it('calls onBack and onAttributionOpen callbacks', () => {
    const onBack = vi.fn()
    const onAttributionOpen = vi.fn()
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
      <SpeciesDetailView
        commonName="Amsel"
        scientificName="Turdus merula"
        onAttributionOpen={onAttributionOpen}
        onBack={onBack}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'common.back' }))
    expect(onBack).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '©' }))
    expect(onAttributionOpen).toHaveBeenCalledTimes(1)
  })
})
