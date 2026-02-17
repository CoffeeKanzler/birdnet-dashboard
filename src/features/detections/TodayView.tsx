import { useMemo, useState, type RefObject } from 'react'

import { type Detection } from '../../api/birdnet'
import { siteConfig } from '../../config/site'
import { t } from '../../i18n'
import SpeciesCard from './components/SpeciesCard'

const formatTimestamp = (value: string): string => {
  if (!value) {
    return t('common.unknownTime')
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    return value
  }

  return new Intl.DateTimeFormat(siteConfig.dateLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

const formatConfidence = (value: number): string => {
  if (Number.isNaN(value)) {
    return '0 %'
  }

  const percent = Math.round((value > 1 ? value : value * 100) * 10) / 10
  return `${percent} %`
}

const getConfidenceBadgeClassName = (value: number): string => {
  if (value >= 0.8) {
    return 'bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/25 dark:text-emerald-300'
  }

  if (value >= 0.5) {
    return 'bg-amber-500/15 text-amber-500 dark:bg-amber-500/25 dark:text-amber-300'
  }

  return 'bg-rose-500/15 text-rose-500 dark:bg-rose-500/25 dark:text-rose-300'
}

type TodayViewProps = {
  detections: Detection[]
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
  scrollContainerRef: RefObject<HTMLDivElement>
  onSpeciesSelect?: (species: {
    commonName: string
    scientificName: string
  }) => void
  onAttributionOpen?: () => void
}

const TodayView = ({
  detections,
  isLoading,
  error,
  lastUpdated,
  refresh,
  scrollContainerRef,
  onSpeciesSelect,
  onAttributionOpen,
}: TodayViewProps) => {
  const [speciesFilter, setSpeciesFilter] = useState('')
  const normalizedFilter = speciesFilter.trim().toLowerCase()
  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) {
      return t('today.notUpdatedYet')
    }

    return new Intl.DateTimeFormat(siteConfig.dateLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(lastUpdated)
  }, [lastUpdated])

  const matchesFilter = useMemo(() => {
    if (!normalizedFilter) {
      return () => true
    }

    return (commonName: string, scientificName: string) => {
      const common = commonName.toLowerCase()
      const scientific = scientificName.toLowerCase()
      return (
        common.includes(normalizedFilter) ||
        scientific.includes(normalizedFilter)
      )
    }
  }, [normalizedFilter])

  const filteredDetections = useMemo(() => {
    if (!normalizedFilter) {
      return detections
    }

    return detections.filter((detection) => {
      const commonName = detection.commonName?.trim() || t('common.unknownSpecies')
      const scientificName =
        detection.scientificName?.trim() || t('common.unknownSpecies')
      return matchesFilter(commonName, scientificName)
    })
  }, [detections, matchesFilter, normalizedFilter])

  const todayRange = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 1)
    return { start, end }
  }, [])

  const todayDetections = useMemo(() => {
    if (detections.length === 0) {
      return []
    }

    return detections.filter((detection) => {
      const parsed = new Date(detection.timestamp)
      if (Number.isNaN(parsed.valueOf())) {
        return false
      }

      return parsed >= todayRange.start && parsed < todayRange.end
    })
  }, [detections, todayRange])

  const todayGroups = useMemo(() => {
    if (todayDetections.length === 0) {
      return []
    }

    const groups = new Map<
      string,
      {
        key: string
        commonName: string
        scientificName: string
        count: number
      }
    >()

    for (const detection of todayDetections) {
      const commonName = detection.commonName?.trim() || t('common.unknownSpecies')
      const scientificName =
        detection.scientificName?.trim() || t('common.unknownSpecies')
      if (!matchesFilter(commonName, scientificName)) {
        continue
      }

      const key = `${scientificName}||${commonName}`
      const current = groups.get(key)

      if (current) {
        current.count += 1
      } else {
        groups.set(key, {
          key,
          commonName,
          scientificName,
          count: 1,
        })
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }

      return a.commonName.localeCompare(b.commonName)
    })
  }, [matchesFilter, todayDetections])

  const totalDetections = todayDetections.length

  const topSpecies = useMemo(() => {
    if (todayGroups.length === 0) {
      return null
    }

    const [top] = todayGroups
    return {
      name: top.commonName,
      count: top.count,
    }
  }, [todayGroups])

  const showSkeletonCards = isLoading && todayGroups.length === 0
  const skeletonCards = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => (
        <div
          className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 motion-safe:animate-[fadeUp_0.5s_ease]"
          key={`today-skeleton-${index}`}
        >
          <div className="aspect-[4/3] w-full animate-pulse bg-slate-200" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>
      )),
    [],
  )

  return (
    <section
      className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-8"
      data-today-groups={todayGroups.length}
    >
        <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">{t('today.sectionLabel')}</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('today.heading')}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('today.lastUpdated', { time: lastUpdatedLabel })}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('today.speciesFilter')}
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:w-56"
              onChange={(event) => {
                setSpeciesFilter(event.target.value)
              }}
              placeholder={t('today.filterPlaceholder')}
              type="text"
              value={speciesFilter}
            />
          </label>
          <button
            className="self-end rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
            onClick={() => {
              void refresh()
            }}
            type="button"
          >
            {t('common.refresh')}
          </button>
        </div>
      </header>

      {normalizedFilter ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
            {t('common.filter', { value: speciesFilter.trim() })}
          </span>
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            onClick={() => {
              setSpeciesFilter('')
            }}
            type="button"
          >
            {t('common.clear')}
          </button>
        </div>
      ) : null}

      <div className="mt-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
              {t('today.overviewLabel')}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('today.groupedBySpecies')}</p>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            {todayGroups.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {normalizedFilter
                  ? t('today.noFilterResults')
                  : t('today.noSummaryData')}
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                    {t('today.totalDetections')}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {totalDetections}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                    {t('today.topSpecies')}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {topSpecies?.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('common.detections', { count: topSpecies?.count ?? 0 })}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            {showSkeletonCards ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {skeletonCards}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600">
                {error}
              </div>
            ) : todayGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                {normalizedFilter
                  ? t('today.noFilteredToday')
                  : t('today.noDetectionsToday')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {todayGroups.map((group) => (
                  <SpeciesCard
                    commonName={group.commonName}
                    count={group.count}
                    key={group.key}
                    onAttributionOpen={onAttributionOpen}
                    onSelect={onSpeciesSelect}
                    scientificName={group.scientificName}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            {t('today.loading')}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-600">
            {error}
          </div>
        ) : filteredDetections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            {normalizedFilter
              ? t('today.noFilteredList')
              : t('today.noDetectionsList')}
          </div>
        ) : (
          <div
            className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700"
            ref={scrollContainerRef}
          >
            <ul className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-900">
              {filteredDetections.map((detection) => (
                <li
                  key={detection.id}
                  className="flex flex-wrap items-center justify-between gap-5 px-4 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {detection.commonName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {detection.scientificName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {formatTimestamp(detection.timestamp)}
                    </p>
                    <span
                      className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getConfidenceBadgeClassName(detection.confidence)}`}
                    >
                      {formatConfidence(detection.confidence)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

export default TodayView
