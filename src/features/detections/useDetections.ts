import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

import {
  type Detection,
  fetchDetections,
  fetchDetectionsPage,
  fetchRecentDetections,
} from '../../api/birdnet'
import { captureScrollTop, restoreScrollTop } from '../../utils/scroll'

type UseDetectionsOptions = {
  scrollContainerRef?: RefObject<HTMLElement | null>
  refreshIntervalMs?: number
  limit?: number
  pageOnly?: boolean
  recentOnly?: boolean
}

type UseDetectionsState = {
  detections: Detection[]
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
}

export const useDetections = (
  options: UseDetectionsOptions = {},
): UseDetectionsState => {
  const [detections, setDetections] = useState<Detection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    const scrollTarget = options.scrollContainerRef?.current ?? null
    const scrollTop = captureScrollTop(scrollTarget)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setIsLoading(true)
    setError(null)

    try {
      const data = options.recentOnly
        ? await fetchRecentDetections({
            limit: options.limit,
            signal: controller.signal,
          })
        : options.pageOnly
          ? await fetchDetectionsPage({
            limit: options.limit,
            signal: controller.signal,
          })
          : await fetchDetections({
              limit: options.limit,
              signal: controller.signal,
            })

      if (requestId !== requestIdRef.current) {
        return
      }

      setDetections(data)
      setLastUpdated(new Date())
      restoreScrollTop(scrollTarget, scrollTop)
    } catch (err) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return
      }

      setError(
        err instanceof Error ? err.message : 'Erkennungen konnten nicht geladen werden',
      )
    } finally {
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [options.limit, options.pageOnly, options.recentOnly, options.scrollContainerRef])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const refreshInterval = options.refreshIntervalMs ?? 60000

    if (refreshInterval <= 0) {
      return () => {
        abortRef.current?.abort()
      }
    }

    const interval = window.setInterval(() => {
      void refresh()
    }, refreshInterval)

    return () => {
      window.clearInterval(interval)
      abortRef.current?.abort()
    }
  }, [options.refreshIntervalMs, refresh])

  return {
    detections,
    isLoading,
    error,
    lastUpdated,
    refresh,
  }
}
