import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import {
  type Detection,
  fetchDetections,
  fetchDetectionsPage,
  fetchRecentDetections,
} from '../../api/birdnet'
import { queryKeys } from '../../api/queryKeys'
import { toUserErrorMessage } from '../../utils/errorMessages'

type UseDetectionsOptions = {
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
  const queryKey = useMemo(() => {
    if (options.recentOnly) {
      return queryKeys.detections.recent(options.limit)
    }
    if (options.pageOnly) {
      return queryKeys.detections.page(options.limit)
    }
    return queryKeys.detections.today(options.limit)
  }, [options.limit, options.pageOnly, options.recentOnly])

  const fetchFn = useCallback(
    async (signal: AbortSignal): Promise<Detection[]> => {
      if (options.recentOnly) {
        return fetchRecentDetections({ limit: options.limit, signal })
      }
      if (options.pageOnly) {
        return fetchDetectionsPage({ limit: options.limit, signal })
      }
      return fetchDetections({ limit: options.limit, signal })
    },
    [options.limit, options.pageOnly, options.recentOnly],
  )

  const { data, isLoading, error, dataUpdatedAt, refetch } = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchFn(signal),
    refetchInterval: options.refreshIntervalMs ?? 60_000,
    meta: {
      source: 'useDetections.refresh',
      mode: options.recentOnly ? 'recent' : options.pageOnly ? 'page' : 'today',
    },
  })

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  return {
    detections: data ?? [],
    isLoading,
    error: error
      ? toUserErrorMessage(
          error,
          'Erkennungen konnten nicht geladen werden',
          'BirdNET',
        )
      : null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    refresh,
  }
}
