import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestJsonMock = vi.hoisted(() => vi.fn())

class MockApiClientError extends Error {
  code: string
  status?: number

  constructor({
    message,
    code,
    status,
  }: {
    message: string
    code: string
    status?: number
  }) {
    super(message)
    this.code = code
    this.status = status
  }
}

vi.mock('./apiClient', () => ({
  ApiClientError: MockApiClientError,
  buildApiUrl: (path: string, query?: URLSearchParams) => {
    if (!query) {
      return path
    }
    const encoded = query.toString()
    return encoded ? `${path}?${encoded}` : path
  },
  requestJson: (...args: unknown[]) => requestJsonMock(...args),
}))

describe('birdImages', () => {
  beforeEach(() => {
    vi.resetModules()
    requestJsonMock.mockReset()
  })

  it('falls back from de to en summary and caches successful result', async () => {
    requestJsonMock.mockImplementation(async (url: string) => {
      if (url.startsWith('https://de.wikipedia.org/api/rest_v1/page/summary/')) {
        throw new MockApiClientError({
          message: 'not found',
          code: 'http',
          status: 404,
        })
      }

      if (url.startsWith('https://en.wikipedia.org/api/rest_v1/page/summary/')) {
        return {
          thumbnail: {
            source: 'https://upload.wikimedia.org/test-image.jpg',
            width: 800,
            height: 600,
          },
          content_urls: {
            desktop: {
              page: 'https://en.wikipedia.org/wiki/Turdus_merula',
            },
          },
        }
      }

      if (url.startsWith('https://en.wikipedia.org/w/api.php')) {
        return {
          query: {
            pages: {
              '1': {
                pageimage: 'Turdus_merula.jpg',
              },
            },
          },
        }
      }

      if (url.startsWith('https://commons.wikimedia.org/w/api.php')) {
        return {
          query: {
            pages: {
              '1': {
                imageinfo: [
                  {
                    descriptionurl: 'https://commons.wikimedia.org/wiki/File:Turdus_merula.jpg',
                    extmetadata: {
                      Artist: { value: 'Jane Author' },
                      Credit: { value: 'Own work' },
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                      LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
                    },
                  },
                ],
              },
            },
          },
        }
      }

      return {}
    })

    const { fetchSpeciesPhoto, getPhotoAttributionRecords } = await import('./birdImages')

    const photo = await fetchSpeciesPhoto({
      scientificName: 'Turdus merula',
    })

    expect(photo).toEqual(
      expect.objectContaining({
        url: 'https://upload.wikimedia.org/test-image.jpg',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Turdus_merula.jpg',
      }),
    )

    const callCountAfterFirst = requestJsonMock.mock.calls.length
    const cached = await fetchSpeciesPhoto({
      scientificName: 'Turdus merula',
    })
    expect(cached).toEqual(photo)
    expect(requestJsonMock).toHaveBeenCalledTimes(callCountAfterFirst)

    const records = getPhotoAttributionRecords()
    expect(records).toHaveLength(1)
    expect(records[0]).toEqual(
      expect.objectContaining({
        scientificName: 'Turdus merula',
        hasImage: true,
        author: 'Jane Author',
      }),
    )
  })

  it('caches missing-photo results and retries only when forced', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    requestJsonMock.mockResolvedValue({})

    const { fetchSpeciesPhoto } = await import('./birdImages')

    const first = await fetchSpeciesPhoto({
      scientificName: 'NoPhotoSpecies',
    })
    expect(first).toBeNull()
    const callCountAfterFirst = requestJsonMock.mock.calls.length

    const second = await fetchSpeciesPhoto({
      scientificName: 'NoPhotoSpecies',
    })
    expect(second).toBeNull()
    expect(requestJsonMock).toHaveBeenCalledTimes(callCountAfterFirst)

    const third = await fetchSpeciesPhoto({
      scientificName: 'NoPhotoSpecies',
      forceRetry: true,
    })
    expect(third).toBeNull()
    expect(requestJsonMock.mock.calls.length).toBeGreaterThan(callCountAfterFirst)
  })

  it('returns null immediately when the signal is already aborted', async () => {
    const { fetchSpeciesPhoto } = await import('./birdImages')
    const controller = new AbortController()
    controller.abort()

    const result = await fetchSpeciesPhoto({
      scientificName: 'Aborted Species',
      signal: controller.signal,
    })

    expect(result).toBeNull()
    expect(requestJsonMock).not.toHaveBeenCalled()
  })

  it('returns null without fetching when both names are placeholders or empty', async () => {
    const { fetchSpeciesPhoto } = await import('./birdImages')

    const empty = await fetchSpeciesPhoto({})
    expect(empty).toBeNull()

    const placeholder = await fetchSpeciesPhoto({
      commonName: 'Unknown species',
      scientificName: 'unbekannte art',
    })
    expect(placeholder).toBeNull()
    expect(requestJsonMock).not.toHaveBeenCalled()
  })

  it('reuses the in-flight request for a second concurrent call with the same cache key', async () => {
    requestJsonMock.mockResolvedValue({
      thumbnail: { source: 'https://upload.wikimedia.org/concurrent.jpg', width: 200, height: 150 },
    })

    const { fetchSpeciesPhoto } = await import('./birdImages')

    const first = fetchSpeciesPhoto({ scientificName: 'Concurrent Species' })
    const second = fetchSpeciesPhoto({ scientificName: 'Concurrent Species' })

    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(firstResult).toEqual(secondResult)
    expect(firstResult?.url).toBe('https://upload.wikimedia.org/concurrent.jpg')
  })

  it('rejects with a formatted error for a non-404 Wikipedia HTTP failure', async () => {
    requestJsonMock.mockImplementation(async (url: string) => {
      if (url.includes('/page/summary/')) {
        throw new MockApiClientError({ message: 'server error', code: 'http', status: 500 })
      }
      return {}
    })

    const { fetchSpeciesPhoto } = await import('./birdImages')

    await expect(
      fetchSpeciesPhoto({ scientificName: 'Broken Species' }),
    ).rejects.toThrow('Wikipedia-Anfrage fehlgeschlagen: 500')
  })

  it('rejects with a generic error for a non-ApiClientError failure', async () => {
    requestJsonMock.mockImplementation(async (url: string) => {
      if (url.includes('/page/summary/')) {
        throw new TypeError('network exploded')
      }
      return {}
    })

    const { fetchSpeciesPhoto } = await import('./birdImages')

    await expect(
      fetchSpeciesPhoto({ scientificName: 'Explode Species' }),
    ).rejects.toThrow('Wikipedia-Anfrage fehlgeschlagen')
  })

  it('falls back to no attribution when the page-image lookup finds no image', async () => {
    requestJsonMock.mockImplementation(async (url: string) => {
      if (url.includes('/page/summary/')) {
        return {
          thumbnail: { source: 'https://upload.wikimedia.org/no-title.jpg', width: 200, height: 150 },
        }
      }
      if (url.includes('/w/api.php') && url.includes('piprop=name')) {
        return { query: { pages: { '1': {} } } }
      }
      return {}
    })

    const { fetchSpeciesPhoto } = await import('./birdImages')
    const photo = await fetchSpeciesPhoto({ scientificName: 'Titleless Species' })

    expect(photo?.url).toBe('https://upload.wikimedia.org/no-title.jpg')
    expect(photo?.sourceUrl).toBe('')
  })

  it('falls back to the source URL when the commons imageinfo lookup finds no info', async () => {
    requestJsonMock.mockImplementation(async (url: string) => {
      if (url.includes('/page/summary/')) {
        return {
          thumbnail: { source: 'https://upload.wikimedia.org/no-info.jpg', width: 200, height: 150 },
          content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Example' } },
        }
      }
      if (url.includes('piprop=name')) {
        return { query: { pages: { '1': { pageimage: 'Example.jpg' } } } }
      }
      if (url.includes('iiprop=url')) {
        return { query: { pages: { '1': { imageinfo: [] } } } }
      }
      return {}
    })

    const { fetchSpeciesPhoto } = await import('./birdImages')
    const photo = await fetchSpeciesPhoto({ scientificName: 'Infoless Species' })

    expect(photo?.sourceUrl).toBe('https://en.wikipedia.org/wiki/Example')
  })

  it('sorts attribution records by common name, then scientific name', async () => {
    requestJsonMock.mockResolvedValue({})

    const { fetchSpeciesPhoto, getPhotoAttributionRecords } = await import('./birdImages')

    await fetchSpeciesPhoto({ commonName: 'Zebra Finch', scientificName: 'Taeniopygia guttata' })
    await fetchSpeciesPhoto({ commonName: 'Amsel', scientificName: 'Turdus merula' })

    const records = getPhotoAttributionRecords()
    expect(records.map((r) => r.commonName)).toEqual(['Amsel', 'Zebra Finch'])
  })
})
