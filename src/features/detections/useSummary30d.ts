import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import { type Summary30d, fetchSummary30d } from '../../api/summary'
import { queryKeys } from '../../api/queryKeys'
import { toUserErrorMessage } from '../../utils/errorMessages'

type UseSummary30dState = {
  summary: Summary30d | null
  isLoading: boolean
  isPending: boolean
  error: string | null
  refresh: () => Promise<void>
}

const SUMMARY_STALE_TIME = 60 * 60_000

export const useSummary30d = (): UseSummary30dState => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.summary.thirtyDays(),
    queryFn: ({ signal }) => fetchSummary30d(signal),
    staleTime: SUMMARY_STALE_TIME,
    gcTime: 2 * SUMMARY_STALE_TIME,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => (query.state.data?.pending ? 3000 : false),
    retry: false,
    meta: {
      source: 'useSummary30d.refresh',
      mode: 'summary30d',
    },
  })

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const isPending = Boolean(data?.pending)

  return {
    summary: data ?? null,
    isLoading: isLoading || isPending,
    isPending,
    error: error
      ? toUserErrorMessage(
          error,
          'Zusammenfassung konnte nicht geladen werden',
          'BirdNET',
        )
      : null,
    refresh,
  }
}
