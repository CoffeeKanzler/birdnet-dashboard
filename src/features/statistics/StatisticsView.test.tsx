import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Detection } from '../../api/birdnet'
import type { Summary30d } from '../../api/summary'
import { renderWithQuery } from '../../test/renderWithQuery'
import StatisticsView from './StatisticsView'

const mocks = vi.hoisted(() => ({
  useArchiveDetections: vi.fn(),
  useSummary30d: vi.fn(),
}))

vi.mock('../detections/useArchiveDetections', () => ({
  useArchiveDetections: mocks.useArchiveDetections,
}))
vi.mock('../detections/useSummary30d', () => ({
  useSummary30d: mocks.useSummary30d,
}))

const DEFAULT_STATE = {
  detections: [] as Detection[],
  isLoading: false,
  error: null,
  refresh: vi.fn(),
}

const DEFAULT_SUMMARY: Summary30d = {
  generatedAt: '2026-02-17T00:00:00.000Z',
  windowStart: '2026-01-19',
  windowEnd: '2026-02-17',
  stats: {
    totalDetections: 0,
    uniqueSpecies: 0,
    avgConfidence: 0,
    hourlyBins: Array.from({ length: 24 }, () => 0),
    topSpecies: [],
  },
  archive: {
    groups: [],
  },
}

describe('StatisticsView', () => {
  beforeEach(() => {
    mocks.useArchiveDetections.mockReturnValue(DEFAULT_STATE)
    mocks.useSummary30d.mockReturnValue({
      summary: DEFAULT_SUMMARY,
      isLoading: false,
      isPending: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  it('renders section heading', () => {
    renderWithQuery(<StatisticsView />)
    expect(screen.getByRole('heading', { name: 'Statistiken' })).toBeInTheDocument()
  })

  it('renders stat card labels', () => {
    renderWithQuery(<StatisticsView />)
    expect(screen.getByText('Erkennungen gesamt')).toBeInTheDocument()
    expect(screen.getByText('Verschiedene Arten')).toBeInTheDocument()
    expect(screen.getByText('Ø Sicherheit')).toBeInTheDocument()
  })

  it('displays avg confidence as percentage', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: {
        ...DEFAULT_SUMMARY,
        stats: {
          ...DEFAULT_SUMMARY.stats,
          avgConfidence: 70,
        },
      },
      isLoading: false,
      isPending: false,
      error: null,
      refresh: vi.fn(),
    })
    renderWithQuery(<StatisticsView />)
    expect(screen.getByText('70 %')).toBeInTheDocument()
  })

  it('shows top species in descending order by detection count', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: {
        ...DEFAULT_SUMMARY,
        stats: {
          ...DEFAULT_SUMMARY.stats,
          topSpecies: [
            { commonName: 'Amsel', scientificName: 'Turdus merula', count: 2 },
            { commonName: 'Buchfink', scientificName: 'Fringilla coelebs', count: 1 },
          ],
        },
      },
      isLoading: false,
      isPending: false,
      error: null,
      refresh: vi.fn(),
    })
    renderWithQuery(<StatisticsView />)

    const amselBtn = screen.getByRole('button', { name: /Amsel/ })
    const buchfinkBtn = screen.getByRole('button', { name: /Buchfink/ })
    // Amsel (2 detections) comes before Buchfink (1 detection)
    expect(
      amselBtn.compareDocumentPosition(buchfinkBtn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('limits top species list to 10 entries', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: {
        ...DEFAULT_SUMMARY,
        stats: {
          ...DEFAULT_SUMMARY.stats,
          topSpecies: Array.from({ length: 15 }, (_, i) => ({
            commonName: `Art ${i}`,
            scientificName: `Species ${i}`,
            count: i + 1,
          })),
        },
      },
      isLoading: false,
      isPending: false,
      error: null,
      refresh: vi.fn(),
    })
    renderWithQuery(<StatisticsView />)

    // Each species has its own button; there should be at most 10
    const allButtons = screen.getAllByRole('button')
    const speciesButtons = allButtons.filter((b) => /Art \d/.test(b.textContent ?? ''))
    expect(speciesButtons.length).toBeLessThanOrEqual(10)
  })

  it('shows loading skeleton when loading with no detections yet', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: null,
      isLoading: true,
      isPending: false,
      error: null,
      refresh: vi.fn(),
    })
    renderWithQuery(<StatisticsView />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows error message when error is set', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: null,
      isLoading: false,
      isPending: false,
      error: 'Fehler beim Laden',
      refresh: vi.fn(),
    })
    mocks.useArchiveDetections.mockReturnValue({
      ...DEFAULT_STATE,
      error: 'Fehler beim Laden',
    })
    renderWithQuery(<StatisticsView />)
    expect(screen.getByText('Fehler beim Laden')).toBeInTheDocument()
  })

  it('calls onSpeciesSelect when clicking a species row', () => {
    const onSpeciesSelect = vi.fn()
    mocks.useSummary30d.mockReturnValue({
      summary: {
        ...DEFAULT_SUMMARY,
        stats: {
          ...DEFAULT_SUMMARY.stats,
          topSpecies: [{ commonName: 'Amsel', scientificName: 'Turdus merula', count: 1 }],
        },
      },
      isLoading: false,
      isPending: false,
      error: null,
      refresh: vi.fn(),
    })
    renderWithQuery(<StatisticsView onSpeciesSelect={onSpeciesSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /Amsel/ }))
    expect(onSpeciesSelect).toHaveBeenCalledWith({
      commonName: 'Amsel',
      scientificName: 'Turdus merula',
    })
  })

  it('shows no-data message when detections are empty and not loading', () => {
    renderWithQuery(<StatisticsView />)
    expect(screen.getByText('Keine Erkennungen verfuegbar.')).toBeInTheDocument()
  })

  it('shows hourly activity x-axis labels', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: {
        ...DEFAULT_SUMMARY,
        stats: {
          ...DEFAULT_SUMMARY.stats,
          hourlyBins: Array.from({ length: 24 }, (_, i) => (i === 8 ? 1 : 0)),
        },
      },
      isLoading: false,
      isPending: false,
      error: null,
      refresh: vi.fn(),
    })
    renderWithQuery(<StatisticsView />)

    expect(screen.getByText('0h')).toBeInTheDocument()
    expect(screen.getByText('6h')).toBeInTheDocument()
    expect(screen.getByText('12h')).toBeInTheDocument()
    expect(screen.getByText('18h')).toBeInTheDocument()
    expect(screen.getByText('23h')).toBeInTheDocument()
  })

  it('shows sample note when total detections are available', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: {
        ...DEFAULT_SUMMARY,
        stats: {
          ...DEFAULT_SUMMARY.stats,
          totalDetections: 500000,
        },
      },
      isLoading: false,
      isPending: false,
      error: null,
      refresh: vi.fn(),
    })
    renderWithQuery(<StatisticsView />)
    expect(
      screen.getByText('Basiert auf 500,000 insgesamt verarbeiteten Erkennungen.'),
    ).toBeInTheDocument()
  })

  it('renders skeleton blocks for cards/lists/charts while fallback is loading and summary exists', () => {
    mocks.useArchiveDetections.mockReturnValue({
      ...DEFAULT_STATE,
      isLoading: true,
    })
    renderWithQuery(<StatisticsView />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(9)
  })

  it('computes statistics from fallback detections when summary endpoint fails', () => {
    mocks.useSummary30d.mockReturnValue({
      summary: null,
      isLoading: false,
      isPending: false,
      error: 'summary unavailable',
      refresh: vi.fn(),
    })
    mocks.useArchiveDetections.mockReturnValue({
      ...DEFAULT_STATE,
      detections: [
        {
          id: '1',
          timestamp: '2026-02-16T06:00:00.000Z',
          commonName: 'Amsel',
          scientificName: 'Turdus merula',
          confidence: 0.5,
          thumbnailUrl: null,
          imageUrl: null,
        },
        {
          id: '2',
          timestamp: '2026-02-16T06:20:00.000Z',
          commonName: 'Amsel',
          scientificName: 'Turdus merula',
          confidence: 0.8,
          thumbnailUrl: null,
          imageUrl: null,
        },
        {
          id: '3',
          timestamp: 'invalid-timestamp',
          commonName: 'Buchfink',
          scientificName: 'Fringilla coelebs',
          confidence: 0.9,
          thumbnailUrl: null,
          imageUrl: null,
        },
      ],
      error: null,
    })

    renderWithQuery(<StatisticsView />)

    const cardsSection = screen
      .getByRole('heading', { name: 'Statistiken' })
      .closest('section') as HTMLElement
    expect(within(cardsSection).getByText('3')).toBeInTheDocument()
    expect(within(cardsSection).getByText('2')).toBeInTheDocument()
    expect(screen.getByText('73 %')).toBeInTheDocument()
    expect(screen.getByText('Amsel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Amsel/ })).toBeInTheDocument()

    expect(mocks.useArchiveDetections).toHaveBeenCalledTimes(1)
    const [, , options] = mocks.useArchiveDetections.mock.calls[0]
    expect(options.enabled).toBe(true)
  })
})
