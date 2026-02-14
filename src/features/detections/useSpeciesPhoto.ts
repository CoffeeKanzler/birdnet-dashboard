import { useEffect, useRef, useState } from 'react'

import { fetchSpeciesPhoto, type SpeciesPhoto } from '../../api/birdImages'

type UseSpeciesPhotoState = {
  photo: SpeciesPhoto | null
  isLoading: boolean
  error: string | null
}

export const useSpeciesPhoto = (
  commonName?: string,
  scientificName?: string,
): UseSpeciesPhotoState => {
  const [photo, setPhoto] = useState<SpeciesPhoto | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setIsLoading(true)
    setError(null)

    fetchSpeciesPhoto({
      commonName,
      scientificName,
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return
        }

        setPhoto(data)
      })
      .catch((err) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return
        }

        setPhoto(null)
        setError(
          err instanceof Error
            ? err.message
            : 'Artenfoto konnte nicht geladen werden',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setIsLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [commonName, scientificName])

  return {
    photo,
    isLoading,
    error,
  }
}
