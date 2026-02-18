// @ts-check

import { createServer } from 'node:http'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * @typedef {Record<string, unknown>} DetectionRecord
 * @typedef {{ common_name: string, scientific_name: string }} SpeciesEntry
 * @typedef {{ detections: DetectionRecord[], total: number }} DetectionsPage
 * @typedef {{ payload: SummaryPayload, generatedAtMs: number } | null} SummaryCacheDiskEntry
 * @typedef {{ generatedAtMs: number, detections: DetectionRecord[] } | null} RecentCacheDiskEntry
 * @typedef {{ inFlight: Promise<SummaryPayload> | null }} SummaryCacheState
 * @typedef {{
 *   generated_at: string,
 *   window_start: string,
 *   window_end: string,
 *   stats: {
 *     total_detections: number,
 *     unique_species: number,
 *     avg_confidence: number,
 *     hourly_bins: number[],
 *     top_species: Array<SpeciesEntry & { count: number }>
 *   },
 *   archive: {
 *     groups: Array<SpeciesEntry & { count: number, last_seen_at?: string }>
 *   }
 * }} SummaryPayload
 */

const PORT = Number(process.env.PORT ?? '3001')
const HOST = process.env.HOST ?? '127.0.0.1'
const API_BASE = (process.env.BIRDNET_API_BASE_URL ?? 'http://birdnet-go:8080').replace(/\/$/, '')
const SUMMARY_TTL_MS = 60 * 60_000
const PAGE_LIMIT = 500
const PAGE_FETCH_CONCURRENCY = 4
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS ?? '12000')
const READY_CHECK_TIMEOUT_MS = Number(process.env.READY_CHECK_TIMEOUT_MS ?? '3000')
const READYZ_CACHE_MS = Number(process.env.READYZ_CACHE_MS ?? '5000')
const MAX_SUMMARY_PAGES = Number(process.env.MAX_SUMMARY_PAGES ?? '5000')
let SUMMARY_CACHE_FILE = process.env.SUMMARY_CACHE_FILE ?? '/cache/summary-30d.json'
let RECENT_CACHE_FILE = process.env.RECENT_CACHE_FILE ?? '/cache/recent-detections.json'
const RECENT_SNAPSHOT_LIMIT = Number(process.env.RECENT_SNAPSHOT_LIMIT ?? '2000')
const RECENT_REFRESH_MS = Number(process.env.RECENT_REFRESH_MS ?? `${15 * 60_000}`)
const CACHEZ_STATUS_CACHE_MS = Number(process.env.CACHEZ_STATUS_CACHE_MS ?? '10000')
const CACHE_REFRESH_TICK_MS = Number(process.env.CACHE_REFRESH_TICK_MS ?? '60000')
const FALLBACK_CACHE_ROOT = '/tmp/birdnet-dashboard-cache'

// Security headers are applied by nginx for deployed traffic.
const securityHeaders = Object.freeze({})

/** @type {SummaryCacheState} */
const summaryCache = {
  inFlight: null,
}

/** @type {{ checkedAtMs: number, upstreamOk: boolean } | null} */
let upstreamReadyCache = null

/** @type {{ checkedAtMs: number, statusCode: number, payload: Record<string, unknown> } | null} */
let cacheHealthCache = null

/** @type {Promise<void> | null} */
let recentRefreshInFlight = null

const INTERNAL_PROXY_HEADER = 'x-internal-summary-proxy'
const INTERNAL_PROXY_VALUE = (() => {
  const configured = process.env.INTERNAL_PROXY_VALUE?.trim()
  if (configured) {
    return configured
  }
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  throw new Error('INTERNAL_PROXY_VALUE is required when crypto.randomUUID is unavailable')
})()

let cachePathsValidated = false

/**
 * @param {string} candidatePath
 * @param {string} fallbackName
 * @returns {Promise<string>}
 */
const resolveWritableCachePath = async (candidatePath, fallbackName) => {
  const probePath = `${candidatePath}.probe.${process.pid}`
  try {
    await mkdir(dirname(candidatePath), { recursive: true })
    await writeFile(probePath, 'ok', 'utf8')
    await unlink(probePath)
    return candidatePath
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'EROFS')
    ) {
      const fallbackPath = `${FALLBACK_CACHE_ROOT}/${fallbackName}`
      await mkdir(dirname(fallbackPath), { recursive: true })
      console.error(`cache path not writable, falling back: ${candidatePath} -> ${fallbackPath}`)
      return fallbackPath
    }
    throw error
  }
}

const ensureCachePaths = async () => {
  if (cachePathsValidated) {
    return
  }
  SUMMARY_CACHE_FILE = await resolveWritableCachePath(SUMMARY_CACHE_FILE, 'summary-30d.json')
  RECENT_CACHE_FILE = await resolveWritableCachePath(RECENT_CACHE_FILE, 'recent-detections.json')
  cachePathsValidated = true
}

/**
 * @param {Date} value
 * @returns {string}
 */
const toIsoDate = (value) => value.toISOString().slice(0, 10)

/**
 * @param {unknown} payload
 * @returns {number | null}
 */
const toGeneratedAtMs = (payload) => {
  const value = new Date(payload?.generated_at ?? '').valueOf()
  return Number.isFinite(value) ? value : null
}

/** @returns {Promise<SummaryCacheDiskEntry>} */
const loadSummaryFromDisk = async () => {
  try {
    const raw = await readFile(SUMMARY_CACHE_FILE, 'utf8')
    const payload = JSON.parse(raw)
    const generatedAtMs = toGeneratedAtMs(payload)
    if (!generatedAtMs) {
      return null
    }
    return {
      payload,
      generatedAtMs,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    console.error('summary cache read failed', error)
    return null
  }
}

/**
 * @param {SummaryPayload} payload
 * @returns {Promise<void>}
 */
const persistSummaryToDisk = async (payload) => {
  const cacheDir = dirname(SUMMARY_CACHE_FILE)
  await mkdir(cacheDir, { recursive: true })
  const tempPath = `${SUMMARY_CACHE_FILE}.${process.pid}.tmp`
  const serialized = JSON.stringify(payload)
  await writeFile(tempPath, serialized, 'utf8')
  await rename(tempPath, SUMMARY_CACHE_FILE)
  cacheHealthCache = null
}

/** @returns {Promise<RecentCacheDiskEntry>} */
const loadRecentFromDisk = async () => {
  try {
    const raw = await readFile(RECENT_CACHE_FILE, 'utf8')
    const payload = JSON.parse(raw)
    const generatedAtMs = toGeneratedAtMs(payload)
    const detections = Array.isArray(payload?.detections) ? payload.detections : null
    if (!generatedAtMs || !detections) {
      return null
    }
    return {
      generatedAtMs,
      detections,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    console.error('recent cache read failed', error)
    return null
  }
}

/**
 * @param {DetectionRecord[]} detections
 * @returns {Promise<void>}
 */
const persistRecentToDisk = async (detections) => {
  const cacheDir = dirname(RECENT_CACHE_FILE)
  await mkdir(cacheDir, { recursive: true })
  const payload = {
    generated_at: new Date().toISOString(),
    detections,
  }
  const tempPath = `${RECENT_CACHE_FILE}.${process.pid}.tmp`
  await writeFile(tempPath, JSON.stringify(payload), 'utf8')
  await rename(tempPath, RECENT_CACHE_FILE)
  cacheHealthCache = null
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} payload
 * @param {Record<string, string>} [extraHeaders]
 */
const json = (res, status, payload, extraHeaders = {}) => {
  res.writeHead(status, {
    ...securityHeaders,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  })
  res.end(JSON.stringify(payload))
}

const getHourlyWindow = () => {
  const now = new Date()
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - 29)
  const startDate = toIsoDate(start)
  const endDate = toIsoDate(now)

  return {
    now,
    startDate,
    endDate,
  }
}

/**
 * @param {unknown} payload
 * @returns {DetectionsPage}
 */
const extractDetections = (payload) => {
  if (Array.isArray(payload)) {
    return { detections: payload, total: payload.length }
  }
  const detections = payload?.data ?? payload?.detections ?? payload?.items ?? []
  const total = Number(payload?.total ?? detections.length)
  return {
    detections: Array.isArray(detections) ? detections : [],
    total,
  }
}

/**
 * @param {DetectionRecord} detection
 * @returns {number | null}
 */
const getTimestamp = (detection) => {
  const raw =
    detection?.timestamp ??
    detection?.endTime ??
    detection?.beginTime ??
    detection?.datetime ??
    detection?.created_at ??
    detection?.createdAt ??
    detection?.date ??
    detection?.time
  if (!raw) {
    return null
  }
  const value = new Date(raw).valueOf()
  return Number.isNaN(value) ? null : value
}

/**
 * @param {DetectionRecord} a
 * @param {DetectionRecord} b
 * @returns {number}
 */
const compareByNewest = (a, b) => {
  return (getTimestamp(b) ?? 0) - (getTimestamp(a) ?? 0)
}

/**
 * @param {string | null | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }
  return Math.floor(parsed)
}

/**
 * @param {DetectionRecord} detection
 * @returns {number}
 */
const getConfidence = (detection) => {
  const value = Number(detection?.confidence ?? 0)
  if (!Number.isFinite(value)) {
    return 0
  }
  return value > 1 ? value : value * 100
}

/**
 * @param {DetectionRecord} detection
 * @returns {SpeciesEntry}
 */
const toSpeciesEntry = (detection) => ({
  common_name: String(detection?.common_name ?? detection?.commonName ?? 'Unbekannte Art'),
  scientific_name: String(
    detection?.scientific_name ?? detection?.scientificName ?? 'Unbekannte Art',
  ),
})

/**
 * @param {string} startDate
 * @param {string} endDate
 * @param {number} offset
 * @returns {Promise<DetectionsPage>}
 */
const fetchRangePage = async (startDate, endDate, offset) => {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    numResults: String(PAGE_LIMIT),
    offset: String(offset),
  })
  const response = await fetch(`${API_BASE}/api/v2/detections?${params.toString()}`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Range page fetch failed: HTTP ${response.status}`)
  }
  const payload = await response.json()
  return extractDetections(payload)
}

/**
 * @param {number} limit
 * @returns {Promise<DetectionRecord[]>}
 */
const fetchRecentFromUpstream = async (limit) => {
  const params = new URLSearchParams({
    limit: String(limit),
  })
  const response = await fetch(`${API_BASE}/api/v2/detections/recent?${params.toString()}`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Recent fetch failed: HTTP ${response.status}`)
  }
  const payload = await response.json()
  if (!Array.isArray(payload)) {
    throw new Error('Recent fetch failed: non-array payload')
  }
  return payload.sort(compareByNewest)
}

const refreshRecentSnapshot = async () => {
  const detections = await fetchRecentFromUpstream(RECENT_SNAPSHOT_LIMIT)
  await persistRecentToDisk(detections)
}

const startRecentRefresh = () => {
  if (recentRefreshInFlight) {
    return recentRefreshInFlight
  }
  recentRefreshInFlight = refreshRecentSnapshot().finally(() => {
    recentRefreshInFlight = null
  })
  return recentRefreshInFlight
}

const buildSummaryPayload = async () => {
  const { now, startDate, endDate } = getHourlyWindow()
  const windowStartMs = new Date(`${startDate}T00:00:00.000Z`).valueOf()
  const windowEndMsExclusive = new Date(`${endDate}T00:00:00.000Z`).valueOf() + 24 * 60 * 60 * 1000
  let pageIndex = 0
  let pagesFetched = 0
  let done = false
  let totalDetections = 0
  let confidenceSum = 0
  const speciesCount = new Map()
  const archiveSpeciesCount = new Map()
  const hourlyBins = Array.from({ length: 24 }, () => 0)

  while (!done) {
    if (pagesFetched >= MAX_SUMMARY_PAGES) {
      throw new Error('Summary fetch exceeded configured page limit')
    }

    const pageIndexes = Array.from({ length: PAGE_FETCH_CONCURRENCY }, (_, index) => pageIndex + index)
    const pages = await Promise.all(
      pageIndexes.map((currentIndex) => fetchRangePage(startDate, endDate, currentIndex * PAGE_LIMIT)),
    )

    pagesFetched += pages.length

    for (const page of pages) {
      if (page.detections.length === 0) {
        done = true
        break
      }

      for (const detection of page.detections) {
        const species = toSpeciesEntry(detection)
        const key = `${species.scientific_name}||${species.common_name}`
        speciesCount.set(key, {
          ...species,
          count: (speciesCount.get(key)?.count ?? 0) + 1,
        })

        const timestamp = getTimestamp(detection)
        if (timestamp !== null) {
          const hour = new Date(timestamp).getUTCHours()
          if (hour >= 0 && hour < 24) {
            hourlyBins[hour] += 1
          }

          if (timestamp >= windowStartMs && timestamp < windowEndMsExclusive) {
            const archiveEntry = archiveSpeciesCount.get(key)
            archiveSpeciesCount.set(key, {
              ...species,
              count: (archiveEntry?.count ?? 0) + 1,
              last_seen_at:
                archiveEntry?.last_seen_at && archiveEntry.last_seen_at > timestamp
                  ? archiveEntry.last_seen_at
                  : timestamp,
            })
          }
        }

        confidenceSum += getConfidence(detection)
        totalDetections += 1
      }

      if (page.detections.length < PAGE_LIMIT) {
        done = true
        break
      }
    }

    pageIndex += PAGE_FETCH_CONCURRENCY
  }

  const groups = Array.from(speciesCount.values()).sort((a, b) => b.count - a.count)
  const archiveGroups = Array.from(archiveSpeciesCount.values())
    .sort((a, b) => b.count - a.count)
    .map((group) => ({
      ...group,
      last_seen_at:
        typeof group.last_seen_at === 'number'
          ? new Date(group.last_seen_at).toISOString()
          : undefined,
    }))
  const avgConfidence = totalDetections > 0 ? confidenceSum / totalDetections : 0

  return {
    generated_at: now.toISOString(),
    window_start: startDate,
    window_end: endDate,
    stats: {
      total_detections: totalDetections,
      unique_species: speciesCount.size,
      avg_confidence: avgConfidence,
      hourly_bins: hourlyBins,
      top_species: groups.slice(0, 10),
    },
    archive: {
      groups: archiveGroups,
    },
  }
}

const startSummaryRefresh = () => {
  if (summaryCache.inFlight) {
    return summaryCache.inFlight
  }

  summaryCache.inFlight = buildSummaryPayload()
    .then(async (payload) => {
      await persistSummaryToDisk(payload)
      return payload
    })
    .finally(() => {
      summaryCache.inFlight = null
    })

  return summaryCache.inFlight
}

const getSummaryState = async () => {
  const now = Date.now()
  const summary = await loadSummaryFromDisk()
  const hasPayload = Boolean(summary?.payload)
  const isFresh = Boolean(summary && now - summary.generatedAtMs < SUMMARY_TTL_MS)
  return {
    hasPayload,
    isFresh,
    payload: summary?.payload ?? null,
  }
}

const refreshSummaryIfStale = async () => {
  const state = await getSummaryState()
  if (!state.hasPayload || !state.isFresh) {
    await startSummaryRefresh()
  }
}

const refreshRecentIfStale = async () => {
  const recent = await loadRecentFromDisk()
  if (!recent || Date.now() - recent.generatedAtMs >= RECENT_REFRESH_MS) {
    await startRecentRefresh()
  }
}

const bootstrapCaches = async () => {
  await ensureCachePaths()

  await Promise.all([
    refreshSummaryIfStale().catch((error) => {
      console.error('summary prewarm failed', error)
    }),
    refreshRecentIfStale().catch((error) => {
      console.error('recent prewarm failed', error)
    }),
  ])
}

const proxyUpstreamJson = async (pathWithQuery) => {
  const response = await fetch(`${API_BASE}${pathWithQuery}`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  const payload = response.status === 204 ? '' : await response.text()
  return {
    status: response.status,
    payload,
  }
}

const fallbackRecentDetections = async (limit) => {
  const recent = await loadRecentFromDisk()
  if (!recent) {
    return null
  }

  return recent.detections
    .slice()
    .sort(compareByNewest)
    .slice(0, limit)
}

const fallbackDetectionsPage = async (url) => {
  const recent = await loadRecentFromDisk()
  if (!recent) {
    return null
  }

  let detections = recent.detections.slice().sort(compareByNewest)
  const queryType = url.searchParams.get('queryType')
  const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()
  if (queryType === 'search' && search) {
    detections = detections.filter((entry) => {
      const commonName = String(entry?.common_name ?? entry?.commonName ?? '').toLowerCase()
      const scientificName = String(entry?.scientific_name ?? entry?.scientificName ?? '').toLowerCase()
      return commonName.includes(search) || scientificName.includes(search)
    })
  }

  const startDate = url.searchParams.get('start_date')
  const endDate = url.searchParams.get('end_date')
  if (startDate && endDate) {
    const startMs = new Date(`${startDate}T00:00:00.000Z`).valueOf()
    const endExclusiveMs = new Date(`${endDate}T00:00:00.000Z`).valueOf() + 24 * 60 * 60 * 1000
    detections = detections.filter((entry) => {
      const timestamp = getTimestamp(entry)
      return timestamp !== null && timestamp >= startMs && timestamp < endExclusiveMs
    })
  }

  const numResults = parsePositiveInt(url.searchParams.get('numResults'), PAGE_LIMIT)
  const offset = parsePositiveInt(url.searchParams.get('offset'), 0)
  return detections.slice(offset, offset + numResults)
}

const checkUpstreamReady = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/v2/detections/recent?limit=1`, {
      signal: AbortSignal.timeout(READY_CHECK_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}

const getUpstreamReadyState = async () => {
  const now = Date.now()
  if (upstreamReadyCache && now - upstreamReadyCache.checkedAtMs < READYZ_CACHE_MS) {
    return upstreamReadyCache.upstreamOk
  }
  const upstreamOk = await checkUpstreamReady()
  upstreamReadyCache = {
    checkedAtMs: now,
    upstreamOk,
  }
  return upstreamOk
}

const buildCacheHealthState = async () => {
  const now = Date.now()
  const summary = await loadSummaryFromDisk()
  const recent = await loadRecentFromDisk()
  const summaryAgeMs = summary ? Math.max(0, now - summary.generatedAtMs) : null
  const recentAgeMs = recent ? Math.max(0, now - recent.generatedAtMs) : null
  const summaryFresh = Boolean(summary && summaryAgeMs !== null && summaryAgeMs < SUMMARY_TTL_MS)
  const recentFresh = Boolean(recent && recentAgeMs !== null && recentAgeMs < RECENT_REFRESH_MS)
  const healthy = summaryFresh && recentFresh

  return {
    statusCode: healthy ? 200 : 503,
    payload: {
      status: healthy ? 'healthy' : 'degraded',
      summary: {
        present: Boolean(summary),
        fresh: summaryFresh,
        generated_at: toIsoOrNull(summary?.generatedAtMs ?? null),
        age_ms: summaryAgeMs,
        ttl_ms: SUMMARY_TTL_MS,
      },
      recent: {
        present: Boolean(recent),
        fresh: recentFresh,
        generated_at: toIsoOrNull(recent?.generatedAtMs ?? null),
        age_ms: recentAgeMs,
        ttl_ms: RECENT_REFRESH_MS,
      },
    },
  }
}

const getCacheHealthState = async () => {
  const now = Date.now()
  if (cacheHealthCache && now - cacheHealthCache.checkedAtMs < CACHEZ_STATUS_CACHE_MS) {
    return {
      statusCode: cacheHealthCache.statusCode,
      payload: cacheHealthCache.payload,
    }
  }
  const state = await buildCacheHealthState()
  cacheHealthCache = {
    checkedAtMs: now,
    statusCode: state.statusCode,
    payload: state.payload,
  }
  return state
}

const toIsoOrNull = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return new Date(value).toISOString()
}

const server = createServer(async (req, res) => {
  try {
    await ensureCachePaths()

    if (!req.url || !req.method) {
      res.writeHead(400, securityHeaders)
      res.end('Bad Request')
      return
    }

    const url = new URL(req.url, 'http://localhost')
    const pathname = url.pathname

    if (pathname === '/healthz') {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, {
          ...securityHeaders,
          allow: 'GET, HEAD',
        })
        res.end()
        return
      }

      if (req.method === 'HEAD') {
        res.writeHead(200, {
          ...securityHeaders,
          'cache-control': 'no-store',
        })
        res.end()
        return
      }

      json(res, 200, { status: 'ok' })
      return
    }

    if (pathname === '/readyz') {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, {
          ...securityHeaders,
          allow: 'GET, HEAD',
        })
        res.end()
        return
      }

      const upstreamOk = await getUpstreamReadyState()
      const summaryState = await getSummaryState()
      const ready = upstreamOk || summaryState.hasPayload
      const statusCode = ready ? 200 : 503

      if (req.method === 'HEAD') {
        res.writeHead(statusCode, {
          ...securityHeaders,
          'cache-control': 'no-store',
        })
        res.end()
        return
      }

      json(res, statusCode, {
        status: ready ? 'ready' : 'not_ready',
        upstream_ok: upstreamOk,
        summary_cache_present: summaryState.hasPayload,
        summary_cache_fresh: summaryState.isFresh,
      })
      return
    }

    if (pathname === '/cachez') {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, {
          ...securityHeaders,
          allow: 'GET, HEAD',
        })
        res.end()
        return
      }

      const healthState = await getCacheHealthState()
      const statusCode = healthState.statusCode

      if (req.method === 'HEAD') {
        res.writeHead(statusCode, {
          ...securityHeaders,
          'cache-control': 'no-store',
        })
        res.end()
        return
      }

      json(res, statusCode, healthState.payload)
      return
    }

    if (req.headers[INTERNAL_PROXY_HEADER] !== INTERNAL_PROXY_VALUE) {
      json(res, 403, { message: 'forbidden' })
      return
    }

    if (pathname === '/api/v2/detections/recent') {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, {
          ...securityHeaders,
          allow: 'GET, HEAD, OPTIONS',
        })
        res.end()
        return
      }

      const limit = parsePositiveInt(url.searchParams.get('limit'), 100)
      try {
        const upstream = await proxyUpstreamJson(`${pathname}?${url.searchParams.toString()}`)
        if (upstream.status < 500) {
          res.writeHead(upstream.status, {
            ...securityHeaders,
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'x-detections-cache': 'live',
          })
          if (req.method !== 'HEAD') {
            res.end(upstream.payload)
          } else {
            res.end()
          }
          return
        }
      } catch {
        // Fall through to snapshot.
      }

      const fallback = await fallbackRecentDetections(limit)
      if (!fallback) {
        json(res, 503, { message: 'upstream_unavailable' })
        return
      }

      if (req.method === 'HEAD') {
        res.writeHead(200, {
          ...securityHeaders,
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-detections-cache': 'stale',
        })
        res.end()
        return
      }

      json(res, 200, fallback, {
        'x-detections-cache': 'stale',
      })
      return
    }

    if (pathname === '/api/v2/detections') {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, {
          ...securityHeaders,
          allow: 'GET, HEAD, OPTIONS',
        })
        res.end()
        return
      }

      try {
        const upstream = await proxyUpstreamJson(
          url.search ? `${pathname}?${url.searchParams.toString()}` : pathname,
        )
        if (upstream.status < 500) {
          res.writeHead(upstream.status, {
            ...securityHeaders,
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'x-detections-cache': 'live',
          })
          if (req.method !== 'HEAD') {
            res.end(upstream.payload)
          } else {
            res.end()
          }
          return
        }
      } catch {
        // Fall through to snapshot.
      }

      const fallback = await fallbackDetectionsPage(url)
      if (!fallback) {
        json(res, 503, { message: 'upstream_unavailable' })
        return
      }

      if (req.method === 'HEAD') {
        res.writeHead(200, {
          ...securityHeaders,
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-detections-cache': 'stale',
        })
        res.end()
        return
      }

      json(res, 200, fallback, {
        'x-detections-cache': 'stale',
      })
      return
    }

    if (pathname === '/api/v2/summary/30d') {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, {
          ...securityHeaders,
          allow: 'GET, HEAD, OPTIONS',
        })
        res.end()
        return
      }

      const state = await getSummaryState()
      if (state.isFresh && state.payload) {
        if (req.method === 'HEAD') {
          res.writeHead(200, {
            ...securityHeaders,
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'x-summary-cache': 'fresh',
          })
          res.end()
          return
        }
        json(res, 200, state.payload, {
          'x-summary-cache': 'fresh',
        })
        return
      }

      if (state.hasPayload && state.payload) {
        startSummaryRefresh().catch(() => {})
        if (req.method === 'HEAD') {
          res.writeHead(200, {
            ...securityHeaders,
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'x-summary-cache': 'stale',
          })
          res.end()
          return
        }
        json(res, 200, state.payload, {
          'x-summary-cache': 'stale',
        })
        return
      }

      startSummaryRefresh().catch(() => {})
      if (req.method === 'HEAD') {
        res.writeHead(202, {
          ...securityHeaders,
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'retry-after': '3',
          'x-summary-cache': 'warming',
        })
        res.end()
        return
      }
      json(
        res,
        202,
        {
          pending: true,
          message: 'summary_warming',
          retry_after_ms: 3000,
        },
        {
          'retry-after': '3',
          'x-summary-cache': 'warming',
        },
      )
      return
    }
    json(res, 404, { message: 'not found' })
  } catch (error) {
    console.error('request handling failed', error)
    json(res, 500, { message: 'internal_error' })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`birdnet-dashboard wrapper listening on ${HOST}:${PORT}`)
  bootstrapCaches().catch((error) => {
    console.error('cache bootstrap failed', error)
  })
  setInterval(() => {
    refreshSummaryIfStale().catch((error) => {
      console.error('summary background refresh failed', error)
    })
  }, CACHE_REFRESH_TICK_MS)
  setInterval(() => {
    refreshRecentIfStale().catch((error) => {
      console.error('recent background refresh failed', error)
    })
  }, CACHE_REFRESH_TICK_MS)
})
