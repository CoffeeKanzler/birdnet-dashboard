import { useMemo } from 'react'

import { t } from '../../i18n'
import { useArchiveDetections } from '../detections/useArchiveDetections'
import { useSummary30d } from '../detections/useSummary30d'
import RangeLoadingPanel from '../detections/components/RangeLoadingPanel'

type StatisticsViewProps = {
  onSpeciesSelect?: (species: { commonName: string; scientificName: string }) => void
  onAttributionOpen?: () => void
}

const XAXIS_HOURS = new Set([0, 6, 12, 18, 23])

const StatisticsView = ({ onSpeciesSelect }: StatisticsViewProps) => {
  const today = useMemo(() => new Date(), [])

  const rangeStart = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - 29)
    d.setHours(0, 0, 0, 0)
    return d
  }, [today])

  const rangeEnd = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    d.setHours(0, 0, 0, 0)
    return d
  }, [today])

  const {
    summary,
    isLoading: isSummaryLoading,
    isPending: isSummaryPending,
    error: summaryError,
  } = useSummary30d()
  const hasReadySummary = Boolean(summary && !summary.pending)
  const { detections: fallbackDetections, isLoading: isFallbackLoading, error: fallbackError } =
    useArchiveDetections(rangeStart, rangeEnd, {
      parallelBatchSize: 5,
      staleTime: 5 * 60 * 1000,
      enabled: Boolean(summaryError) && !isSummaryPending,
    })

  const effectiveDetections = useMemo(
    () => (hasReadySummary ? [] : fallbackDetections),
    [fallbackDetections, hasReadySummary],
  )
  const effectiveError = summaryError ? fallbackError : null
  const effectiveIsLoading = (isSummaryLoading && !hasReadySummary) || isFallbackLoading

  const uniqueSpecies = useMemo(() => {
    if (hasReadySummary && summary) {
      return summary.stats.uniqueSpecies
    }
    return new Set(effectiveDetections.map((d) => d.scientificName)).size
  }, [effectiveDetections, hasReadySummary, summary])

  const avgConfidence = useMemo(() => {
    if (hasReadySummary && summary) {
      return Math.round(summary.stats.avgConfidence)
    }
    return effectiveDetections.length
      ? Math.round(
          (effectiveDetections.reduce((s, d) => s + d.confidence, 0) / effectiveDetections.length) *
            100,
        )
      : 0
  }, [effectiveDetections, hasReadySummary, summary])

  const topSpecies = useMemo(() => {
    if (hasReadySummary && summary) {
      return summary.stats.topSpecies.slice(0, 10)
    }

    const counts = new Map<
      string,
      { commonName: string; scientificName: string; count: number }
    >()
    for (const d of effectiveDetections) {
      const existing = counts.get(d.scientificName)
      if (existing) {
        existing.count++
      } else {
        counts.set(d.scientificName, {
          commonName: d.commonName,
          scientificName: d.scientificName,
          count: 1,
        })
      }
    }
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [effectiveDetections, hasReadySummary, summary])

  const hourlyBins = useMemo(() => {
    if (hasReadySummary && summary) {
      return summary.stats.hourlyBins.map((count, hour) => ({ hour, count }))
    }

    const bins = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))
    for (const d of effectiveDetections) {
      const h = new Date(d.timestamp).getHours()
      if (h >= 0 && h < 24) {
        bins[h].count++
      }
    }
    return bins
  }, [effectiveDetections, hasReadySummary, summary])

  const maxHourCount = useMemo(
    () => Math.max(...hourlyBins.map((b) => b.count), 1),
    [hourlyBins],
  )
  const totalDetectionsCount =
    hasReadySummary && summary ? summary.stats.totalDetections : effectiveDetections.length

  if (effectiveIsLoading && !hasReadySummary && effectiveDetections.length === 0 && !effectiveError) {
    return (
      <RangeLoadingPanel
        subtitle={t('stats.description')}
        title={t('stats.loading')}
      />
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-8">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t('stats.sectionLabel')}
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('stats.heading')}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('stats.description')}</p>
        </header>

        {effectiveError ? (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {effectiveError}
          </div>
        ) : effectiveIsLoading && effectiveDetections.length === 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700"
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
                {t('stats.totalDetections')}
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {totalDetectionsCount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
                {t('stats.uniqueSpecies')}
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {uniqueSpecies.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
                {t('stats.avgConfidence')}
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{avgConfidence} %</p>
            </div>
          </div>
        )}

        {!effectiveIsLoading && totalDetectionsCount > 0 ? (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {t('stats.sampleNote', {
              count: totalDetectionsCount.toLocaleString(),
            })}
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-8">
        <header>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('stats.topSpecies')}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('stats.topSpeciesDescription')}</p>
        </header>

        <div className="mt-5 space-y-2">
          {effectiveError ? null : effectiveIsLoading && topSpecies.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : topSpecies.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('stats.noData')}</p>
          ) : (
            <>
              {topSpecies.map((species, index) => {
                const barWidth = `${Math.round((species.count / (topSpecies[0]?.count ?? 1)) * 100)}%`
                return (
                  <button
                    key={species.scientificName}
                    className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left transition hover:border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                    onClick={() => {
                      onSpeciesSelect?.({
                        commonName: species.commonName,
                        scientificName: species.scientificName,
                      })
                    }}
                    type="button"
                  >
                    <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-400">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {species.commonName}
                      </p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{ width: barWidth }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {species.count}
                    </span>
                  </button>
                )
              })}
            </>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-8">
        <header>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('stats.hourlyActivity')}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('stats.hourlyDescription')}</p>
        </header>

        <div className="mt-6">
          {effectiveError ? null : effectiveIsLoading && effectiveDetections.length === 0 ? (
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <div className="flex items-end gap-[2px]" style={{ height: '96px' }}>
              {hourlyBins.map(({ hour, count }) => {
                const barHeight =
                  count === 0 ? 2 : Math.max(2, Math.round((count / maxHourCount) * 96))
                return (
                  <div
                    key={hour}
                    className="relative flex flex-1 flex-col items-center justify-end"
                  >
                    <div
                      className="w-full rounded-sm bg-emerald-400"
                      style={{ height: `${barHeight}px` }}
                      title={`${hour}:00 – ${count}`}
                    />
                    {XAXIS_HOURS.has(hour) ? (
                      <span className="absolute -bottom-5 text-[0.55rem] text-slate-400">
                        {hour}h
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-7" />
        </div>
      </section>
    </div>
  )
}

export default StatisticsView
