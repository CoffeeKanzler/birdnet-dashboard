import { useEffect, useRef, useState } from 'react'

import { fetchSpeciesPhoto, type SpeciesPhoto } from '../../api/birdImages'
import { toUserErrorMessage } from '../../utils/errorMessages'

const RETRY_START_MS = 30 * 1000

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
  const [retryTick, setRetryTick] = useState(0)
  const requestIdRef = useRef(0)
  const retryAttemptRef = useRef(0)

  useEffect(() => {
    retryAttemptRef.current = 0
  }, [commonName, scientificName])

  useEffect(() => {
    const hasName = Boolean(commonName?.trim() || scientificName?.trim())
    if (!hasName || photo || isLoading) {
      return
    }

    const attempt = retryAttemptRef.current
    const interval = RETRY_START_MS * 2 ** attempt

    const timer = window.setTimeout(() => {
      retryAttemptRef.current = attempt + 1
      setRetryTick((value) => value + 1)
    }, interval)

    return () => {
      window.clearTimeout(timer)
    }
  }, [commonName, scientificName, isLoading, photo, retryTick])

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
      forceRetry: retryTick > 0,
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
          toUserErrorMessage(err, 'Artenfoto konnte nicht geladen werden', 'Wikimedia'),
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
  }, [commonName, scientificName, retryTick])

  return {
    photo,
    isLoading,
    error,
  }
}
