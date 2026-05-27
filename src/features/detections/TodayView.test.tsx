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
})
