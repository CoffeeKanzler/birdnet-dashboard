import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithQuery } from '../../test/renderWithQuery'
import RarityView from './RarityView'

const mocks = vi.hoisted(() => ({
  useArchiveDetections: vi.fn(),
  useSummary30d: vi.fn(),
  matchNotableSpecies: vi.fn(),
}))

vi.mock('../detections/useArchiveDetections', () => ({
  useArchiveDetections: mocks.useArchiveDetections,
}))

vi.mock('../detections/useSummary30d', () => ({
  useSummary30d: mocks.useSummary30d,
}))

vi.mock('./useNotableSpotlight', () => ({
  matchNotableSpecies: mocks.matchNotableSpecies,
}))

vi.mock('../../data/notableSpecies', () => ({
  notableSpecies: [
    {
      commonName: 'Amsel',
      scientificName: 'Turdus merula',
      aliases: [],
      description: 'Mock notable species',
    },
  ],
}))

vi.mock('../detections/components/RangeLoadingPanel', () => ({
  default: (props: { title: string; subtitle: string }) => (
    <div>{`loading-panel:${props.title}:${props.subtitle}`}</div>
  ),
}))

vi.mock('../detections/components/SpeciesCard', () => ({
  default: (props: {
    commonName: string
    scientificName: string
    onSelect?: (species: { commonName: string; scientificName: string }) => void
  }) => (
    <button
      onClick={() => {
        props.onSelect?.({
          commonName: props.commonName,
          scientificName: props.scientificName,
        })
      }}
      type="button"
    >
      {props.commonName}
    </button>
  ),
}))

vi.mock('../../i18n', () => ({
  t: (key: string) => key,
}))

describe('RarityView', () => {
  beforeEach(() => {
    mocks.useSummary30d.mockReturnValue({
      summary: null,
      isLoading: false,
      isPending: false,
      error: null,
    })
    mocks.useArchiveDetections.mockReturnValue({
      detections: [],
      isLoading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
    })
    mocks.matchNotableSpecies.mockReturnValue([])
  })

  it('shows loading panel while rarity range is loading', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: null,
      isLoading: true,
      isPending: false,
      error: null,
    })

    renderWithQuery(<RarityView />)
    expect(
      screen.getByText('loading-panel:rarity.loadingDetections:rarity.periodDescription'),
    ).toBeInTheDocument()
  })

  it('shows error state and retries via refresh callback', () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    mocks.useSummary30d.mockReturnValue({
      summary: null,
      isLoading: false,
      isPending: false,
      error: 'summary failed',
    })
    mocks.useArchiveDetections.mockReturnValue({
      detections: [],
      isLoading: false,
      error: null,
      refresh,
    })

    renderWithQuery(<RarityView />)
    expect(screen.getByText('rarity.rangeError')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows empty highlights state when no notable matches exist', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: {
        pending: false,
        archive: { groups: [] },
      },
      isLoading: false,
      isPending: false,
      error: null,
    })

    renderWithQuery(<RarityView />)
    expect(screen.getByText('rarity.noHighlights')).toBeInTheDocument()
  })

  it('calls onSpeciesSelect when clicking a notable species card', () => {
    const onSpeciesSelect = vi.fn()
    mocks.useSummary30d.mockReturnValue({
      summary: {
        pending: false,
        archive: {
          groups: [
            {
              commonName: 'Amsel',
              scientificName: 'Turdus merula',
              count: 2,
              lastSeenAt: '2026-02-18T11:00:00.000Z',
            },
          ],
        },
      },
      isLoading: false,
      isPending: false,
      error: null,
    })

    renderWithQuery(<RarityView onSpeciesSelect={onSpeciesSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Amsel' }))
    expect(onSpeciesSelect).toHaveBeenCalledWith({
      commonName: 'Amsel',
      scientificName: 'Turdus merula',
    })
  })
})
