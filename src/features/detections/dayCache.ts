import type { Detection } from '../../api/birdnet'

const CACHE_PREFIX = 'birdnet-day-cache-v1'
const todayDateString = (): string => new Date().toISOString().slice(0, 10)
const TODAY_RANGE_TTL_MS = 10 * 60_000

type CachedPage = { detections: Detection[]; total: number }
type StoredCachedPage = CachedPage & {
  cachedAt?: number
  expiresAt?: number
}

const readStorage = (key: string): string | null => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

const writeStorage = (key: string, value: string): void => {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // Ignore storage failures (quota/private mode/etc.)
  }
}

export function dayCacheKey(startDate: string, endDate: string, offset: number): string {
  return `${CACHE_PREFIX}:${startDate}:${endDate}:${offset}`
}

export function getDayCachedPage(
  startDate: string,
  endDate: string,
  offset: number,
): CachedPage | null {
  const raw = readStorage(dayCacheKey(startDate, endDate, offset))
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as StoredCachedPage
    if (!Array.isArray(parsed?.detections) || typeof parsed?.total !== 'number') {
      return null
    }

    if (typeof parsed.expiresAt === 'number' && Date.now() > parsed.expiresAt) {
      return null
    }

    return {
      detections: parsed.detections,
      total: parsed.total,
    }
  } catch {
    return null
  }
}

export function setDayCachedPage(
  startDate: string,
  endDate: string,
  offset: number,
  data: CachedPage,
): void {
  const now = Date.now()

  if (endDate >= todayDateString()) {
    // Today-inclusive ranges are allowed, but only for a short TTL.
    writeStorage(
      dayCacheKey(startDate, endDate, offset),
      JSON.stringify({
        ...data,
        cachedAt: now,
        expiresAt: now + TODAY_RANGE_TTL_MS,
      } satisfies StoredCachedPage),
    )
    return
  }

  writeStorage(
    dayCacheKey(startDate, endDate, offset),
    JSON.stringify({
      ...data,
      cachedAt: now,
    } satisfies StoredCachedPage),
  )
}
