import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import {
  type Detection,
  fetchSpeciesDetectionsPage,
} from '../../api/birdnet'
import { queryKeys } from '../../api/queryKeys'
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
  const normalizedCommonName = normalize(commonName)
  const normalizedScientificName = normalize(scientificName)
  const hasName = Boolean(normalizedCommonName || normalizedScientificName)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.detections.species(scientificName),
    queryFn: async ({ signal }) => {
      const page = await fetchSpeciesDetectionsPage({
        scientificName,
        limit: SPECIES_BATCH_SIZE,
        offset: 0,
        signal,
      })

      return page.detections.filter((detection) =>
        matchesSelectedSpecies(
          detection,
          normalizedCommonName,
          normalizedScientificName,
        ),
      )
    },
    enabled: hasName,
    meta: {
      source: 'useSpeciesDetections.loadBatch',
      scientificName,
    },
  })

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const loadMore = useCallback(async () => {
    return
  }, [])

  return {
    detections: data ?? [],
    isLoading,
    isLoadingMore: false,
    hasMore: false,
    error: error
      ? toUserErrorMessage(
          error,
          'Art-Erkennungen konnten nicht geladen werden.',
          'BirdNET',
        )
      : null,
    refresh,
    loadMore,
  }
}
