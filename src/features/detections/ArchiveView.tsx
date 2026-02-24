import { useEffect, useMemo, useState } from 'react'

import { toDateInputValue, parseDateInput, formatDisplayDate } from '../../utils/dateRange'
import { useArchiveDetections } from './useArchiveDetections'
import SpeciesCard from './components/SpeciesCard'
import RangeLoadingPanel from './components/RangeLoadingPanel'
import { useSummary30d } from './useSummary30d'
import { getLocalizedCommonName, t } from '../../i18n'

type ArchiveViewProps = {
  onSpeciesSelect?: (species: {
    commonName: string
    scientificName: string
  }) => void
  onAttributionOpen?: () => void
}

const ArchiveView = ({ onSpeciesSelect, onAttributionOpen }: ArchiveViewProps) => {
  const today = useMemo(() => new Date(), [])
  const { defaultStartDate, defaultEndDate } = useMemo(() => {
    const end = new Date(today)

    const start = new Date(end)
    start.setDate(end.getDate() - 29)

    return {
      defaultStartDate: toDateInputValue(start),
      defaultEndDate: toDateInputValue(end),
    }
  }, [today])
  const [startDate, setStartDate] = useState(() => defaultStartDate)
  const [endDate, setEndDate] = useState(() => defaultEndDate)
  const [speciesFilter, setSpeciesFilter] = useState('')
  const normalizedFilter = speciesFilter.trim().toLowerCase()
  const timezoneLabel = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  )

  const parsedStart = useMemo(() => parseDateInput(startDate), [startDate])
  const parsedEnd = useMemo(() => parseDateInput(endDate), [endDate])
  const rangeStart = useMemo(
    () => (parsedStart ? new Date(parsedStart) : new Date(Number.NaN)),
    [parsedStart],
  )
  const rangeEnd = useMemo(() => {
    if (!parsedEnd) {
      return new Date(Number.NaN)
    }

    const endNext = new Date(parsedEnd)
    endNext.setDate(endNext.getDate() + 1)
    return endNext
  }, [parsedEnd])
  const {
    summary,
    isLoading: isSummaryLoading,
    isPending: isSummaryPending,
    error: summaryError,
  } = useSummary30d()
  const isDefaultThirtyDayWindow = useMemo(() => {
    const expectedEnd = toDateInputValue(today)
    const expectedStartDate = new Date(today)
    expectedStartDate.setDate(expectedStartDate.getDate() - 29)
    const expectedStart = toDateInputValue(expectedStartDate)
    return startDate === expectedStart && endDate === expectedEnd
  }, [endDate, startDate, today])
  const shouldUseSummary = isDefaultThirtyDayWindow && Boolean(summary && !summary.pending)

  const { detections, isLoading, error, refresh } = useArchiveDetections(
    rangeStart,
    rangeEnd,
    {
      parallelBatchSize: 5,
      enabled: !shouldUseSummary && !isSummaryLoading && !isSummaryPending,
    },
  )

  useEffect(() => {
    if (!startDate || !endDate) {
      return
    }

    if (startDate > endDate) {
      setStartDate(endDate)
      setEndDate(startDate)
    }
  }, [startDate, endDate])

  const rangeSummary = useMemo(() => {
    if (!startDate || !endDate) {
      return t('archive.noRangeSelected')
    }

    return t('archive.rangeSummary', { start: formatDisplayDate(startDate), end: formatDisplayDate(endDate) })
  }, [startDate, endDate])

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

  const archiveGroups = useMemo(() => {
    if (shouldUseSummary && summary) {
      const filtered = summary.archive.groups.filter((group) =>
        matchesFilter(
          getLocalizedCommonName(group.commonName, group.scientificName),
          group.scientificName,
        ),
      )
      return [...filtered].sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count
        }
        return getLocalizedCommonName(a.commonName, a.scientificName).localeCompare(
          getLocalizedCommonName(b.commonName, b.scientificName),
        )
      }).map((group) => ({
        ...group,
        commonName: getLocalizedCommonName(group.commonName, group.scientificName),
        key: `${group.scientificName}||${getLocalizedCommonName(group.commonName, group.scientificName)}`,
      }))
    }

    if (!parsedStart || !parsedEnd) {
      return []
    }

    const endNext = new Date(parsedEnd)
    endNext.setDate(endNext.getDate() + 1)

    const groups = new Map<
      string,
      {
        key: string
        commonName: string
        scientificName: string
        count: number
      }
    >()

    for (const detection of detections) {
      const parsed = new Date(detection.timestamp)
      if (Number.isNaN(parsed.valueOf())) {
        continue
      }

      if (parsed < parsedStart || parsed >= endNext) {
        continue
      }

      const commonName = detection.commonName?.trim() || t('common.unknownSpecies')
      const scientificName =
        detection.scientificName?.trim() || t('common.unknownSpecies')
      const localizedCommonName = getLocalizedCommonName(commonName, scientificName)
      if (!matchesFilter(localizedCommonName, scientificName)) {
        continue
      }

      const key = `${scientificName}||${localizedCommonName}`
      const current = groups.get(key)

      if (current) {
        current.count += 1
      } else {
        groups.set(key, {
          key,
          commonName: localizedCommonName,
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
  }, [detections, matchesFilter, parsedEnd, parsedStart, shouldUseSummary, summary])

  const effectiveIsLoading =
    (isSummaryLoading && isDefaultThirtyDayWindow && !shouldUseSummary) || isLoading
  const effectiveError = isDefaultThirtyDayWindow ? (summaryError ?? error) : error

  const totalDetections = useMemo(
    () => archiveGroups.reduce((sum, group) => sum + group.count, 0),
    [archiveGroups],
  )

  const topSpecies = useMemo(() => {
    if (archiveGroups.length === 0) {
      return null
    }

    const [top] = archiveGroups
    return {
      name: top.commonName,
      count: top.count,
    }
  }, [archiveGroups])

  const showSkeletonCards = effectiveIsLoading && archiveGroups.length === 0
  const skeletonCards = useMemo(
    () =>
      Array.from({ length: 3 }, (_, index) => (
        <div
          className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
          key={`archive-skeleton-${index}`}
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

  const setQuickRange = (days: number) => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(end.getDate() - (days - 1))

    setStartDate(toDateInputValue(start))
    setEndDate(toDateInputValue(end))
  }

  const startLabel = formatDisplayDate(startDate)
  const endLabel = formatDisplayDate(endDate)
  const quickRanges = [
    { label: t('archive.quickToday'), days: 1 },
    { label: t('archive.quickWeek'), days: 7 },
    { label: t('archive.quickMonth'), days: 30 },
  ]

  if (effectiveIsLoading && archiveGroups.length === 0 && !effectiveError) {
    return (
      <RangeLoadingPanel
        subtitle={t('archive.description')}
        title={t('rarity.loadingDetections')}
      />
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t('archive.sectionLabel')}
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t('archive.heading')}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('archive.description')}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {rangeSummary}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {t('common.timezone', { zone: timezoneLabel })}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('today.speciesFilter')}
            <input
              className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              onChange={(event) => {
                setSpeciesFilter(event.target.value)
              }}
              placeholder={t('today.filterPlaceholder')}
              type="text"
              value={speciesFilter}
            />
          </label>
          {quickRanges.map((range) => {
            return (
              <button
                key={range.label}
                className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-700"
                onClick={() => {
                  setQuickRange(range.days)
                }}
                type="button"
              >
                {range.label}
              </button>
            )
          })}
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
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t('archive.customRange')}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('archive.selectDates')}
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('archive.startDate')}
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                onChange={(event) => {
                  setStartDate(event.target.value)
                }}
                type="date"
                value={startDate}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('archive.endDate')}
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                onChange={(event) => {
                  setEndDate(event.target.value)
                }}
                type="date"
                value={endDate}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              {startLabel}
            </span>
            <span>{t('common.to')}</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              {endLabel}
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t('archive.overviewLabel')}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('today.groupedBySpecies')}</p>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            {archiveGroups.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {normalizedFilter
                  ? t('archive.noFilterSummary')
                  : t('archive.noRangeSummary')}
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {t('today.totalDetections')}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {totalDetections}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
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
            ) : effectiveError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600">
                <span>{effectiveError}</span>
                <button
                  className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:bg-rose-100"
                  onClick={() => {
                    void refresh()
                  }}
                  type="button"
                >
                  {t('common.retry')}
                </button>
              </div>
            ) : archiveGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                {normalizedFilter
                  ? t('archive.noFilteredRange')
                  : t('archive.noDetectionsRange')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {archiveGroups.map((group) => (
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
      </div>
    </section>
  )
}

export default ArchiveView
