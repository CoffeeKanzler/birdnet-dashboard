import { useEffect, useMemo, useState } from 'react'

import { toDateInputValue, parseDateInput, formatDisplayDate } from '../../utils/dateRange'
import { useArchiveDetections } from './useArchiveDetections'
import SpeciesCard from './components/SpeciesCard'

type ArchiveViewProps = {
  onSpeciesSelect?: (species: {
    commonName: string
    scientificName: string
  }) => void
  onAttributionOpen?: () => void
}

const ArchiveView = ({ onSpeciesSelect, onAttributionOpen }: ArchiveViewProps) => {
  const today = useMemo(() => new Date(), [])
  const [startDate, setStartDate] = useState(() => toDateInputValue(today))
  const [endDate, setEndDate] = useState(() => toDateInputValue(today))
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
  const { detections, isLoading, error, refresh } = useArchiveDetections(
    rangeStart,
    rangeEnd,
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
      return 'Bitte einen Datumsbereich waehlen, um Erkennungen zu sehen.'
    }

    return `${formatDisplayDate(startDate)} bis ${formatDisplayDate(endDate)}`
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

      const commonName = detection.commonName?.trim() || 'Unbekannte Art'
      const scientificName =
        detection.scientificName?.trim() || 'Unbekannte Art'
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
  }, [detections, matchesFilter, parsedEnd, parsedStart])

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

  const showSkeletonCards = isLoading && archiveGroups.length === 0
  const skeletonCards = useMemo(
    () =>
      Array.from({ length: 3 }, (_, index) => (
        <div
          className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
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
    { label: 'Heute', days: 1 },
    { label: 'Letzte 7 Tage', days: 7 },
    { label: 'Letzte 30 Tage', days: 30 },
  ]

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Archiv
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Erkennungen im Datumsbereich
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Erkennungen ausserhalb von heute anzeigen.
          </p>
          <p className="mt-2 text-sm font-medium text-slate-700">
            {rangeSummary}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Zeitzone: {timezoneLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Artenfilter
            <input
              className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              onChange={(event) => {
                setSpeciesFilter(event.target.value)
              }}
              placeholder="Artnamen eingeben"
              type="text"
              value={speciesFilter}
            />
          </label>
          {quickRanges.map((range) => {
            return (
              <button
                key={range.label}
                className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-slate-200"
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
            Filter: {speciesFilter.trim()}
          </span>
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
            onClick={() => {
              setSpeciesFilter('')
            }}
            type="button"
          >
            Leeren
          </button>
        </div>
      ) : null}

      <div className="mt-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Benutzerdefinierter Zeitraum
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Start- und Enddatum waehlen.
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Startdatum
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                onChange={(event) => {
                  setStartDate(event.target.value)
                }}
                type="date"
                value={startDate}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Enddatum
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                onChange={(event) => {
                  setEndDate(event.target.value)
                }}
                type="date"
                value={endDate}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600">
              {startLabel}
            </span>
            <span>bis</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600">
              {endLabel}
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Archiv-Übersicht
            </p>
            <p className="mt-1 text-sm text-slate-500">Nach Art gruppiert</p>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
            {archiveGroups.length === 0 ? (
              <p className="text-sm text-slate-500">
                {normalizedFilter
                  ? 'Keine Erkennungen zum Zusammenfassen fuer diesen Filter.'
                  : 'Keine Erkennungen zum Zusammenfassen in diesem Zeitraum.'}
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Erkennungen gesamt
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {totalDetections}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Top-Art
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {topSpecies?.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {topSpecies?.count} Erkennungen
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600">
                <span>{error}</span>
                <button
                  className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:bg-rose-100"
                  onClick={() => {
                    void refresh()
                  }}
                  type="button"
                >
                  Erneut versuchen
                </button>
              </div>
            ) : archiveGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                {normalizedFilter
                  ? 'Keine Erkennungen passen in diesem Zeitraum zu diesem Filter.'
                  : 'Keine Erkennungen in diesem Zeitraum.'}
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
