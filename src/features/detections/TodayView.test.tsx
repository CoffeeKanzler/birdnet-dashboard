import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import TodayView from './TodayView'

vi.mock('../../i18n', () => ({
  t: (key: string) => key,
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
})
