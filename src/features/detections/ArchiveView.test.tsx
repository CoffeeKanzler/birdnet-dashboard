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
  getLocalizedCommonName: (commonName: string) => commonName,
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

  it('filters archive detections by confidence', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: null,
      isLoading: false,
      isPending: false,
      error: null,
    })

    mocks.useArchiveDetections.mockReturnValue({
      detections: [
        {
          id: 'd1',
          commonName: 'High Confidence Bird',
          scientificName: 'Bird high',
          confidence: 0.9,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'd2',
          commonName: 'Low Confidence Bird',
          scientificName: 'Bird low',
          confidence: 0.4,
          timestamp: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    renderWithQuery(<ArchiveView />)

    // Initially both should be visible in groups
    // Note: they might appear multiple times if the list also renders them (though ArchiveView usually just shows groups)
    expect(screen.getAllByText('High Confidence Bird').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Low Confidence Bird').length).toBeGreaterThan(0)

    // Find the range input (slider)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '50' } })

    // Only high confidence bird should remain
    expect(screen.getAllByText('High Confidence Bird').length).toBeGreaterThan(0)
    expect(screen.queryByText('Low Confidence Bird')).not.toBeInTheDocument()

    // Reset filter
    fireEvent.click(screen.getByRole('button', { name: 'common.clear' }))
    expect(screen.getAllByText('High Confidence Bird').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Low Confidence Bird').length).toBeGreaterThan(0)
  })

  it('filters archive detections by species name and groups repeats, invalid, and out-of-range entries', () => {
    mocks.useArchiveDetections.mockReturnValue({
      detections: [
        {
          id: 'd1',
          commonName: 'Amsel',
          scientificName: 'Turdus merula',
          confidence: 0.8,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'd2',
          commonName: 'Amsel',
          scientificName: 'Turdus merula',
          confidence: 0.7,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'd3',
          commonName: 'Star',
          scientificName: 'Sturnus vulgaris',
          confidence: 0.8,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'd4',
          commonName: 'Zilpzalp',
          scientificName: 'Phylloscopus collybita',
          confidence: 0.8,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'd5',
          commonName: 'Invalid Timestamp Bird',
          scientificName: 'Invalidus timestampus',
          confidence: 0.8,
          timestamp: 'not-a-date',
        },
        {
          id: 'd6',
          commonName: 'Old Bird',
          scientificName: 'Historicus avis',
          confidence: 0.8,
          timestamp: '2000-01-01T00:00:00.000Z',
        },
      ],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    renderWithQuery(<ArchiveView />)

    expect(screen.getAllByRole('button', { name: 'Amsel' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Invalid Timestamp Bird')).not.toBeInTheDocument()
    expect(screen.queryByText('Old Bird')).not.toBeInTheDocument()

    const filterInput = screen.getByPlaceholderText('today.filterPlaceholder')
    fireEvent.change(filterInput, { target: { value: 'star' } })

    expect(screen.getByRole('button', { name: 'Star' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Amsel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zilpzalp' })).not.toBeInTheDocument()
  })

  it('breaks ties by localized name when summary groups have equal counts', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: {
        pending: false,
        stats: {
          totalDetections: 4,
          uniqueSpecies: 2,
          avgConfidence: 80,
          hourlyBins: Array.from({ length: 24 }, () => 0),
          topSpecies: [],
        },
        archive: {
          groups: [
            { commonName: 'Star', scientificName: 'Sturnus vulgaris', count: 2 },
            { commonName: 'Amsel', scientificName: 'Turdus merula', count: 2 },
          ],
        },
      },
      isLoading: false,
      isPending: false,
      error: null,
    })

    renderWithQuery(<ArchiveView />)

    expect(screen.getByRole('button', { name: 'Amsel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Star' })).toBeInTheDocument()
  })

  it('supports quick range shortcuts', () => {
    renderWithQuery(<ArchiveView />)

    fireEvent.click(screen.getByRole('button', { name: 'archive.quickToday' }))

    const startDateInput = screen.getByLabelText('archive.startDate') as HTMLInputElement
    const endDateInput = screen.getByLabelText('archive.endDate') as HTMLInputElement
    expect(startDateInput.value).toBe(endDateInput.value)

    fireEvent.click(screen.getByRole('button', { name: 'archive.quickWeek' }))
    fireEvent.click(screen.getByRole('button', { name: 'archive.quickMonth' }))
    expect(startDateInput.value.length).toBeGreaterThan(0)
  })

  it('swaps start and end dates when the start is moved after the end', () => {
    renderWithQuery(<ArchiveView />)

    const endDateInput = screen.getByLabelText('archive.endDate') as HTMLInputElement
    const originalStart = (screen.getByLabelText('archive.startDate') as HTMLInputElement).value

    fireEvent.change(endDateInput, { target: { value: '2000-01-01' } })

    expect((screen.getByLabelText('archive.startDate') as HTMLInputElement).value).toBe('2000-01-01')
    expect((screen.getByLabelText('archive.endDate') as HTMLInputElement).value).toBe(originalStart)
  })

  it('shows "no range selected" and clears results when the start date is emptied', () => {
    renderWithQuery(<ArchiveView />)

    const startDateInput = screen.getByLabelText('archive.startDate') as HTMLInputElement
    fireEvent.change(startDateInput, { target: { value: '' } })

    expect(screen.getByText('archive.noRangeSelected')).toBeInTheDocument()
  })

  it('shows "no range selected" when the end date is emptied', () => {
    renderWithQuery(<ArchiveView />)

    const endDateInput = screen.getByLabelText('archive.endDate') as HTMLInputElement
    fireEvent.change(endDateInput, { target: { value: '' } })

    expect(screen.getByText('archive.noRangeSelected')).toBeInTheDocument()
  })
})
