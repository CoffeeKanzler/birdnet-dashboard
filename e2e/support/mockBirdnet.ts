import { type Page, type Route } from '@playwright/test'

type MockDetectionRecord = {
  id: string
  common_name: string
  scientific_name: string
  confidence: number
  timestamp: string
}

const toIso = (value: Date): string => value.toISOString()

const offsetMinutes = (base: Date, minutes: number): Date => {
  return new Date(base.valueOf() + minutes * 60_000)
}

const offsetDays = (base: Date, days: number): Date => {
  return new Date(base.valueOf() + days * 24 * 60 * 60_000)
}

const buildDetections = (): MockDetectionRecord[] => {
  const now = new Date()

  return [
    {
      id: 'd1',
      common_name: 'Amsel',
      scientific_name: 'Turdus merula',
      confidence: 0.92,
      timestamp: toIso(offsetMinutes(now, -5)),
    },
    {
      id: 'd2',
      common_name: 'Kohlmeise',
      scientific_name: 'Parus major',
      confidence: 0.89,
      timestamp: toIso(offsetMinutes(now, -12)),
    },
    {
      id: 'd3',
      common_name: 'Eisvogel',
      scientific_name: 'Alcedo atthis',
      confidence: 0.95,
      timestamp: toIso(offsetMinutes(now, -25)),
    },
    {
      id: 'd4',
      common_name: 'Singdrossel',
      scientific_name: 'Turdus philomelos',
      confidence: 0.81,
      timestamp: toIso(offsetMinutes(now, -90)),
    },
    {
      id: 'd5',
      common_name: 'Rotmilan',
      scientific_name: 'Milvus milvus',
      confidence: 0.88,
      timestamp: toIso(offsetDays(now, -3)),
    },
    {
      id: 'd6',
      common_name: 'Seeadler',
      scientific_name: 'Haliaeetus albicilla',
      confidence: 0.91,
      timestamp: toIso(offsetDays(now, -10)),
    },
    {
      id: 'd7',
      common_name: 'Blaumeise',
      scientific_name: 'Cyanistes caeruleus',
      confidence: 0.86,
      timestamp: toIso(offsetDays(now, -14)),
    },
    {
      id: 'd8',
      common_name: 'Amsel',
      scientific_name: 'Turdus merula',
      confidence: 0.73,
      timestamp: toIso(offsetDays(now, -1)),
    },
    {
      id: 'd9',
      common_name: 'Haussperling',
      scientific_name: 'Passer domesticus',
      confidence: 0.67,
      timestamp: toIso(offsetDays(now, -35)),
    },
  ].sort((a, b) => new Date(b.timestamp).valueOf() - new Date(a.timestamp).valueOf())
}

const SPECIES_INFO: Record<string, { common_name: string; rarity: string; family_common: string }> = {
  'turdus merula': {
    common_name: 'Amsel',
    rarity: 'common',
    family_common: 'Drosseln',
  },
  'turdus philomelos': {
    common_name: 'Singdrossel',
    rarity: 'common',
    family_common: 'Drosseln',
  },
  'parus major': {
    common_name: 'Kohlmeise',
    rarity: 'common',
    family_common: 'Meisen',
  },
  'cyanistes caeruleus': {
    common_name: 'Blaumeise',
    rarity: 'common',
    family_common: 'Meisen',
  },
  'alcedo atthis': {
    common_name: 'Eisvogel',
    rarity: 'rare',
    family_common: 'Eisvoegel',
  },
  'milvus milvus': {
    common_name: 'Rotmilan',
    rarity: 'uncommon',
    family_common: 'Habichtartige',
  },
  'haliaeetus albicilla': {
    common_name: 'Seeadler',
    rarity: 'rare',
    family_common: 'Habichtartige',
  },
  'passer domesticus': {
    common_name: 'Haussperling',
    rarity: 'common',
    family_common: 'Sperlinge',
  },
}

const normalize = (value: string): string => value.trim().toLowerCase()

const toRangeBounds = (startDate: string, endDate: string): { start: number; end: number } => {
  const start = new Date(`${startDate}T00:00:00.000Z`).valueOf()
  const end = new Date(`${endDate}T00:00:00.000Z`).valueOf() + 24 * 60 * 60_000
  return { start, end }
}

const paginate = <T>(items: T[], limit: number, offset: number): T[] => {
  return items.slice(offset, offset + limit)
}

const buildSummary30d = (detections: MockDetectionRecord[]) => {
  const now = new Date()
  const windowEnd = new Date(now)
  const windowStart = new Date(now)
  windowStart.setDate(windowStart.getDate() - 29)

  const startMs = windowStart.valueOf()
  const endMs = new Date(now.valueOf() + 24 * 60 * 60_000).valueOf()

  const inWindow = detections.filter((item) => {
    const value = new Date(item.timestamp).valueOf()
    return value >= startMs && value < endMs
  })

  const species = new Map<string, { common_name: string; scientific_name: string; count: number }>()
  const hourlyBins = Array.from({ length: 24 }, () => 0)
  let confidenceSum = 0

  for (const item of inWindow) {
    confidenceSum += item.confidence
    const hour = new Date(item.timestamp).getHours()
    if (hour >= 0 && hour < 24) {
      hourlyBins[hour] += 1
    }

    const key = normalize(item.scientific_name)
    const current = species.get(key)
    if (current) {
      current.count += 1
    } else {
      species.set(key, {
        common_name: item.common_name,
        scientific_name: item.scientific_name,
        count: 1,
      })
    }
  }

  const groups = Array.from(species.values()).sort((a, b) => b.count - a.count)
  const topSpecies = groups.slice(0, 10)

  return {
    generated_at: now.toISOString(),
    window_start: toIso(windowStart).slice(0, 10),
    window_end: toIso(now).slice(0, 10),
    stats: {
      total_detections: inWindow.length,
      unique_species: species.size,
      avg_confidence: inWindow.length > 0 ? (confidenceSum / inWindow.length) * 100 : 0,
      hourly_bins: hourlyBins,
      top_species: topSpecies,
    },
    archive: {
      groups,
    },
  }
}

const fulfillJson = async (route: Route, payload: unknown, status = 200): Promise<void> => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  })
}

export const installBirdnetApiMocks = async (page: Page): Promise<void> => {
  const detections = buildDetections()
  const summary = buildSummary30d(detections)

  await page.route('**/api/rest_v1/page/summary/**', async (route) => {
    await fulfillJson(route, { type: 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found' }, 404)
  })

  await page.route('**/w/api.php**', async (route) => {
    await fulfillJson(route, { query: { pages: {} } })
  })

  await page.route('**/api/v2/species**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const scientificName = normalize(requestUrl.searchParams.get('scientific_name') ?? '')
    const match = SPECIES_INFO[scientificName]

    if (!match) {
      await fulfillJson(route, { message: 'not found' }, 404)
      return
    }

    await fulfillJson(route, {
      scientific_name: scientificName,
      common_name: match.common_name,
      rarity: {
        status: match.rarity,
      },
      taxonomy: {
        family_common: match.family_common,
      },
      metadata: {
        source: 'mock',
      },
    })
  })

  await page.route('**/api/v2/summary/30d', async (route) => {
    await fulfillJson(route, summary)
  })

  // Register generic detections route BEFORE the more specific recent route.
  // Playwright matches routes in reverse registration order (last wins),
  // so the recent route must come after to take precedence over the generic one.
  await page.route('**/api/v2/detections**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const limit = Number(requestUrl.searchParams.get('numResults') ?? '100')
    const offset = Number(requestUrl.searchParams.get('offset') ?? '0')
    const queryType = requestUrl.searchParams.get('queryType')
    const search = requestUrl.searchParams.get('search')
    const startDate = requestUrl.searchParams.get('start_date')
    const endDate = requestUrl.searchParams.get('end_date')

    let filtered = detections

    if (queryType === 'search' && search) {
      const needle = normalize(search)
      filtered = detections.filter((item) => {
        return normalize(item.scientific_name) === needle
      })
    }

    if (startDate && endDate) {
      const bounds = toRangeBounds(startDate, endDate)
      filtered = filtered.filter((item) => {
        const value = new Date(item.timestamp).valueOf()
        return value >= bounds.start && value < bounds.end
      })
    }

    const pageItems = paginate(filtered, limit, offset)
    await fulfillJson(route, {
      data: pageItems,
      total: filtered.length,
    })
  })

  // Recent detections route — registered last so it takes precedence
  // over the generic detections route above for /api/v2/detections/recent URLs.
  await page.route('**/api/v2/detections/recent**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const limit = Number(requestUrl.searchParams.get('limit') ?? '100')
    const payload = paginate(detections, limit, 0)
    await fulfillJson(route, payload)
  })
}
