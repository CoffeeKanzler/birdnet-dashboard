import { useMemo } from 'react'

import { siteConfig } from '../../config/site'
import { t } from '../../i18n'
import { useArchiveDetections } from '../detections/useArchiveDetections'
import { notableSpecies } from '../../data/notableSpecies'
import SpeciesCard from '../detections/components/SpeciesCard'
import RangeLoadingPanel from '../detections/components/RangeLoadingPanel'
import { matchNotableSpecies } from './useNotableSpotlight'
import { useSummary30d } from '../detections/useSummary30d'

type RarityViewProps = {
  onSpeciesSelect?: (species: {
    commonName: string
    scientificName: string
  }) => void
  onAttributionOpen?: () => void
}

const RarityView = ({ onSpeciesSelect, onAttributionOpen }: RarityViewProps) => {
  const { rangeStart, rangeEnd } = useMemo(() => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(end.getDate() - 29)

    const endNext = new Date(end)
    endNext.setDate(end.getDate() + 1)

    return {
      rangeStart: start,
      rangeEnd: endNext,
    }
  }, [])

  const notableLookupKeys = useMemo(() => {
    const keys = new Set<string>()

    for (const species of notableSpecies) {
      const values = [
        species.commonName,
        species.scientificName ?? '',
        ...(species.aliases ?? []),
      ]

      for (const value of values) {
        const normalized = value.trim().toLowerCase()
        if (normalized) {
          keys.add(normalized)
        }
      }
    }

    return keys
  }, [])
  const notableByKey = useMemo(() => {
    const lookup = new Map<string, (typeof notableSpecies)[number]>()
    for (const species of notableSpecies) {
      const values = [species.commonName, species.scientificName ?? '', ...(species.aliases ?? [])]
      for (const value of values) {
        const key = value.trim().toLowerCase()
        if (key && !lookup.has(key)) {
          lookup.set(key, species)
        }
      }
    }
    return lookup
  }, [])

  const {
    summary,
    isLoading: isSummaryLoading,
    isPending: isSummaryPending,
    error: summaryError,
  } = useSummary30d()
  const hasReadySummary = Boolean(summary && !summary.pending)

  const {
    detections,
    isLoading: isRangeLoading,
    error: rangeError,
    refresh: refreshRange,
  } = useArchiveDetections(rangeStart, rangeEnd, {
    earlyStopLookupKeys: notableLookupKeys,
    parallelBatchSize: 5,
    enabled: Boolean(summaryError) && !isSummaryPending,
  })
  const fallbackNotableMatches = useMemo(
    () => matchNotableSpecies(notableSpecies, detections),
    [detections],
  )
  const summaryNotableMatches = useMemo(() => {
    if (!hasReadySummary || !summary) {
      return []
    }

    const matches = new Map<string, {
      species: (typeof notableSpecies)[number]
      detectionCount: number
      lastSeenAt: Date | null
    }>()
    for (const group of summary.archive.groups) {
      const keys = [group.commonName, group.scientificName].map((value) => value.trim().toLowerCase())
      const species = keys.map((key) => notableByKey.get(key)).find(Boolean)
      if (!species) {
        continue
      }
      const mapKey = `${species.commonName}||${species.scientificName ?? ''}`
      const existing = matches.get(mapKey)
      const seenAt = group.lastSeenAt ? new Date(group.lastSeenAt) : null
      if (!existing) {
        matches.set(mapKey, {
          species,
          detectionCount: group.count,
          lastSeenAt: seenAt,
        })
        continue
      }
      existing.detectionCount += group.count
      if (seenAt && (!existing.lastSeenAt || seenAt > existing.lastSeenAt)) {
        existing.lastSeenAt = seenAt
      }
    }
    return Array.from(matches.values())
  }, [hasReadySummary, notableByKey, summary])
  const notableMatches = hasReadySummary ? summaryNotableMatches : fallbackNotableMatches
  const notableList = useMemo(() => {
    if (notableMatches.length === 0) {
      return []
    }

    return [...notableMatches].sort((a, b) => {
      const aTime = a.lastSeenAt ? a.lastSeenAt.valueOf() : 0
      const bTime = b.lastSeenAt ? b.lastSeenAt.valueOf() : 0
      if (aTime !== bTime) {
        return bTime - aTime
      }

      if (a.detectionCount !== b.detectionCount) {
        return b.detectionCount - a.detectionCount
      }

      return a.species.commonName.localeCompare(b.species.commonName)
    })
  }, [notableMatches])
  const spotlightList = useMemo(() => notableList.slice(0, 10), [notableList])
  const effectiveIsLoading = (isSummaryLoading && !hasReadySummary) || isRangeLoading
  const effectiveError = summaryError ?? rangeError

  if (effectiveIsLoading && !hasReadySummary && detections.length === 0 && !effectiveError) {
    return (
      <RangeLoadingPanel
        subtitle={t('rarity.periodDescription')}
        title={t('rarity.loadingDetections')}
      />
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-8">
        <div className="space-y-4">
          {effectiveError ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              <span>
                {t('rarity.rangeError')}
                <span className="sr-only">: {effectiveError}</span>
              </span>
              <button
                className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:bg-rose-50"
                onClick={() => {
                  void refreshRange()
                }}
                type="button"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {effectiveError ? null : effectiveIsLoading && !hasReadySummary && detections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {t('rarity.loadingRange')}
            </div>
          ) : spotlightList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              {t('rarity.noHighlights')}
            </div>
          ) : (
            <div className="space-y-4">
              {effectiveIsLoading ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  {t('rarity.loadingMore')}
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {spotlightList.map((spotlightEntry, index) => {
                  const cardId = `${spotlightEntry.species.commonName}-${
                    spotlightEntry.species.scientificName ?? 'unknown'
                  }`
                  const lastSeenLabel = spotlightEntry.lastSeenAt
                    ? spotlightEntry.lastSeenAt.toLocaleDateString(siteConfig.dateLocale)
                    : t('common.unknown')

                  return (
                    <div
                      className="flex h-full flex-col gap-2"
                      key={cardId}
                    >
                      <SpeciesCard
                        commonName={spotlightEntry.species.commonName}
                        count={spotlightEntry.detectionCount}
                        highlight={index === 0}
                        onAttributionOpen={onAttributionOpen}
                        onSelect={onSpeciesSelect}
                        scientificName={spotlightEntry.species.scientificName ?? ''}
                      />
                      <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{t('rarity.lastSeen', { date: lastSeenLabel })}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default RarityView
