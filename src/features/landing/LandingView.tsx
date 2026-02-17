import { useEffect, useMemo, useState } from 'react'

import { useDetections } from '../detections/useDetections'
import { useSpeciesPhoto } from '../detections/useSpeciesPhoto'
import { t } from '../../i18n'

const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}

type LiveHighlightCardProps = {
  commonName: string
  scientificName: string
  timestamp: string
  onSelect?: (species: { commonName: string; scientificName: string }) => void
  onAttributionOpen?: () => void
}

const FALLBACK_WIDTH = 640
const FALLBACK_HEIGHT = 426

const LiveHighlightCard = ({
  commonName,
  scientificName,
  timestamp,
  onSelect,
  onAttributionOpen,
}: LiveHighlightCardProps) => {
  const { photo, isLoading } = useSpeciesPhoto(commonName, scientificName)
  const width = photo?.width ?? FALLBACK_WIDTH
  const height = photo?.height ?? FALLBACK_HEIGHT
  const isInteractive = typeof onSelect === 'function'

  const statusLabel = useMemo(() => {
    const parsed = new Date(timestamp)
    const value = parsed.valueOf()

    if (Number.isNaN(value)) {
      return t('common.unknown')
    }

    const ageMinutes = Math.floor((Date.now() - value) / 60000)

    if (ageMinutes <= 15) {
      return t('live.statusLive')
    }

    if (ageMinutes < 60) {
      return t('live.statusMinutesAgo', { minutes: ageMinutes })
    }

    const ageHours = Math.floor(ageMinutes / 60)
    return t('live.statusHoursAgo', { hours: ageHours })
  }, [timestamp])

  const handleSelect = () => {
    onSelect?.({ commonName, scientificName })
  }

  const attributionTitle = photo?.attribution
    ? [
        photo.attribution.author ? t('attribution.author', { author: photo.attribution.author }) : null,
        photo.attribution.license ? t('attribution.license', { license: photo.attribution.license }) : null,
      ]
        .filter(Boolean)
        .join(' · ') || t('attribution.showAttribution')
    : t('attribution.showAttribution')

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-sm ${isInteractive ? 'cursor-pointer transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300' : ''}`}
      onClick={isInteractive ? handleSelect : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleSelect()
              }
            }
          : undefined
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {photo ? (
          <img
            alt={t('attribution.photoOf', { name: commonName })}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            decoding="async"
            height={height}
            loading="lazy"
            src={photo.url}
            width={width}
          />
        ) : isLoading ? (
          <div className="absolute inset-0 animate-pulse bg-slate-200" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <svg
                aria-hidden="true"
                className="h-10 w-10"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M10 32c6-7 12-11 18-12 5-1 8-4 10-8l4 4c-4 9-8 13-15 15-6 2-10 5-13 9l-4-8z"
                  fill="currentColor"
                  opacity="0.6"
                />
                <path
                  d="M12 26c1-6 5-10 10-13 4-2 6-4 8-7l3 3c-2 6-5 10-10 13-5 3-7 6-8 10l-3-6z"
                  fill="currentColor"
                  opacity="0.4"
                />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">
                {t('common.noImage')}
              </span>
            </div>
          </div>
        )}
        {photo?.sourceUrl ? (
          <button
            className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600 shadow-sm hover:bg-white"
            onClick={(event) => {
              event.stopPropagation()
              onAttributionOpen?.()
            }}
            title={attributionTitle}
            type="button"
          >
            ©
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="clamp-1 text-sm font-semibold text-slate-900 sm:text-base">
            {commonName}
          </h3>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-emerald-700">
            {statusLabel}
          </span>
        </div>
        <p className="clamp-1 text-[0.7rem] text-slate-500 sm:text-xs">{scientificName}</p>
      </div>
    </article>
  )
}

const LIVE_REFRESH_INTERVAL_MS = 30000
const LIVE_FETCH_LIMIT = 30

type LandingViewProps = {
  onSpeciesSelect?: (species: { commonName: string; scientificName: string }) => void
  onAttributionOpen?: () => void
}

const LandingView = ({ onSpeciesSelect, onAttributionOpen }: LandingViewProps) => {
  const isLg = useMediaQuery('(min-width: 1024px)')
  const isSm = useMediaQuery('(min-width: 640px)')
  const maxItems = isLg ? 9 : isSm ? 6 : 3

  const { detections, isLoading, error } = useDetections({
    refreshIntervalMs: LIVE_REFRESH_INTERVAL_MS,
    limit: LIVE_FETCH_LIMIT,
    recentOnly: true,
  })

  const latestDetections = useMemo(() => {
    const items: Array<{
      key: string
      commonName: string
      scientificName: string
      timestamp: string
    }> = []
    const seen = new Set<string>()

    for (const detection of detections) {
      const commonName = detection.commonName?.trim() || t('common.unknownSpecies')
      const scientificName = detection.scientificName?.trim() || t('common.unknownSpecies')
      const dedupeKey = `${scientificName}||${commonName}`

      if (seen.has(dedupeKey)) {
        continue
      }

      seen.add(dedupeKey)
      items.push({
        key: `${detection.id}-${dedupeKey}`,
        commonName,
        scientificName,
        timestamp: detection.timestamp,
      })

      if (items.length >= maxItems) {
        break
      }
    }

    return items
  }, [detections, maxItems])

  const showSkeletonCards = isLoading && latestDetections.length === 0

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t('live.sectionLabel')}
            </p>
            <h2 className="text-xl font-semibold text-slate-900">{t('live.heading')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('live.autoRefresh')}</p>
          </div>
        </header>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {showSkeletonCards
            ? Array.from({ length: maxItems }, (_, index) => (
                <div
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50"
                  key={`landing-live-skeleton-${index}`}
                >
                  <div className="aspect-[4/3] w-full animate-pulse bg-slate-200" />
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))
            : error
              ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600">
                  {error}
                </div>
              )
              : latestDetections.length === 0
                ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                    {t('live.noDetections')}
                  </div>
                )
                : latestDetections.map((item) => (
                  <LiveHighlightCard
                    commonName={item.commonName}
                    key={item.key}
                    onAttributionOpen={onAttributionOpen}
                    onSelect={onSpeciesSelect}
                    scientificName={item.scientificName}
                    timestamp={item.timestamp}
                  />
                ))}
        </div>
      </section>
    </div>
  )
}

export default LandingView
