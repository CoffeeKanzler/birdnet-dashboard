import { buildApiUrl, requestJson } from './apiClient'

export type SummarySpeciesCount = {
  commonName: string
  scientificName: string
  count: number
  lastSeenAt?: string
}

export type SummaryStats = {
  totalDetections: number
  uniqueSpecies: number
  avgConfidence: number
  hourlyBins: number[]
  topSpecies: SummarySpeciesCount[]
}

export type SummaryArchive = {
  groups: SummarySpeciesCount[]
}

export type Summary30d = {
  generatedAt: string
  windowStart: string
  windowEnd: string
  pending?: boolean
  stats: SummaryStats
  archive: SummaryArchive
}

type RawSpeciesCount = {
  commonName?: string
  common_name?: string
  scientificName?: string
  scientific_name?: string
  count?: number
  lastSeenAt?: string
  last_seen_at?: string
}

type RawSummaryResponse = {
  generatedAt?: string
  generated_at?: string
  windowStart?: string
  window_start?: string
  windowEnd?: string
  window_end?: string
  stats?: {
    totalDetections?: number
    total_detections?: number
    uniqueSpecies?: number
    unique_species?: number
    avgConfidence?: number
    avg_confidence?: number
    hourlyBins?: number[] | Array<{ hour?: number; count?: number }>
    hourly_bins?: number[] | Array<{ hour?: number; count?: number }>
    topSpecies?: RawSpeciesCount[]
    top_species?: RawSpeciesCount[]
  }
  archive?: {
    groups?: RawSpeciesCount[]
  } | RawSpeciesCount[]
}

const toSpeciesCount = (value: RawSpeciesCount): SummarySpeciesCount => ({
  commonName: value.commonName ?? value.common_name ?? 'Unbekannte Art',
  scientificName: value.scientificName ?? value.scientific_name ?? 'Unbekannte Art',
  count: Number(value.count ?? 0),
  lastSeenAt: value.lastSeenAt ?? value.last_seen_at,
})

const toHourlyBins = (
  value: number[] | Array<{ hour?: number; count?: number }> | undefined,
): number[] => {
  if (!value) {
    return Array.from({ length: 24 }, () => 0)
  }

  if (value.length === 24 && typeof value[0] === 'number') {
    return (value as number[]).map((entry) => Number(entry ?? 0))
  }

  const bins = Array.from({ length: 24 }, () => 0)
  for (const entry of value as Array<{ hour?: number; count?: number }>) {
    const hour = Number(entry.hour ?? -1)
    if (hour >= 0 && hour < 24) {
      bins[hour] = Number(entry.count ?? 0)
    }
  }
  return bins
}

export const fetchSummary30d = async (signal?: AbortSignal): Promise<Summary30d> => {
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    const raw = await requestJson<RawSummaryResponse>(buildApiUrl('/api/v2/summary/30d'), {
      signal,
    })

    const nowIso = new Date().toISOString()
    const stats = raw.stats ?? {}
    const archiveRaw = raw.archive
    const archiveGroups =
      Array.isArray(archiveRaw) ? archiveRaw : archiveRaw?.groups ?? []

    return {
      generatedAt: raw.generatedAt ?? raw.generated_at ?? nowIso,
      windowStart: raw.windowStart ?? raw.window_start ?? '',
      windowEnd: raw.windowEnd ?? raw.window_end ?? '',
      pending: false,
      stats: {
        totalDetections: Number(stats.totalDetections ?? stats.total_detections ?? 0),
        uniqueSpecies: Number(stats.uniqueSpecies ?? stats.unique_species ?? 0),
        avgConfidence: Number(stats.avgConfidence ?? stats.avg_confidence ?? 0),
        hourlyBins: toHourlyBins(stats.hourlyBins ?? stats.hourly_bins),
        topSpecies: (stats.topSpecies ?? stats.top_species ?? []).map(toSpeciesCount),
      },
      archive: {
        groups: archiveGroups.map(toSpeciesCount),
      },
    }
  }

  const response = await fetch(buildApiUrl('/api/v2/summary/30d'), {
    signal,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
    },
  })

  if (response.status === 202) {
    const nowIso = new Date().toISOString()
    return {
      generatedAt: nowIso,
      windowStart: '',
      windowEnd: '',
      pending: true,
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
  }

  if (!response.ok) {
    throw new Error(`Summary request failed with status ${response.status}`)
  }

  const raw = (await response.json()) as RawSummaryResponse

  const nowIso = new Date().toISOString()
  const stats = raw.stats ?? {}
  const archiveRaw = raw.archive
  const archiveGroups =
    Array.isArray(archiveRaw) ? archiveRaw : archiveRaw?.groups ?? []

  return {
    generatedAt: raw.generatedAt ?? raw.generated_at ?? nowIso,
    windowStart: raw.windowStart ?? raw.window_start ?? '',
    windowEnd: raw.windowEnd ?? raw.window_end ?? '',
    pending: false,
    stats: {
      totalDetections: Number(stats.totalDetections ?? stats.total_detections ?? 0),
      uniqueSpecies: Number(stats.uniqueSpecies ?? stats.unique_species ?? 0),
      avgConfidence: Number(stats.avgConfidence ?? stats.avg_confidence ?? 0),
      hourlyBins: toHourlyBins(stats.hourlyBins ?? stats.hourly_bins),
      topSpecies: (stats.topSpecies ?? stats.top_species ?? []).map(toSpeciesCount),
    },
    archive: {
      groups: archiveGroups.map(toSpeciesCount),
    },
  }
}
