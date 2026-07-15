import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import TodayView from './TodayView'

vi.mock('../../i18n', () => ({
  t: (key: string) => key,
  getLocalizedCommonName: (commonName: string) => commonName,
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

const baseProps = {
  detections: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  cacheMode: 'live' as const,
  refresh: vi.fn().mockResolvedValue(undefined),
  scrollContainerRef: createRef<HTMLDivElement>(),
}

describe('TodayView', () => {
  it('shows loading state', () => {
    render(<TodayView {...baseProps} isLoading />)
    expect(screen.getByText('today.loading')).toBeInTheDocument()
  })

  it('shows error state', () => {
    render(<TodayView {...baseProps} error="boom" />)
    expect(screen.getAllByText('boom').length).toBeGreaterThan(0)
  })

  it('shows empty states when no detections exist today', () => {
    render(<TodayView {...baseProps} />)
    expect(screen.getByText('today.noDetectionsToday')).toBeInTheDocument()
    expect(screen.getByText('today.noDetectionsList')).toBeInTheDocument()
  })

  it('calls refresh and species selection callbacks', () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    const onSpeciesSelect = vi.fn()

    render(
      <TodayView
        {...baseProps}
        detections={[
          {
            id: 'd1',
            commonName: 'Amsel',
            scientificName: 'Turdus merula',
            confidence: 0.91,
            timestamp: new Date().toISOString(),
          },
        ]}
        onSpeciesSelect={onSpeciesSelect}
        refresh={refresh}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }))
    expect(refresh).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Amsel' }))
    expect(onSpeciesSelect).toHaveBeenCalledWith({
      commonName: 'Amsel',
      scientificName: 'Turdus merula',
    })
  })

  it('filters detections by confidence', () => {
    const detections = [
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
    ]

    render(<TodayView {...baseProps} detections={detections} />)

    // Both should be visible initially (minConfidence 0)
    // Note: they appear twice (once in groups, once in list)
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

  it('shows the formatted last-updated timestamp when available', () => {
    render(<TodayView {...baseProps} lastUpdated={new Date('2026-03-14T12:00:00.000Z')} />)
    expect(screen.getByText(/today.lastUpdated/)).toBeInTheDocument()
  })

  it('renders confidence tiers and handles missing or invalid timestamps in the list', () => {
    const detections = [
      {
        id: 'd1',
        commonName: 'Medium Confidence Bird',
        scientificName: 'Bird medium',
        confidence: 0.6,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'd2',
        commonName: 'NaN Confidence Bird',
        scientificName: 'Bird nan',
        confidence: Number.NaN,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'd3',
        commonName: 'No Timestamp Bird',
        scientificName: 'Bird none',
        confidence: 0.7,
        timestamp: '',
      },
      {
        id: 'd4',
        commonName: 'Garbage Timestamp Bird',
        scientificName: 'Bird garbage',
        confidence: 0.7,
        timestamp: 'garbage',
      },
    ]

    render(<TodayView {...baseProps} detections={detections} />)

    expect(screen.getByText('0 %')).toBeInTheDocument()
    expect(screen.getByText('common.unknownTime')).toBeInTheDocument()
    expect(screen.getByText('garbage')).toBeInTheDocument()
  })

  it('filters today\'s grouped species by name, merging repeats and breaking count ties', () => {
    const today = new Date()

    const detections = [
      {
        id: 'a1',
        commonName: 'Amsel',
        scientificName: 'Turdus merula',
        confidence: 0.9,
        timestamp: today.toISOString(),
      },
      {
        id: 'a2',
        commonName: 'Amsel',
        scientificName: 'Turdus merula',
        confidence: 0.85,
        timestamp: today.toISOString(),
      },
      {
        id: 'b1',
        commonName: 'Star',
        scientificName: 'Sturnus vulgaris',
        confidence: 0.9,
        timestamp: today.toISOString(),
      },
      {
        id: 'c1',
        commonName: 'Zilpzalp',
        scientificName: 'Phylloscopus collybita',
        confidence: 0.9,
        timestamp: today.toISOString(),
      },
    ]

    render(<TodayView {...baseProps} detections={detections} />)

    expect(screen.getByRole('button', { name: 'Amsel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Star' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zilpzalp' })).toBeInTheDocument()

    const filterInput = screen.getByPlaceholderText('today.filterPlaceholder')
    fireEvent.change(filterInput, { target: { value: 'amsel' } })

    expect(screen.getByRole('button', { name: 'Amsel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Star' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zilpzalp' })).not.toBeInTheDocument()
  })
})
