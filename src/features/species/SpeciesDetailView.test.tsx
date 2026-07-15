import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '../../api/queryKeys'
import { renderWithQuery } from '../../test/renderWithQuery'
import SpeciesDetailView from './SpeciesDetailView'

vi.mock('../../data/notableSpecies', () => ({
  notableSpecies: [
    {
      commonName: 'Notable Fictus',
      scientificName: 'Fictus notabilis',
      description: 'A notable fictional description.',
    },
  ],
}))

vi.mock('../../data/speciesDescriptions', () => ({
  speciesDescriptions: [
    {
      scientificName: 'Fictus curatus',
      description: 'A curated fictional description.',
    },
  ],
}))

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
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
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
        {
          id: '3',
          commonName: 'Amsel',
          scientificName: 'Turdus merula',
          timestamp: '',
          confidence: 0.6,
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
    expect(screen.getByText('60 %')).toBeInTheDocument()
    expect(screen.getByText('not-a-date')).toBeInTheDocument()
    expect(screen.getByText('common.unknownTime')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('formats every rarity status, including the unknown fallback', async () => {
    const cases: Array<[string | undefined, string]> = [
      ['very_rare', 'rarity.veryRare'],
      ['rare', 'rarity.rare'],
      ['uncommon', 'rarity.uncommon'],
      ['very_common', 'rarity.veryCommon'],
      [undefined, 'rarity.unknown'],
    ]

    for (const [rarityStatus, expectedKey] of cases) {
      mocks.fetchSpeciesInfo.mockResolvedValue({ rarityStatus })

      const { unmount } = renderWithQuery(
        <SpeciesDetailView
          commonName="Amsel"
          scientificName="Turdus merula"
          onBack={vi.fn()}
        />,
      )

      expect(await screen.findByText(expectedKey, { exact: false })).toBeInTheDocument()
      unmount()
    }
  })

  it('shows the curated description when a species-descriptions entry matches', () => {
    renderWithQuery(
      <SpeciesDetailView
        commonName="Fictus Curatus"
        scientificName="Fictus curatus"
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('A curated fictional description.')).toBeInTheDocument()
  })

  it('shows the notable-species description when a notable entry matches', () => {
    renderWithQuery(
      <SpeciesDetailView
        commonName="Notable Fictus"
        scientificName="Fictus notabilis"
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('A notable fictional description.')).toBeInTheDocument()
  })

  it('shows cached family matches immediately, then reconciles with a fresh fetch', async () => {
    mocks.fetchSpeciesInfo.mockResolvedValue({ rarityStatus: 'common', familyCommon: 'Drosseln' })
    mocks.fetchFamilyMatches.mockResolvedValue([
      { commonName: 'Fresh Match', scientificName: 'Fresh sci' },
    ])

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    queryClient.setQueryData(queryKeys.familyMatches('drosseln'), [
      { commonName: 'Cached Match', scientificName: 'Cached sci' },
    ])

    // The cache is seeded and synchronously applied before the fresh fetch resolves
    // (exercising the cached-value branch), even though the near-instant fresh
    // response typically overtakes it before the next paint.
    expect(queryClient.getQueryData(queryKeys.familyMatches('drosseln'))).toEqual([
      { commonName: 'Cached Match', scientificName: 'Cached sci' },
    ])

    render(
      <QueryClientProvider client={queryClient}>
        <SpeciesDetailView commonName="Amsel" scientificName="Turdus merula" onBack={vi.fn()} />
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('button', { name: 'Fresh Match' })).toBeInTheDocument()
  })

  it('ignores a stale family-match success that resolves after a newer request started', async () => {
    mocks.fetchSpeciesInfo.mockResolvedValue({ rarityStatus: 'common', familyCommon: 'Drosseln' })

    let resolveFirst: ((value: Array<{ commonName: string; scientificName: string }>) => void) | undefined
    const firstCall = new Promise<Array<{ commonName: string; scientificName: string }>>((resolve) => {
      resolveFirst = resolve
    })

    mocks.fetchFamilyMatches
      .mockImplementationOnce(() => firstCall)
      .mockResolvedValueOnce([{ commonName: 'Second Match', scientificName: 'Second sci' }])

    const { rerender } = renderWithQuery(
      <SpeciesDetailView commonName="Amsel" scientificName="Turdus merula" onBack={vi.fn()} />,
    )
    await waitFor(() => expect(mocks.fetchFamilyMatches).toHaveBeenCalledTimes(1))

    rerender(
      <SpeciesDetailView commonName="Amsel" scientificName="Turdus pilaris" onBack={vi.fn()} />,
    )
    await waitFor(() => expect(mocks.fetchFamilyMatches).toHaveBeenCalledTimes(2))

    resolveFirst?.([{ commonName: 'Stale Match', scientificName: 'Stale sci' }])

    expect(await screen.findByRole('button', { name: 'Second Match' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stale Match' })).not.toBeInTheDocument()
  })

  it('ignores a stale family-match failure that resolves after a newer request started', async () => {
    mocks.fetchSpeciesInfo.mockResolvedValue({ rarityStatus: 'common', familyCommon: 'Drosseln' })

    let rejectFirst: ((error: Error) => void) | undefined
    const firstCall = new Promise<Array<{ commonName: string; scientificName: string }>>((_, reject) => {
      rejectFirst = reject
    })

    mocks.fetchFamilyMatches
      .mockImplementationOnce(() => firstCall)
      .mockResolvedValueOnce([{ commonName: 'Fresh Match', scientificName: 'Fresh sci' }])

    const { rerender } = renderWithQuery(
      <SpeciesDetailView commonName="Amsel" scientificName="Turdus merula" onBack={vi.fn()} />,
    )
    await waitFor(() => expect(mocks.fetchFamilyMatches).toHaveBeenCalledTimes(1))

    rerender(
      <SpeciesDetailView commonName="Amsel" scientificName="Turdus pilaris" onBack={vi.fn()} />,
    )
    await waitFor(() => expect(mocks.fetchFamilyMatches).toHaveBeenCalledTimes(2))

    rejectFirst?.(new Error('stale failure'))

    expect(await screen.findByRole('button', { name: 'Fresh Match' })).toBeInTheDocument()
    expect(screen.queryByText('error.familyLoad')).not.toBeInTheDocument()
  })
})
