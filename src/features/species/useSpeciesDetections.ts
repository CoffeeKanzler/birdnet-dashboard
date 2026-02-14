import { useCallback, useEffect, useRef, useState } from 'react'

import {
  type Detection,
  fetchSpeciesDetectionsPage,
} from '../../api/birdnet'
import { toUserErrorMessage } from '../../utils/errorMessages'

type UseSpeciesDetectionsState = {
  detections: Detection[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
}

const SPECIES_BATCH_SIZE = 50

const normalize = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const isPlaceholder = (value: string) => {
  return !value || value === 'unbekannte art' || value === 'unknown'
}

const matchesSelectedSpecies = (
  detection: Detection,
  selectedCommonName: string,
  selectedScientificName: string,
): boolean => {
  const detectionCommonName = normalize(detection.commonName)
  const detectionScientificName = normalize(detection.scientificName)
  const selectedCommon = normalize(selectedCommonName)
  const selectedScientific = normalize(selectedScientificName)

  const commonMatches = !isPlaceholder(selectedCommon) && detectionCommonName === selectedCommon
  const scientificMatches =
    !isPlaceholder(selectedScientific) &&
    !isPlaceholder(detectionScientificName) &&
    detectionScientificName === selectedScientific

  return scientificMatches || commonMatches
}

export const useSpeciesDetections = (
  commonName: string,
  scientificName: string,
): UseSpeciesDetectionsState => {
  const [detections, setDetections] = useState<Detection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore] = useState(false)
  const [hasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const normalizedCommonName = normalize(commonName)
  const normalizedScientificName = normalize(scientificName)

  const loadBatch = useCallback(
    async (replace: boolean) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      if (!normalizedCommonName && !normalizedScientificName) {
        setDetections([])
        setIsLoading(false)
        return
      }

      if (replace) {
        setIsLoading(true)
      }

      setError(null)

      try {
        const page = await fetchSpeciesDetectionsPage({
          scientificName,
          limit: SPECIES_BATCH_SIZE,
          offset: 0,
          signal: controller.signal,
        })

        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return
        }

        const batch = page.detections.filter((detection) => {
          return matchesSelectedSpecies(
            detection,
            normalizedCommonName,
            normalizedScientificName,
          )
        })

        setDetections(batch)
      } catch (err) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return
        }

        setError(
          toUserErrorMessage(
            err,
            'Art-Erkennungen konnten nicht geladen werden.',
            'BirdNET',
          ),
        )
      } finally {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [normalizedCommonName, normalizedScientificName, scientificName],
  )

  const refresh = useCallback(async () => {
    await loadBatch(true)
  }, [loadBatch])

  const loadMore = useCallback(async () => {
    return
  }, [])

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
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
  }
}
