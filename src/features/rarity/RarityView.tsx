import { useMemo } from 'react'

import { siteConfig } from '../../config/site'
import { t } from '../../i18n'
import { formatDisplayDate, toDateInputValue } from '../../utils/dateRange'
import { useArchiveDetections } from '../detections/useArchiveDetections'
import { notableSpecies } from '../../data/notableSpecies'
import SpeciesCard from '../detections/components/SpeciesCard'
import { matchNotableSpecies } from './useNotableSpotlight'

type RarityViewProps = {
  onSpeciesSelect?: (species: {
    commonName: string
    scientificName: string
  }) => void
  onAttributionOpen?: () => void
}

const RarityView = ({ onSpeciesSelect, onAttributionOpen }: RarityViewProps) => {
  const { startDate, endDate, rangeStart, rangeEnd } = useMemo(() => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(end.getDate() - 29)

    const endNext = new Date(end)
    endNext.setDate(end.getDate() + 1)

    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(end),
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

  const {
    detections,
    isLoading: isRangeLoading,
    error: rangeError,
    refresh: refreshRange,
  } = useArchiveDetections(rangeStart, rangeEnd, {
    earlyStopLookupKeys: notableLookupKeys,
    queryMode: 'global',
  })
  const notableMatches = useMemo(
    () => matchNotableSpecies(notableSpecies, detections),
    [detections],
  )
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

  const rangeSummary = useMemo(() => {
    return t('archive.rangeSummary', { start: formatDisplayDate(startDate), end: formatDisplayDate(endDate) })
  }, [startDate, endDate])

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t('rarity.periodLabel')}
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              {t('rarity.periodHeading')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('rarity.periodDescription')}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700">
              {rangeSummary}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {isRangeLoading ? (
                <span className="flex items-center gap-2 font-semibold uppercase tracking-[0.2em] text-slate-400">
                  <span className="h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-slate-500" />
                  {t('rarity.loadingDetections')}
                </span>
              ) : rangeError ? (
                <span className="text-rose-600">{rangeError}</span>
              ) : (
                <span>{t('rarity.detectionsInRange', { count: detections.length })}</span>
              )}
              {rangeError ? (
                <button
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 font-semibold uppercase tracking-wide text-rose-600 transition hover:bg-rose-50"
                  onClick={() => {
                    void refreshRange()
                  }}
                  type="button"
                >
                  {t('common.retry')}
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {t('rarity.manualRangeNote')}
            </p>
          </div>
        </header>
      </section>
      <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t('rarity.highlightsLabel')}
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              {t('rarity.highlightsHeading')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('rarity.highlightsDescription')}
            </p>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t('rarity.matchCount', { count: spotlightList.length })}
          </p>
        </header>

        <div className="mt-5 space-y-4">
          {rangeError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {t('rarity.rangeError')}
            </div>
          ) : null}

          {rangeError ? null : isRangeLoading && detections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              {t('rarity.loadingRange')}
            </div>
          ) : spotlightList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              {t('rarity.noHighlights')}
            </div>
          ) : (
            <div className="space-y-4">
              {isRangeLoading ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
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
                      {spotlightEntry.species.description ? (
                        <div className="space-y-1 text-xs text-slate-500">
                          <p className="clamp-2">
                            {spotlightEntry.species.description}
                          </p>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-500">
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
