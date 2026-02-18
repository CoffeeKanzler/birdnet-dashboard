const pad = (value: number): string => String(value).padStart(2, '0')

const toDateKey = (date: Date): string => {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

const now = new Date()

const atUtc = (daysAgo: number, hour: number, minute: number): string => {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  date.setUTCHours(hour, minute, 0, 0)
  return date.toISOString()
}

type DemoSpecies = {
  commonName: string
  scientificName: string
  familyCommon: string
  rarityStatus: 'very_common' | 'common' | 'uncommon' | 'rare'
}

type DemoDetection = {
  id: string
  common_name: string
  scientific_name: string
  confidence: number
  timestamp: string
}

const SPECIES: DemoSpecies[] = [
  { commonName: 'Blue Tit', scientificName: 'Cyanistes caeruleus', familyCommon: 'Tits, Chickadees, and Titmice', rarityStatus: 'very_common' },
  { commonName: 'Great Tit', scientificName: 'Parus major', familyCommon: 'Tits, Chickadees, and Titmice', rarityStatus: 'very_common' },
  { commonName: 'Marsh Tit', scientificName: 'Poecile palustris', familyCommon: 'Tits, Chickadees, and Titmice', rarityStatus: 'common' },
  { commonName: 'European Robin', scientificName: 'Erithacus rubecula', familyCommon: 'Chats, Old World Flycatchers', rarityStatus: 'common' },
  { commonName: 'Common Blackbird', scientificName: 'Turdus merula', familyCommon: 'Thrushes', rarityStatus: 'common' },
  { commonName: 'Eurasian Magpie', scientificName: 'Pica pica', familyCommon: 'Crows, Jays, and Magpies', rarityStatus: 'common' },
  { commonName: 'Common Kingfisher', scientificName: 'Alcedo atthis', familyCommon: 'Kingfishers', rarityStatus: 'rare' },
  { commonName: 'Common Chaffinch', scientificName: 'Fringilla coelebs', familyCommon: 'Finches', rarityStatus: 'common' },
]

const DETECTIONS: DemoDetection[] = [
  { id: 'd-001', common_name: 'Blue Tit', scientific_name: 'Cyanistes caeruleus', confidence: 0.94, timestamp: atUtc(0, 7, 14) },
  { id: 'd-002', common_name: 'Great Tit', scientific_name: 'Parus major', confidence: 0.91, timestamp: atUtc(0, 7, 18) },
  { id: 'd-003', common_name: 'Blue Tit', scientific_name: 'Cyanistes caeruleus', confidence: 0.87, timestamp: atUtc(0, 8, 3) },
  { id: 'd-004', common_name: 'European Robin', scientific_name: 'Erithacus rubecula', confidence: 0.89, timestamp: atUtc(0, 8, 31) },
  { id: 'd-005', common_name: 'Common Blackbird', scientific_name: 'Turdus merula', confidence: 0.96, timestamp: atUtc(0, 9, 2) },
  { id: 'd-006', common_name: 'Blue Tit', scientific_name: 'Cyanistes caeruleus', confidence: 0.92, timestamp: atUtc(0, 9, 41) },
  { id: 'd-007', common_name: 'Eurasian Magpie', scientific_name: 'Pica pica', confidence: 0.82, timestamp: atUtc(0, 10, 11) },
  { id: 'd-008', common_name: 'Common Chaffinch', scientific_name: 'Fringilla coelebs', confidence: 0.88, timestamp: atUtc(0, 10, 37) },
  { id: 'd-009', common_name: 'Marsh Tit', scientific_name: 'Poecile palustris', confidence: 0.79, timestamp: atUtc(0, 11, 2) },
  { id: 'd-010', common_name: 'Common Kingfisher', scientific_name: 'Alcedo atthis', confidence: 0.73, timestamp: atUtc(0, 11, 47) },
  { id: 'd-011', common_name: 'Common Blackbird', scientific_name: 'Turdus merula', confidence: 0.84, timestamp: atUtc(1, 7, 26) },
  { id: 'd-012', common_name: 'Blue Tit', scientific_name: 'Cyanistes caeruleus', confidence: 0.95, timestamp: atUtc(1, 8, 56) },
  { id: 'd-013', common_name: 'Great Tit', scientific_name: 'Parus major', confidence: 0.86, timestamp: atUtc(2, 7, 7) },
  { id: 'd-014', common_name: 'European Robin', scientific_name: 'Erithacus rubecula', confidence: 0.78, timestamp: atUtc(2, 7, 49) },
  { id: 'd-015', common_name: 'Common Chaffinch', scientific_name: 'Fringilla coelebs', confidence: 0.88, timestamp: atUtc(3, 8, 14) },
  { id: 'd-016', common_name: 'Common Blackbird', scientific_name: 'Turdus merula', confidence: 0.83, timestamp: atUtc(3, 8, 39) },
  { id: 'd-017', common_name: 'Great Tit', scientific_name: 'Parus major', confidence: 0.9, timestamp: atUtc(5, 9, 12) },
  { id: 'd-018', common_name: 'Blue Tit', scientific_name: 'Cyanistes caeruleus', confidence: 0.93, timestamp: atUtc(7, 7, 33) },
  { id: 'd-019', common_name: 'Eurasian Magpie', scientific_name: 'Pica pica', confidence: 0.8, timestamp: atUtc(9, 10, 2) },
  { id: 'd-020', common_name: 'Common Kingfisher', scientific_name: 'Alcedo atthis', confidence: 0.69, timestamp: atUtc(12, 6, 58) },
  { id: 'd-021', common_name: 'Marsh Tit', scientific_name: 'Poecile palustris', confidence: 0.81, timestamp: atUtc(14, 9, 22) },
  { id: 'd-022', common_name: 'Common Blackbird', scientific_name: 'Turdus merula', confidence: 0.85, timestamp: atUtc(18, 11, 5) },
  { id: 'd-023', common_name: 'European Robin', scientific_name: 'Erithacus rubecula', confidence: 0.87, timestamp: atUtc(21, 8, 11) },
  { id: 'd-024', common_name: 'Blue Tit', scientific_name: 'Cyanistes caeruleus', confidence: 0.9, timestamp: atUtc(24, 7, 45) },
  { id: 'd-025', common_name: 'Great Tit', scientific_name: 'Parus major', confidence: 0.9, timestamp: atUtc(27, 9, 29) },
]

const SORTED_DETECTIONS = DETECTIONS.slice().sort((a, b) => {
  return new Date(b.timestamp).valueOf() - new Date(a.timestamp).valueOf()
})

const getSummary = () => {
  const hourlyBins = Array.from({ length: 24 }, () => 0)
  const speciesCounts = new Map<string, { common_name: string; scientific_name: string; count: number; last_seen_at: string }>()

  for (const detection of SORTED_DETECTIONS) {
    const date = new Date(detection.timestamp)
    hourlyBins[date.getUTCHours()] += 1

    const key = `${detection.scientific_name}||${detection.common_name}`
    const existing = speciesCounts.get(key)
    if (existing) {
      existing.count += 1
      if (new Date(detection.timestamp).valueOf() > new Date(existing.last_seen_at).valueOf()) {
        existing.last_seen_at = detection.timestamp
      }
    } else {
      speciesCounts.set(key, {
        common_name: detection.common_name,
        scientific_name: detection.scientific_name,
        count: 1,
        last_seen_at: detection.timestamp,
      })
    }
  }

  const groups = Array.from(speciesCounts.values()).sort((a, b) => b.count - a.count)
  const avgConfidence = SORTED_DETECTIONS.length
    ? SORTED_DETECTIONS.reduce((sum, item) => sum + item.confidence * 100, 0) / SORTED_DETECTIONS.length
    : 0

  const windowEnd = toDateKey(now)
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - 29)

  return {
    generated_at: now.toISOString(),
    window_start: toDateKey(start),
    window_end: windowEnd,
    stats: {
      total_detections: SORTED_DETECTIONS.length,
      unique_species: groups.length,
      avg_confidence: Number(avgConfidence.toFixed(1)),
      hourly_bins: hourlyBins,
      top_species: groups.slice(0, 10),
    },
    archive: {
      groups,
    },
  }
}

const getDetectionsByQuery = (url: URL): DemoDetection[] => {
  const queryType = url.searchParams.get('queryType')
  const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()
  const startDate = url.searchParams.get('start_date')
  const endDate = url.searchParams.get('end_date')

  let records = SORTED_DETECTIONS

  if (queryType === 'search' && search) {
    records = records.filter((entry) => {
      return entry.common_name.toLowerCase().includes(search) || entry.scientific_name.toLowerCase().includes(search)
    })
  }

  if (startDate && endDate) {
    const startMs = new Date(`${startDate}T00:00:00.000Z`).valueOf()
    const endMs = new Date(`${endDate}T23:59:59.999Z`).valueOf()
    records = records.filter((entry) => {
      const ts = new Date(entry.timestamp).valueOf()
      return ts >= startMs && ts <= endMs
    })
  }

  const limit = Number(url.searchParams.get('numResults') ?? '100')
  const offset = Number(url.searchParams.get('offset') ?? '0')

  return records.slice(offset, offset + Math.max(1, limit))
}

const getSpecies = (scientificName: string) => {
  const normalized = scientificName.trim().toLowerCase()
  const species = SPECIES.find((entry) => entry.scientificName.toLowerCase() === normalized)
  if (!species) {
    return null
  }

  return {
    scientific_name: species.scientificName,
    common_name: species.commonName,
    rarity: {
      status: species.rarityStatus,
    },
    taxonomy: {
      family_common: species.familyCommon,
    },
    metadata: {
      source: 'demo',
    },
  }
}

const getFamilyMatches = (url: URL) => {
  const familyCommon = (url.searchParams.get('familyCommon') ?? '').trim().toLowerCase()
  const ownScientific = (url.searchParams.get('scientificName') ?? '').trim().toLowerCase()
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 50)

  const matches = SPECIES
    .filter((entry) => entry.familyCommon.toLowerCase() === familyCommon)
    .filter((entry) => entry.scientificName.toLowerCase() !== ownScientific)
    .slice(0, Math.max(1, limit))
    .map((entry) => ({
      commonName: entry.commonName,
      scientificName: entry.scientificName,
    }))

  return {
    family_common: url.searchParams.get('familyCommon') ?? '',
    matches,
  }
}

const getRecent = (url: URL): DemoDetection[] => {
  const limit = Number(url.searchParams.get('limit') ?? '30')
  return SORTED_DETECTIONS.slice(0, Math.max(1, limit))
}

export const getMockBirdnetJson = (rawUrl: string): { payload: unknown; headers?: HeadersInit } | null => {
  const url = new URL(rawUrl, window.location.origin)
  const path = url.pathname

  if (path === '/api/v2/summary/30d') {
    return {
      payload: getSummary(),
      headers: {
        'x-summary-cache': 'fresh',
      },
    }
  }

  if (path === '/api/v2/detections/recent') {
    return {
      payload: getRecent(url),
      headers: {
        'x-detections-cache': 'fresh',
      },
    }
  }

  if (path === '/api/v2/detections') {
    return {
      payload: getDetectionsByQuery(url),
      headers: {
        'x-detections-cache': 'fresh',
      },
    }
  }

  if (path === '/api/v2/species') {
    const scientificName = url.searchParams.get('scientific_name') ?? ''
    const payload = getSpecies(scientificName)
    if (!payload) {
      return {
        payload: { message: 'not found' },
      }
    }
    return {
      payload,
    }
  }

  if (path === '/api/v2/family-matches') {
    return {
      payload: getFamilyMatches(url),
      headers: {
        'x-family-cache': 'fresh',
      },
    }
  }

  return null
}
