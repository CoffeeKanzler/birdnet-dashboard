import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithQuery } from '../../test/renderWithQuery'
import ArchiveView from './ArchiveView'

const mocks = vi.hoisted(() => ({
  useArchiveDetections: vi.fn(),
  useSummary30d: vi.fn(),
}))

vi.mock('./useArchiveDetections', () => ({
  useArchiveDetections: mocks.useArchiveDetections,
}))

vi.mock('./useSummary30d', () => ({
  useSummary30d: mocks.useSummary30d,
}))

vi.mock('./components/RangeLoadingPanel', () => ({
  default: (props: { title: string; subtitle: string }) => (
    <div>{`loading-panel:${props.title}:${props.subtitle}`}</div>
  ),
}))

vi.mock('./components/SpeciesCard', () => ({
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

describe('ArchiveView', () => {
  beforeEach(() => {
    mocks.useArchiveDetections.mockReturnValue({
      detections: [],
      isLoading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
    })
    mocks.useSummary30d.mockReturnValue({
      summary: null,
      isLoading: false,
      isPending: false,
      error: null,
    })
  })

  it('shows loading panel while range is loading', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: null,
      isLoading: true,
      isPending: false,
      error: null,
    })

    renderWithQuery(<ArchiveView />)
    expect(
      screen.getByText('loading-panel:rarity.loadingDetections:archive.description'),
    ).toBeInTheDocument()
  })

  it('shows error and retries through refresh callback', () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    mocks.useArchiveDetections.mockReturnValue({
      detections: [],
      isLoading: false,
      error: null,
      refresh,
    })
    mocks.useSummary30d.mockReturnValue({
      summary: null,
      isLoading: false,
      isPending: false,
      error: 'summary failed',
    })

    renderWithQuery(<ArchiveView />)
    expect(screen.getByText('summary failed')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows empty range state with no detections', () => {
    renderWithQuery(<ArchiveView />)
    expect(screen.getByText('archive.noDetectionsRange')).toBeInTheDocument()
  })

  it('calls onSpeciesSelect when clicking grouped species card', () => {
    const onSpeciesSelect = vi.fn()
    mocks.useSummary30d.mockReturnValue({
      summary: {
        pending: false,
        stats: {
          totalDetections: 1,
          uniqueSpecies: 1,
          avgConfidence: 80,
          hourlyBins: Array.from({ length: 24 }, () => 0),
          topSpecies: [],
        },
        archive: {
          groups: [
            {
              commonName: 'Amsel',
              scientificName: 'Turdus merula',
              count: 1,
            },
          ],
        },
      },
      isLoading: false,
      isPending: false,
      error: null,
    })

    renderWithQuery(<ArchiveView onSpeciesSelect={onSpeciesSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Amsel' }))
    expect(onSpeciesSelect).toHaveBeenCalledWith({
      commonName: 'Amsel',
      scientificName: 'Turdus merula',
    })
  })
})
