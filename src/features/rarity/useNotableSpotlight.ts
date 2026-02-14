import { useMemo } from 'react'

import { type Detection } from '../../api/birdnet'
import { type NotableSpecies } from '../../data/notableSpecies'

export type NotableSpotlight = {
  species: NotableSpecies
  detectionCount: number
  lastSeenAt: Date | null
}

type UseNotableSpotlightInput = {
  notables: NotableSpecies[]
  detections: Detection[]
}

const normalizeName = (value: string): string => value.trim().toLowerCase()

const parseTimestamp = (value: string): number | null => {
  const parsed = new Date(value).valueOf()
  return Number.isNaN(parsed) ? null : parsed
}

const buildNotableKeys = (species: NotableSpecies): string[] => {
  const values = [
    species.commonName,
    species.scientificName ?? '',
    ...(species.aliases ?? []),
  ]

  return values
    .map((value) => normalizeName(value))
    .filter((value) => value.length > 0)
}

export const matchNotableSpecies = (
  notables: NotableSpecies[],
  detections: Detection[],
): NotableSpotlight[] => {
  if (notables.length === 0 || detections.length === 0) {
    return []
  }

  const detectionLookup = new Map<
    string,
    {
      count: number
      lastSeenAt: number | null
    }
  >()

  for (const detection of detections) {
    const keys = new Set<string>()
    const commonKey = normalizeName(detection.commonName ?? '')
    const scientificKey = normalizeName(detection.scientificName ?? '')
    if (commonKey) {
      keys.add(commonKey)
    }
    if (scientificKey) {
      keys.add(scientificKey)
    }

    if (keys.size === 0) {
      continue
    }

    const timestamp = parseTimestamp(detection.timestamp)

    for (const key of keys) {
      const existing = detectionLookup.get(key)
      if (!existing) {
        detectionLookup.set(key, {
          count: 1,
          lastSeenAt: timestamp,
        })
        continue
      }

      existing.count += 1

      if (
        timestamp !== null &&
        (existing.lastSeenAt === null || timestamp > existing.lastSeenAt)
      ) {
        existing.lastSeenAt = timestamp
      }
    }
  }

  const matches: NotableSpotlight[] = []

  for (const notable of notables) {
    const keys = buildNotableKeys(notable)
    if (keys.length === 0) {
      continue
    }

    let match: { count: number; lastSeenAt: number | null } | undefined
    for (const key of keys) {
      match = detectionLookup.get(key)
      if (match) {
        break
      }
    }

    if (match) {
      matches.push({
        species: notable,
        detectionCount: match.count,
        lastSeenAt: match.lastSeenAt ? new Date(match.lastSeenAt) : null,
      })
    }
  }

  return matches
}

export const useNotableSpotlight = ({
  notables,
  detections,
}: UseNotableSpotlightInput): NotableSpotlight | null =>
  useMemo(() => {
    if (notables.length === 0 || detections.length === 0) {
      return null
    }

    const matches = matchNotableSpecies(notables, detections)
    return matches[0] ?? null
  }, [detections, notables])
