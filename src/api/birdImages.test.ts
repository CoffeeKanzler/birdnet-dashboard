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
})
