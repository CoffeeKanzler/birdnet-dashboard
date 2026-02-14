export type RarityObservation = {
  speciesCode: string
  comName: string
  sciName: string
  obsDt: string
}

export type RaritySpecies = {
  speciesCode: string
  commonName: string
  scientificName: string
  lastObserved: string
  lastObservedAt: number
  sightingCount: number
  source: 'eBird'
}

type FetchRarityOptions = {
  regionCode: string
  signal?: AbortSignal
}

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.floor(parsed)
}

const resolveRarityLookbackDays = (): number =>
  parsePositiveInt(import.meta.env.VITE_EBIRD_RARITY_LOOKBACK_DAYS, 90)

const resolveRarityMaxResults = (): number =>
  parsePositiveInt(import.meta.env.VITE_EBIRD_RARITY_MAX_RESULTS, 200)

const parseObsDate = (obsDt: string): { date: string; sortKey: number } => {
  const trimmed = obsDt.trim()
  const datePart = trimmed.slice(0, 10)
  const [yearRaw, monthRaw, dayRaw] = datePart.split('-')
  const year = Number(yearRaw) || 0
  const month = Number(monthRaw) || 0
  const day = Number(dayRaw) || 0

  const timePart = trimmed.length > 10 ? trimmed.slice(11) : ''
  const [hourRaw, minuteRaw] = timePart.split(':')
  const hour = Number(hourRaw) || 0
  const minute = Number(minuteRaw) || 0

  const sortKey =
    year * 100000000 + month * 1000000 + day * 10000 + hour * 100 + minute

  return {
    date: year && month && day ? datePart : '',
    sortKey,
  }
}

export const fetchRarityList = async ({
  regionCode,
  signal,
}: FetchRarityOptions): Promise<RaritySpecies[]> => {
  const params = new URLSearchParams({
    back: String(resolveRarityLookbackDays()),
    maxResults: String(resolveRarityMaxResults()),
  })
  const response = await fetch(
    `/api/rarity/data/obs/${regionCode}/recent/notable?${params.toString()}`,
    { signal },
  )

  if (!response.ok) {
    throw new Error(`eBird-Anfrage fehlgeschlagen: ${response.status}`)
  }

  const observations = (await response.json()) as RarityObservation[]

  const bySpecies = new Map<string, RaritySpecies>()

  for (const observation of observations) {
    const { date, sortKey } = parseObsDate(observation.obsDt)
    const existing = bySpecies.get(observation.speciesCode)

    if (!existing) {
      bySpecies.set(observation.speciesCode, {
        speciesCode: observation.speciesCode,
        commonName: observation.comName,
        scientificName: observation.sciName,
        lastObserved: date,
        lastObservedAt: sortKey,
        sightingCount: 1,
        source: 'eBird',
      })
      continue
    }

    existing.sightingCount += 1

    if (sortKey > existing.lastObservedAt) {
      existing.lastObservedAt = sortKey
      existing.lastObserved = date
    }
  }

  return Array.from(bySpecies.values()).sort((a, b) => {
    if (a.sightingCount !== b.sightingCount) {
      return a.sightingCount - b.sightingCount
    }

    if (a.lastObservedAt !== b.lastObservedAt) {
      return b.lastObservedAt - a.lastObservedAt
    }

    return a.speciesCode.localeCompare(b.speciesCode)
  })
}
