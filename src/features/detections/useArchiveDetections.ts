import { useCallback, useEffect, useRef, useState } from 'react'

import {
  type Detection,
  fetchDetectionsPage,
  fetchDetectionsRangePage,
} from '../../api/birdnet'
import { reportFrontendError } from '../../observability/errorReporter'
import { toUserErrorMessage } from '../../utils/errorMessages'

type UseArchiveDetectionsState = {
  detections: Detection[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

type UseArchiveDetectionsOptions = {
  earlyStopLookupKeys?: Set<string>
  earlyStopTarget?: number
  queryMode?: 'range' | 'global'
}

const PAGE_LIMIT = 500
const MAX_RANGE_PAGES = 200

const toTimestamp = (value: string): number | null => {
  const parsed = new Date(value).valueOf()
  return Number.isNaN(parsed) ? null : parsed
}

export const useArchiveDetections = (
  rangeStart: Date,
  rangeEnd: Date,
  options: UseArchiveDetectionsOptions = {},
): UseArchiveDetectionsState => {
  const [detections, setDetections] = useState<Detection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setIsLoading(true)
    setError(null)
    setDetections([])

    const startTime = rangeStart.valueOf()
    const endTime = rangeEnd.valueOf()

    if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
      setDetections([])
      setIsLoading(false)
      return
    }

    try {
      const collected: Detection[] = []
      let offset = 0
      const startDate = rangeStart.toISOString().slice(0, 10)
      const endDate = new Date(endTime - 1).toISOString().slice(0, 10)
      const seenPageSignatures = new Set<string>()
      const seenDetectionKeys = new Set<string>()
      const matchedLookupKeys = new Set<string>()
      let pageCount = 0

      while (pageCount < MAX_RANGE_PAGES) {

        const mode = options.queryMode ?? 'range'
        const page =
          mode === 'global'
            ? {
                detections: await fetchDetectionsPage({
                  limit: PAGE_LIMIT,
                  offset,
                  signal: controller.signal,
                }),
                total: Number.MAX_SAFE_INTEGER,
              }
            : await fetchDetectionsRangePage({
                startDate,
                endDate,
                limit: PAGE_LIMIT,
                offset,
                signal: controller.signal,
              })

        if (requestId !== requestIdRef.current) {
          return
        }

        if (page.detections.length === 0) {
          break
        }

        const firstId = page.detections[0]?.id ?? 'none'
        const lastId = page.detections[page.detections.length - 1]?.id ?? 'none'
        const signature = `${offset}|${firstId}|${lastId}|${page.detections.length}`
        if (seenPageSignatures.has(signature)) {
          break
        }
        seenPageSignatures.add(signature)

        let newItemsInPage = 0
        for (const detection of page.detections) {
          const key = detection.id
            ? String(detection.id)
            : `${detection.timestamp}|${detection.commonName}|${detection.scientificName}`

          if (seenDetectionKeys.has(key)) {
            continue
          }

          if (mode === 'global') {
            const timestamp = toTimestamp(detection.timestamp)
            if (timestamp === null || timestamp < startTime || timestamp >= endTime) {
              continue
            }
          }

          seenDetectionKeys.add(key)
          collected.push(detection)
          newItemsInPage += 1

          if (options.earlyStopLookupKeys && options.earlyStopTarget) {
            const commonName = detection.commonName?.trim().toLowerCase()
            const scientificName = detection.scientificName?.trim().toLowerCase()

            if (commonName && options.earlyStopLookupKeys.has(commonName)) {
              matchedLookupKeys.add(commonName)
            }

            if (
              scientificName &&
              options.earlyStopLookupKeys.has(scientificName)
            ) {
              matchedLookupKeys.add(scientificName)
            }
          }
        }

        pageCount += 1

        if (newItemsInPage > 0) {
          setDetections([...collected])
        }

        if (
          options.earlyStopLookupKeys &&
          options.earlyStopTarget &&
          matchedLookupKeys.size >= options.earlyStopTarget
        ) {
          break
        }

        if (mode === 'global') {
          const oldest = page.detections[page.detections.length - 1]
          const oldestTimestamp = toTimestamp(oldest?.timestamp ?? '')
          if (oldestTimestamp !== null && oldestTimestamp < startTime) {
            break
          }
        }

        if (newItemsInPage === 0 || page.detections.length < PAGE_LIMIT) {
          break
        }

        offset += PAGE_LIMIT
      }

      setDetections(collected)
    } catch (err) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return
      }

      reportFrontendError({
        source: 'useArchiveDetections.refresh',
        error: err,
        metadata: {
          mode: options.queryMode ?? 'range',
        },
      })

      setError(
        toUserErrorMessage(
          err,
          'Archiv-Erkennungen konnten nicht geladen werden',
          'BirdNET',
        ),
      )
    } finally {
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [
    options.earlyStopLookupKeys,
    options.earlyStopTarget,
    options.queryMode,
    rangeEnd,
    rangeStart,
  ])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return {
    detections,
    isLoading,
    error,
    refresh,
  }
}
