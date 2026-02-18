import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DetectionsView from './DetectionsView'

const mocks = vi.hoisted(() => ({
  useDetections: vi.fn(),
  todayView: vi.fn(),
  archiveView: vi.fn(),
}))

vi.mock('./useDetections', () => ({
  useDetections: mocks.useDetections,
}))

vi.mock('./TodayView', () => ({
  default: (props: unknown) => {
    mocks.todayView(props)
    return <div data-testid="today-view" />
  },
}))

vi.mock('./ArchiveView', () => ({
  default: (props: unknown) => {
    mocks.archiveView(props)
    return <div data-testid="archive-view" />
  },
}))

describe('DetectionsView', () => {
  beforeEach(() => {
    mocks.useDetections.mockReturnValue({
      detections: [],
      isLoading: false,
      error: null,
      lastUpdated: null,
      cacheMode: 'live',
      refresh: vi.fn(),
    })
  })

  it('routes archive view to ArchiveView component', () => {
    const onSpeciesSelect = vi.fn()
    const onAttributionOpen = vi.fn()

    render(
      <DetectionsView
        view="archive"
        onAttributionOpen={onAttributionOpen}
        onSpeciesSelect={onSpeciesSelect}
      />,
    )

    expect(screen.getByTestId('archive-view')).toBeInTheDocument()
    expect(mocks.archiveView).toHaveBeenCalledWith(
      expect.objectContaining({
        onAttributionOpen,
        onSpeciesSelect,
      }),
    )
    expect(mocks.useDetections).not.toHaveBeenCalled()
  })

  it('routes today view to TodayView and forwards hook data', () => {
    const refresh = vi.fn()
    const onSpeciesSelect = vi.fn()
    const onAttributionOpen = vi.fn()

    mocks.useDetections.mockReturnValue({
      detections: [{ id: 'd1' }],
      isLoading: true,
      error: 'failed',
      lastUpdated: new Date('2026-02-18T12:00:00.000Z'),
      cacheMode: 'stale',
      refresh,
    })

    render(
      <DetectionsView
        view="today"
        onAttributionOpen={onAttributionOpen}
        onSpeciesSelect={onSpeciesSelect}
      />,
    )

    expect(screen.getByTestId('today-view')).toBeInTheDocument()
    expect(mocks.useDetections).toHaveBeenCalledTimes(1)
    expect(mocks.todayView).toHaveBeenCalledWith(
      expect.objectContaining({
        detections: [{ id: 'd1' }],
        isLoading: true,
        error: 'failed',
        cacheMode: 'stale',
        refresh,
        onAttributionOpen,
        onSpeciesSelect,
      }),
    )
  })
})
