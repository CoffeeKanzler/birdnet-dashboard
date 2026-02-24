import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithQuery } from '../../test/renderWithQuery'
import SpeciesDetailView from './SpeciesDetailView'

const mocks = vi.hoisted(() => ({
  useSpeciesDetections: vi.fn(),
  useSpeciesPhoto: vi.fn(),
  fetchSpeciesInfo: vi.fn(),
  fetchFamilyMatches: vi.fn(),
}))

vi.mock('./useSpeciesDetections', () => ({
  useSpeciesDetections: mocks.useSpeciesDetections,
}))

vi.mock('../detections/useSpeciesPhoto', () => ({
  useSpeciesPhoto: mocks.useSpeciesPhoto,
}))

vi.mock('../../api/birdnet', () => ({
  fetchSpeciesInfo: (...args: unknown[]) => mocks.fetchSpeciesInfo(...args),
  fetchFamilyMatches: (...args: unknown[]) => mocks.fetchFamilyMatches(...args),
}))

vi.mock('../../i18n', () => ({
  t: (key: string) => key,
  getSpeciesData: () => ({ description: '' }),
  getLocalizedCommonName: (commonName: string) => commonName,
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
    mocks.fetchFamilyMatches.mockResolvedValue([])
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

  it('renders family matches and selects a related species', async () => {
    const onSpeciesSelect = vi.fn()

    mocks.fetchSpeciesInfo.mockResolvedValue({
      rarityStatus: 'common',
      familyCommon: 'Drosseln',
    })
    mocks.fetchFamilyMatches.mockResolvedValue([
      {
        commonName: 'Wacholderdrossel',
        scientificName: 'Turdus pilaris',
      },
    ])

    renderWithQuery(
      <SpeciesDetailView
        commonName="Amsel"
        scientificName="Turdus merula"
        onBack={vi.fn()}
        onSpeciesSelect={onSpeciesSelect}
      />,
    )

    const relatedButton = await screen.findByRole('button', {
      name: 'Wacholderdrossel',
    })

    fireEvent.click(relatedButton)
    expect(onSpeciesSelect).toHaveBeenCalledWith({
      commonName: 'Wacholderdrossel',
      scientificName: 'Turdus pilaris',
    })
  })

  it('shows family error when family matching fetch fails', async () => {
    mocks.fetchSpeciesInfo.mockResolvedValue({
      rarityStatus: 'common',
      familyCommon: 'Drosseln',
    })
    mocks.fetchFamilyMatches.mockRejectedValue(new Error('network down'))

    renderWithQuery(
      <SpeciesDetailView
        commonName="Amsel"
        scientificName="Turdus merula"
        onBack={vi.fn()}
      />,
    )

    await expect(screen.findByText('error.familyLoad')).resolves.toBeInTheDocument()
  })

  it('renders detections table details and triggers refresh', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    mocks.useSpeciesDetections.mockReturnValue({
      detections: [
        {
          id: '1',
          commonName: 'Amsel',
          scientificName: 'Turdus merula',
          timestamp: '2026-02-18T10:22:00.000Z',
          confidence: 0.92,
        },
        {
          id: '2',
          commonName: 'Amsel',
          scientificName: 'Turdus merula',
          timestamp: 'not-a-date',
          confidence: Number.NaN,
        },
      ],
      isLoading: false,
      error: null,
      refresh,
    })

    renderWithQuery(
      <SpeciesDetailView
        commonName="Amsel"
        scientificName="Turdus merula"
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('species.detectionsLabel')).toBeInTheDocument()
    expect(screen.getByText('92 %')).toBeInTheDocument()
    expect(screen.getByText('0 %')).toBeInTheDocument()
    expect(screen.getByText('not-a-date')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })
})
