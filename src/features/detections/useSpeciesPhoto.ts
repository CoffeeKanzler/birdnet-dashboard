import { useQuery } from '@tanstack/react-query'

import { fetchSpeciesPhoto, type SpeciesPhoto } from '../../api/birdImages'
import { queryKeys } from '../../api/queryKeys'
import { toUserErrorMessage } from '../../utils/errorMessages'

type UseSpeciesPhotoState = {
  photo: SpeciesPhoto | null
  isLoading: boolean
  error: string | null
}

export const useSpeciesPhoto = (
  commonName?: string,
  scientificName?: string,
): UseSpeciesPhotoState => {
  const trimmedCommon = commonName?.trim() ?? ''
  const trimmedScientific = scientificName?.trim() ?? ''
  const hasName = Boolean(trimmedCommon || trimmedScientific)

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.speciesPhoto(trimmedCommon, trimmedScientific),
    queryFn: ({ signal }) =>
      fetchSpeciesPhoto({ commonName, scientificName, signal }),
    enabled: hasName,
    retry: 3,
    retryDelay: (attempt) => 30_000 * 2 ** attempt,
    staleTime: 5 * 60_000,
    meta: {
      source: 'useSpeciesPhoto.fetch',
      commonName: trimmedCommon,
      scientificName: trimmedScientific,
    },
  })

  return {
    photo: data ?? null,
    isLoading,
    error: error
      ? toUserErrorMessage(
          error,
          'Artenfoto konnte nicht geladen werden',
          'Wikimedia',
        )
      : null,
  }
}
