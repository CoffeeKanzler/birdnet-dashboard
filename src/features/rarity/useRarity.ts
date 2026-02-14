import { useCallback, useEffect, useRef, useState } from 'react'

import { type RaritySpecies, fetchRarityList } from '../../api/rarity'

const STALE_AFTER_DAYS = 30

type UseRarityState = {
  rarities: RaritySpecies[]
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  lastUpdated: Date | null
  dataUpdated: Date | null
  isStale: boolean
  refresh: () => Promise<void>
}

type UseRarityOptions = {
  regionCode: string
}

const parseDateString = (value: string): Date | null => {
  if (!value) {
    return null
  }

  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!year || !month || !day) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day))
}

const isOlderThanDays = (date: Date | null, days: number): boolean => {
  if (!date) {
    return false
  }

  const ageMs = Date.now() - date.getTime()
  return ageMs > days * 24 * 60 * 60 * 1000
}

const deriveDataUpdated = (rarities: RaritySpecies[]): Date | null => {
  if (rarities.length === 0) {
    return null
  }

  let latest = rarities[0]

  for (const rarity of rarities) {
    if (rarity.lastObservedAt > latest.lastObservedAt) {
      latest = rarity
    }
  }

  return parseDateString(latest.lastObserved)
}

export const useRarity = ({ regionCode }: UseRarityOptions): UseRarityState => {
  const [rarities, setRarities] = useState<RaritySpecies[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [dataUpdated, setDataUpdated] = useState<Date | null>(null)
  const [isStale, setIsStale] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const dataRef = useRef<RaritySpecies[]>([])

  const refresh = useCallback(async () => {
    const hasData = dataRef.current.length > 0

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    if (hasData) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    setError(null)

    try {
      const data = await fetchRarityList({
        regionCode,
        signal: controller.signal,
      })

      if (requestId !== requestIdRef.current) {
        return
      }

      const updated = deriveDataUpdated(data)

      dataRef.current = data
      setRarities(data)
      setLastUpdated(new Date())
      setDataUpdated(updated)
      setIsStale(isOlderThanDays(updated, STALE_AFTER_DAYS))
    } catch (err) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return
      }

      setError(err instanceof Error ? err.message : 'Unable to load rarity list')

      if (hasData) {
        setIsStale(true)
      }
    } finally {
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [regionCode])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => () => abortRef.current?.abort(), [])

  return {
    rarities,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    dataUpdated,
    isStale,
    refresh,
  }
}
