export type Detection = {
  id: string
  commonName: string
  scientificName: string
  confidence: number
  timestamp: string
}

export type SpeciesInfo = {
  scientificName: string
  commonName: string
  rarityStatus?: string
  familyCommon?: string
  source?: string
}

type DetectionApiRecord = {
  id?: string | number
  common_name?: string
  scientific_name?: string
  commonName?: string
  scientificName?: string
  confidence?: number
  beginTime?: string
  endTime?: string
  timestamp?: string
  time?: string
  datetime?: string
  date?: string
  created_at?: string
  createdAt?: string
}

type FetchDetectionsOptions = {
  limit?: number
  offset?: number
  signal?: AbortSignal
}

type FetchRangeDetectionsOptions = {
  startDate: string
  endDate: string
  limit?: number
  offset?: number
  signal?: AbortSignal
}

type FetchSpeciesDetectionsOptions = {
  scientificName: string
  limit?: number
  offset?: number
  signal?: AbortSignal
}

type PaginatedDetectionsResponse = {
  data?: DetectionApiRecord[]
  detections?: DetectionApiRecord[]
  items?: DetectionApiRecord[]
  total?: number
}

type SpeciesInfoApiResponse = {
  scientific_name?: string
  common_name?: string
  rarity?: {
    status?: string
  }
  taxonomy?: {
    family_common?: string
  }
  metadata?: {
    source?: string
  }
}

const TODAY_PAGE_LIMIT = 200
const MAX_TODAY_PAGES = 100

const normalizeTimestamp = (record: DetectionApiRecord): string => {
  const value =
    record.endTime ??
    record.beginTime ??
    record.timestamp ??
    record.datetime ??
    record.created_at ??
    record.createdAt ??
    record.date ??
    record.time

  if (!value) {
    return ''
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    return String(value)
  }

  return parsed.toISOString()
}

const toSortValue = (timestamp: string) => {
  const value = new Date(timestamp).valueOf()
  return Number.isNaN(value) ? 0 : value
}

const toTimestamp = (value: string): number | null => {
  const parsed = new Date(value).valueOf()
  return Number.isNaN(parsed) ? null : parsed
}

const oldestTimestampInPage = (page: Detection[]): number | null => {
  for (let index = page.length - 1; index >= 0; index -= 1) {
    const value = toTimestamp(page[index]?.timestamp ?? '')
    if (value !== null) {
      return value
    }
  }

  return null
}

const toDetection = (record: DetectionApiRecord): Detection => {
  const timestamp = normalizeTimestamp(record)

  return {
    id: record.id !== undefined ? String(record.id) : 'unknown',
    commonName: record.commonName ?? record.common_name ?? 'Unbekannte Art',
    scientificName:
      record.scientificName ?? record.scientific_name ?? 'Unbekannte Art',
    confidence: record.confidence ?? 0,
    timestamp,
  }
}

export const getApiBaseUrl = (): string => {
  const baseUrl = import.meta.env.VITE_BIRDNET_API_BASE_URL ?? ''

  if (!baseUrl) {
    return ''
  }

  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export const fetchDetectionsPage = async ({
  limit = 100,
  offset = 0,
  signal,
}: FetchDetectionsOptions = {}): Promise<Detection[]> => {
  const params = new URLSearchParams({
    numResults: String(limit),
    offset: String(offset),
  })

  const response = await fetch(
    `${getApiBaseUrl()}/api/v2/detections?${params.toString()}`,
    { signal, cache: 'no-store' },
  )

  if (!response.ok) {
    throw new Error(`BirdNET-Anfrage fehlgeschlagen: ${response.status}`)
  }

  const data = (await response.json()) as
    | DetectionApiRecord[]
    | {
        data?: DetectionApiRecord[]
        detections?: DetectionApiRecord[]
        items?: DetectionApiRecord[]
      }

  const records = Array.isArray(data)
    ? data
    : data.data ?? data.detections ?? data.items ?? []

  return records
    .map(toDetection)
    .sort((a, b) => toSortValue(b.timestamp) - toSortValue(a.timestamp))
}

export const fetchDetectionsRangePage = async ({
  startDate,
  endDate,
  limit = 200,
  offset = 0,
  signal,
}: FetchRangeDetectionsOptions): Promise<{ detections: Detection[]; total: number }> => {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    numResults: String(limit),
    offset: String(offset),
  })

  const response = await fetch(
    `${getApiBaseUrl()}/api/v2/detections?${params.toString()}`,
    { signal, cache: 'no-store' },
  )

  if (!response.ok) {
    throw new Error(`BirdNET-Anfrage fehlgeschlagen: ${response.status}`)
  }

  const data = (await response.json()) as PaginatedDetectionsResponse | DetectionApiRecord[]

  const records = Array.isArray(data)
    ? data
    : data.data ?? data.detections ?? data.items ?? []

  const total = Array.isArray(data) ? records.length : Number(data.total ?? records.length)

  return {
    detections: records
      .map(toDetection)
      .sort((a, b) => toSortValue(b.timestamp) - toSortValue(a.timestamp)),
    total,
  }
}

export const fetchRecentDetections = async ({
  limit = 100,
  signal,
}: FetchDetectionsOptions = {}): Promise<Detection[]> => {
  const params = new URLSearchParams({
    limit: String(limit),
  })

  const response = await fetch(
    `${getApiBaseUrl()}/api/v2/detections/recent?${params.toString()}`,
    { signal, cache: 'no-store' },
  )

  if (!response.ok) {
    throw new Error(`BirdNET-Anfrage fehlgeschlagen: ${response.status}`)
  }

  const data = (await response.json()) as DetectionApiRecord[]

  return data.map(toDetection).sort((a, b) => toSortValue(b.timestamp) - toSortValue(a.timestamp))
}

export const fetchDetections = async (
  options: FetchDetectionsOptions = {},
): Promise<Detection[]> => {
  // Default today view fetch; page until we cross today's start.
  const pageLimit = options.limit && options.limit > 0 ? options.limit : TODAY_PAGE_LIMIT
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const startTime = todayStart.valueOf()

  const collected: Detection[] = []
  let offset = options.offset ?? 0

  for (let pageIndex = 0; pageIndex < MAX_TODAY_PAGES; pageIndex += 1) {
    const page = await fetchDetectionsPage({
      limit: pageLimit,
      offset,
      signal: options.signal,
    })

    if (page.length === 0) {
      break
    }

    collected.push(...page)

    if (page.length < pageLimit) {
      break
    }

    const oldestTimestamp = oldestTimestampInPage(page)
    if (oldestTimestamp !== null && oldestTimestamp < startTime) {
      break
    }

    offset += pageLimit
  }

  return collected
    .filter((detection) => {
      const timestamp = toTimestamp(detection.timestamp)
      if (timestamp === null) {
        return false
      }

      return timestamp >= startTime
    })
    .sort((a, b) => toSortValue(b.timestamp) - toSortValue(a.timestamp))
}

export const fetchSpeciesDetectionsPage = async ({
  scientificName,
  limit = 25,
  offset = 0,
  signal,
}: FetchSpeciesDetectionsOptions): Promise<{ detections: Detection[]; total: number }> => {
  const params = new URLSearchParams({
    queryType: 'search',
    search: scientificName,
    numResults: String(limit),
    offset: String(offset),
  })

  const response = await fetch(
    `${getApiBaseUrl()}/api/v2/detections?${params.toString()}`,
    { signal, cache: 'no-store' },
  )

  if (!response.ok) {
    throw new Error(`BirdNET-Anfrage fehlgeschlagen: ${response.status}`)
  }

  const data = (await response.json()) as PaginatedDetectionsResponse | DetectionApiRecord[]

  const records = Array.isArray(data)
    ? data
    : data.data ?? data.detections ?? data.items ?? []

  const total = Array.isArray(data) ? records.length : Number(data.total ?? records.length)

  return {
    detections: records
      .map(toDetection)
      .filter((detection) => {
        return normalize(detection.scientificName) === normalize(scientificName)
      })
      .sort((a, b) => toSortValue(b.timestamp) - toSortValue(a.timestamp)),
    total,
  }
}

export const fetchSpeciesInfo = async ({
  scientificName,
  signal,
}: {
  scientificName: string
  signal?: AbortSignal
}): Promise<SpeciesInfo | null> => {
  const params = new URLSearchParams({
    scientific_name: scientificName,
  })

  const response = await fetch(
    `${getApiBaseUrl()}/api/v2/species?${params.toString()}`,
    { signal, cache: 'no-store' },
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`BirdNET-Anfrage fehlgeschlagen: ${response.status}`)
  }

  const data = (await response.json()) as SpeciesInfoApiResponse

  return {
    scientificName: data.scientific_name ?? scientificName,
    commonName: data.common_name ?? '',
    rarityStatus: data.rarity?.status,
    familyCommon: data.taxonomy?.family_common,
    source: data.metadata?.source,
  }
}

const normalize = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
