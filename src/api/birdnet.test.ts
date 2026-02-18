import {
  fetchDetections,
  fetchDetectionsPage,
  fetchFamilyMatches,
  fetchRecentDetections,
  fetchDetectionsRangePage,
  fetchSpeciesDetectionsPage,
  fetchSpeciesInfo,
} from './birdnet'
import { afterEach, describe, expect, it, vi } from 'vitest'

const jsonResponse = (payload: unknown, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('birdnet api helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('maps and sorts records from detections page payloads', async () => {
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test/')
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 10,
            common_name: 'Sparrow',
            scientific_name: 'Passer domesticus',
            confidence: 0.4,
            beginTime: '2026-02-14T09:00:00Z',
          },
          {
            id: 11,
            commonName: 'Robin',
            scientificName: 'Erithacus rubecula',
            confidence: 0.9,
            timestamp: '2026-02-14T11:00:00Z',
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const detections = await fetchDetectionsPage({ limit: 2, offset: 12 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('https://api.example.test/api/v2/detections?')
    expect(url).toContain('numResults=2')
    expect(url).toContain('offset=12')
    expect(detections.map((entry) => entry.id)).toEqual(['11', '10'])
    expect(detections[0]?.timestamp).toBe('2026-02-14T11:00:00.000Z')
  })

  it('returns paginated range results with total metadata', async () => {
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test')
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: 'b',
            common_name: 'Great tit',
            scientific_name: 'Parus major',
            timestamp: '2026-02-14T05:00:00Z',
          },
          {
            id: 'a',
            common_name: 'Blue tit',
            scientific_name: 'Cyanistes caeruleus',
            timestamp: '2026-02-14T07:00:00Z',
          },
        ],
        total: 88,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchDetectionsRangePage({
      startDate: '2026-02-14',
      endDate: '2026-02-15',
      limit: 2,
      offset: 0,
    })

    expect(result.total).toBe(88)
    expect(result.detections.map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('stops paging once oldest detection crosses today start', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-14T12:00:00Z'))
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test')

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'today-new',
          common_name: 'Bird A',
          scientific_name: 'Species A',
          timestamp: '2026-02-14T11:10:00Z',
        },
        {
          id: 'today-old',
          common_name: 'Bird B',
          scientific_name: 'Species B',
          timestamp: '2026-02-14T01:00:00Z',
        },
        {
          id: 'yesterday',
          common_name: 'Bird C',
          scientific_name: 'Species C',
          timestamp: '2026-02-13T22:50:00Z',
        },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchDetections({ limit: 3 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.map((entry) => entry.id)).toEqual(['today-new', 'today-old'])
  })

  it('returns null for missing species info', async () => {
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test')
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchSpeciesInfo({ scientificName: 'Unknown bird' })

    expect(result).toBeNull()
  })

  it('fetches and sorts recent detections endpoint', async () => {
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test')
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'two',
          common_name: 'Bird B',
          scientific_name: 'Species B',
          timestamp: '2026-02-14T06:00:00Z',
        },
        {
          id: 'one',
          common_name: 'Bird A',
          scientific_name: 'Species A',
          timestamp: '2026-02-14T07:00:00Z',
        },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchRecentDetections({ limit: 2 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain('/api/v2/detections/recent?limit=2')
    expect(result.map((entry) => entry.id)).toEqual(['one', 'two'])
  })

  it('pages detections until day boundary is crossed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-14T12:00:00Z'))
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 'page-1-a',
            common_name: 'Bird A',
            scientific_name: 'Species A',
            timestamp: '2026-02-14T11:10:00Z',
          },
          {
            id: 'page-1-b',
            common_name: 'Bird B',
            scientific_name: 'Species B',
            timestamp: '2026-02-14T10:10:00Z',
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 'page-2-a',
            common_name: 'Bird C',
            scientific_name: 'Species C',
            timestamp: '2026-02-14T01:10:00Z',
          },
          {
            id: 'page-2-b',
            common_name: 'Bird D',
            scientific_name: 'Species D',
            timestamp: '2026-02-13T22:50:00Z',
          },
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchDetections({ limit: 2 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.map((entry) => entry.id)).toEqual(['page-1-a', 'page-1-b', 'page-2-a'])
  })

  it('filters species detections with normalized scientific names', async () => {
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test')
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'keep',
            common_name: 'Blue tit',
            scientific_name: 'Cyanistes caeruleus',
            timestamp: '2026-02-14T06:00:00Z',
          },
          {
            id: 'drop',
            common_name: 'Great tit',
            scientific_name: 'Parus major',
            timestamp: '2026-02-14T07:00:00Z',
          },
        ],
        total: 2,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchSpeciesDetectionsPage({
      scientificName: 'Cyanístes caeruleus',
      limit: 25,
      offset: 0,
    })

    expect(result.total).toBe(2)
    expect(result.detections.map((entry) => entry.id)).toEqual(['keep'])
  })

  it('maps species info payload fields', async () => {
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          scientific_name: 'Alcedo atthis',
          common_name: 'Eisvogel',
          rarity: { status: 'rare' },
          taxonomy: { family_common: 'Eisvogelartige' },
          metadata: { source: 'birdnet' },
        }),
      ),
    )

    const result = await fetchSpeciesInfo({ scientificName: 'Alcedo atthis' })

    expect(result).toEqual({
      scientificName: 'Alcedo atthis',
      commonName: 'Eisvogel',
      rarityStatus: 'rare',
      familyCommon: 'Eisvogelartige',
      source: 'birdnet',
    })
  })

  it('maps aborted species info requests to AbortError', async () => {
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test')

    const controller = new AbortController()
    controller.abort()

    await expect(
      fetchSpeciesInfo({ scientificName: 'Alcedo atthis', signal: controller.signal }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'AbortError',
        message: 'Anfrage abgebrochen',
      }),
    )
  })

  it('fetches family matches from cached backend endpoint', async () => {
    vi.stubEnv('VITE_BIRDNET_API_BASE_URL', 'https://api.example.test')
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        family_common: 'Drosseln and Spottdrosseln',
        matches: [
          {
            commonName: 'Singdrossel',
            scientificName: 'Turdus philomelos',
          },
          {
            commonName: '',
            scientificName: 'invalid',
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchFamilyMatches({
      familyCommon: 'Drosseln and Spottdrosseln',
      scientificName: 'Turdus merula',
      limit: 7,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('/api/v2/family-matches?')
    expect(url).toContain('familyCommon=Drosseln+and+Spottdrosseln')
    expect(url).toContain('scientificName=Turdus+merula')
    expect(url).toContain('limit=7')
    expect(result).toEqual([
      {
        commonName: 'Singdrossel',
        scientificName: 'Turdus philomelos',
      },
    ])
  })
})
