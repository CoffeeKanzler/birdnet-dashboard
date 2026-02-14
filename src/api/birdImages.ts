export type SpeciesPhoto = {
  url: string
  width: number
  height: number
  sourceUrl: string
  attribution?: {
    author?: string
    credit?: string
    license?: string
    licenseUrl?: string
    usageTerms?: string
  }
}

export type PhotoAttributionRecord = {
  commonName: string
  scientificName: string
  hasImage: boolean
  sourceUrl: string
  author?: string
  credit?: string
  license?: string
  licenseUrl?: string
  usageTerms?: string
}

type WikipediaSummaryResponse = {
  thumbnail?: {
    source?: string
    width?: number
    height?: number
  }
  content_urls?: {
    desktop?: {
      page?: string
    }
    mobile?: {
      page?: string
    }
  }
}

type PageImageApiResponse = {
  query?: {
    pages?: Record<
      string,
      {
        pageimage?: string
      }
    >
  }
}

type ImageInfoApiResponse = {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: Array<{
          descriptionurl?: string
          extmetadata?: {
            Artist?: { value?: string }
            Credit?: { value?: string }
            LicenseShortName?: { value?: string }
            LicenseUrl?: { value?: string }
            UsageTerms?: { value?: string }
          }
        }>
      }
    >
  }
}

type FetchSpeciesPhotoOptions = {
  commonName?: string
  scientificName?: string
  signal?: AbortSignal
}

const SUMMARY_ENDPOINTS = [
  'https://de.wikipedia.org/api/rest_v1/page/summary',
  'https://en.wikipedia.org/api/rest_v1/page/summary',
]
const UNKNOWN_SPECIES_VALUES = new Set(['unknown species', 'unbekannte art'])
const FALLBACK_WIDTH = 640
const FALLBACK_HEIGHT = 426

const photoCache = new Map<string, SpeciesPhoto | null>()
const inflightRequests = new Map<string, Promise<SpeciesPhoto | null>>()
const attributionRegistry = new Map<string, PhotoAttributionRecord>()

const emitAttributionUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('birdnet-attribution-updated'))
  }
}

export const getPhotoAttributionRecords = (): PhotoAttributionRecord[] => {
  return Array.from(attributionRegistry.values()).sort((a, b) => {
    const common = a.commonName.localeCompare(b.commonName, 'de')
    if (common !== 0) {
      return common
    }

    return a.scientificName.localeCompare(b.scientificName, 'de')
  })
}

const upsertAttributionRecord = (
  cacheKey: string,
  record: PhotoAttributionRecord,
) => {
  attributionRegistry.set(cacheKey, record)
  emitAttributionUpdate()
}

const normalizeName = (value?: string): string => {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return ''
  }

  if (UNKNOWN_SPECIES_VALUES.has(trimmed.toLowerCase())) {
    return ''
  }

  return trimmed
}

const buildCacheKey = (commonName: string, scientificName: string): string =>
  `${commonName}|${scientificName}`

const toCommonsFileTitleFromThumbnailUrl = (thumbnailUrl: string): string | null => {
  try {
    const parsed = new URL(thumbnailUrl)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const thumbIndex = parts.indexOf('thumb')
    if (thumbIndex === -1 || parts.length <= thumbIndex + 3) {
      return null
    }

    const encodedName = parts[thumbIndex + 3]
    if (!encodedName) {
      return null
    }

    return `File:${decodeURIComponent(encodedName).replace(/_/g, ' ')}`
  } catch {
    return null
  }
}

const stripHtml = (value?: string): string => {
  if (!value) {
    return ''
  }

  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

const resolveImageTitle = async (
  wikiHost: string,
  title: string,
  signal?: AbortSignal,
): Promise<string | null> => {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'pageimages',
    piprop: 'name',
    titles: title,
  })

  const response = await fetch(`https://${wikiHost}/w/api.php?${params.toString()}`, {
    signal,
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as PageImageApiResponse
  const pages = data.query?.pages
  if (!pages) {
    return null
  }

  for (const page of Object.values(pages)) {
    if (page.pageimage) {
      return `File:${page.pageimage}`
    }
  }

  return null
}

const resolveAttribution = async (
  imageTitle: string,
  fallbackSourceUrl: string,
  signal?: AbortSignal,
): Promise<{
  sourceUrl: string
  author?: string
  credit?: string
  license?: string
  licenseUrl?: string
  usageTerms?: string
}> => {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    titles: imageTitle,
  })

  const response = await fetch(
    `https://commons.wikimedia.org/w/api.php?${params.toString()}`,
    {
      signal,
      headers: { accept: 'application/json' },
    },
  )

  if (!response.ok) {
    return { sourceUrl: fallbackSourceUrl }
  }

  const data = (await response.json()) as ImageInfoApiResponse
  const pages = data.query?.pages
  if (!pages) {
    return { sourceUrl: fallbackSourceUrl }
  }

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0]
    if (!info) {
      continue
    }

    return {
      sourceUrl: info.descriptionurl ?? fallbackSourceUrl,
      author: stripHtml(info.extmetadata?.Artist?.value),
      credit: stripHtml(info.extmetadata?.Credit?.value),
      license: stripHtml(info.extmetadata?.LicenseShortName?.value),
      licenseUrl: info.extmetadata?.LicenseUrl?.value,
      usageTerms: stripHtml(info.extmetadata?.UsageTerms?.value),
    }
  }

  return { sourceUrl: fallbackSourceUrl }
}

const toAsciiName = (value: string): string => {
  return value
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

const fetchSummaryThumbnail = async (
  title: string,
  signal?: AbortSignal,
): Promise<SpeciesPhoto | null> => {
  if (!title) {
    return null
  }

  for (const endpoint of SUMMARY_ENDPOINTS) {
    const wikiHost = endpoint.includes('de.wikipedia.org')
      ? 'de.wikipedia.org'
      : 'en.wikipedia.org'
    const response = await fetch(
      `${endpoint}/${encodeURIComponent(title)}`,
      {
        signal,
        headers: {
          accept: 'application/json',
        },
      },
    )

    if (!response.ok) {
      if (response.status === 404) {
        continue
      }

      throw new Error(`Wikipedia-Anfrage fehlgeschlagen: ${response.status}`)
    }

    const data = (await response.json()) as WikipediaSummaryResponse
    const thumbnail = data.thumbnail
    const source = thumbnail?.source

    if (!source) {
      continue
    }

    const sourceUrl =
      data.content_urls?.desktop?.page ??
      data.content_urls?.mobile?.page ??
      ''

    const imageTitleFromPage = await resolveImageTitle(wikiHost, title, signal)
    const imageTitleFromThumbnail = toCommonsFileTitleFromThumbnailUrl(source)
    const imageTitle = imageTitleFromPage ?? imageTitleFromThumbnail
    const attribution = imageTitle
      ? await resolveAttribution(imageTitle, sourceUrl, signal)
      : { sourceUrl }

    return {
      url: source,
      width: thumbnail?.width ?? FALLBACK_WIDTH,
      height: thumbnail?.height ?? FALLBACK_HEIGHT,
      sourceUrl: attribution.sourceUrl,
      attribution: {
        author: attribution.author,
        credit: attribution.credit,
        license: attribution.license,
        licenseUrl: attribution.licenseUrl,
        usageTerms: attribution.usageTerms,
      },
    }
  }

  return null
}

export const fetchSpeciesPhoto = async ({
  commonName,
  scientificName,
  signal,
}: FetchSpeciesPhotoOptions): Promise<SpeciesPhoto | null> => {
  if (signal?.aborted) {
    return null
  }

  const normalizedCommon = normalizeName(commonName)
  const normalizedScientific = normalizeName(scientificName)

  if (!normalizedCommon && !normalizedScientific) {
    return null
  }

  const cacheKey = buildCacheKey(normalizedCommon, normalizedScientific)
  const cached = photoCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  const inflight = inflightRequests.get(cacheKey)
  if (inflight) {
    return inflight
  }

  const request = (async () => {
    upsertAttributionRecord(cacheKey, {
      commonName: normalizedCommon || 'Unbekannte Art',
      scientificName: normalizedScientific || 'Unbekannte Art',
      hasImage: false,
      sourceUrl: '',
    })

    const namesToTry = [
      normalizedScientific,
      normalizedCommon,
      toAsciiName(normalizedCommon),
      toAsciiName(normalizedScientific),
    ].filter(
      (value, index, array) => Boolean(value) && array.indexOf(value) === index,
    )

    for (const name of namesToTry) {
      const photo = await fetchSummaryThumbnail(name, signal)
      if (photo) {
        photoCache.set(cacheKey, photo)
        upsertAttributionRecord(cacheKey, {
          commonName: normalizedCommon || 'Unbekannte Art',
          scientificName: normalizedScientific || 'Unbekannte Art',
          hasImage: true,
          sourceUrl: photo.sourceUrl,
          author: photo.attribution?.author,
          credit: photo.attribution?.credit,
          license: photo.attribution?.license,
          licenseUrl: photo.attribution?.licenseUrl,
          usageTerms: photo.attribution?.usageTerms,
        })
        return photo
      }
    }

    photoCache.set(cacheKey, null)
    upsertAttributionRecord(cacheKey, {
      commonName: normalizedCommon || 'Unbekannte Art',
      scientificName: normalizedScientific || 'Unbekannte Art',
      hasImage: false,
      sourceUrl: '',
    })
    return null
  })()
    .catch((error) => {
      photoCache.set(cacheKey, null)
      throw error
    })
    .finally(() => {
      inflightRequests.delete(cacheKey)
    })

  inflightRequests.set(cacheKey, request)
  return request
}
