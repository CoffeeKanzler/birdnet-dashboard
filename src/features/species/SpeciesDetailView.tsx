import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchFamilyMatches,
  fetchSpeciesInfo,
  type FamilyMatch,
} from '../../api/birdnet'
import { queryKeys } from '../../api/queryKeys'
import { siteConfig } from '../../config/site'
import { notableSpecies } from '../../data/notableSpecies'
import { speciesDescriptions } from '../../data/speciesDescriptions'
import { getLocalizedCommonName, getSpeciesData, t } from '../../i18n'
import { toUserErrorMessage } from '../../utils/errorMessages'
import { useSpeciesPhoto } from '../detections/useSpeciesPhoto'
import { useSpeciesDetections } from './useSpeciesDetections'

type SpeciesDetailViewProps = {
  commonName: string
  scientificName: string
  onBack: () => void
  onAttributionOpen?: () => void
  onSpeciesSelect?: (species: { commonName: string; scientificName: string }) => void
}

const normalize = (value: string) => value.trim().toLowerCase()
const FALLBACK_WIDTH = 640
const FALLBACK_HEIGHT = 426

const withUmlauts = (value: string): string => {
  return value
    .replace(/Ae/g, 'Ä')
    .replace(/Oe/g, 'Ö')
    .replace(/Ue/g, 'Ü')
    .replace(/ae/g, 'ä')
    .replace(/oe/g, 'ö')
    .replace(/ue/g, 'ü')
}

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

const formatRarity = (value?: string) => {
  switch (value) {
    case 'very_rare':
      return t('rarity.veryRare')
    case 'rare':
      return t('rarity.rare')
    case 'uncommon':
      return t('rarity.uncommon')
    case 'common':
      return t('rarity.common')
    case 'very_common':
      return t('rarity.veryCommon')
    default:
      return t('rarity.unknown')
  }
}

const SpeciesDetailView = ({
  commonName,
  scientificName,
  onBack,
  onAttributionOpen,
  onSpeciesSelect,
}: SpeciesDetailViewProps) => {
  const displayCommonName = getLocalizedCommonName(commonName, scientificName)
  const queryClient = useQueryClient()
  const { detections, isLoading, error, refresh } = useSpeciesDetections(
    commonName,
    scientificName,
  )
  const { photo, isLoading: isPhotoLoading } = useSpeciesPhoto(commonName, scientificName)

  const { data: speciesInfo } = useQuery({
    queryKey: queryKeys.speciesInfo(scientificName),
    queryFn: async ({ signal }) => {
      const info = await fetchSpeciesInfo({ scientificName, signal })
      return info
    },
    staleTime: 10 * 60_000,
    meta: { source: 'SpeciesDetailView.speciesInfo' },
  })

  const [familyMatches, setFamilyMatches] = useState<FamilyMatch[] | null>(null)
  const [isFamilyLoading, setIsFamilyLoading] = useState(false)
  const [familyError, setFamilyError] = useState<string | null>(null)
  const familyRequestIdRef = useRef(0)

  const loadFamilyMatches = useCallback(async () => {
    if (!speciesInfo?.familyCommon) {
      setFamilyMatches(null)
      setFamilyError(null)
      setIsFamilyLoading(false)
      return
    }

    const requestId = familyRequestIdRef.current + 1
    familyRequestIdRef.current = requestId

    const familyKey = speciesInfo.familyCommon.trim().toLowerCase()
    const cached = queryClient.getQueryData<FamilyMatch[]>(queryKeys.familyMatches(familyKey))
    if (cached) {
      setFamilyMatches(cached)
    }

    setIsFamilyLoading(true)
    setFamilyError(null)

    try {
      const matches = await fetchFamilyMatches({
        familyCommon: speciesInfo.familyCommon,
        scientificName,
        limit: 20,
      })

      if (requestId !== familyRequestIdRef.current) {
        return
      }

      const sortedMatches = matches
        .slice()
        .sort((a, b) => a.commonName.localeCompare(b.commonName, 'de'))

      queryClient.setQueryData(queryKeys.familyMatches(familyKey), sortedMatches)
      setFamilyMatches(sortedMatches)
    } catch (caughtError) {
      if (requestId !== familyRequestIdRef.current) {
        return
      }

      setFamilyError(
        toUserErrorMessage(
          caughtError,
          t('error.familyLoad'),
          'BirdNET',
        ),
      )
    } finally {
      if (requestId === familyRequestIdRef.current) {
        setIsFamilyLoading(false)
      }
    }
  }, [queryClient, scientificName, speciesInfo?.familyCommon])

  useEffect(() => {
    if (!speciesInfo?.familyCommon) {
      setFamilyMatches(null)
      return
    }

    void loadFamilyMatches()
  }, [loadFamilyMatches, speciesInfo?.familyCommon])

  const description = useMemo(() => {
    const normalizedCommonName = normalize(commonName)
    const normalizedScientificName = normalize(scientificName)

    const localeData = getSpeciesData(scientificName)
    if (localeData.description) {
      return localeData.description
    }

    const matchingEntry = notableSpecies.find((species) => {
      const commonMatches = normalize(species.commonName) === normalizedCommonName
      const scientificMatches =
        normalize(species.scientificName ?? '') === normalizedScientificName
      const aliasMatches = (species.aliases ?? []).some(
        (alias) => normalize(alias) === normalizedCommonName,
      )

      return commonMatches || scientificMatches || aliasMatches
    })

    if (matchingEntry?.description) {
      return matchingEntry.description
    }

    const curatedDescription = speciesDescriptions.find((entry) => {
      return normalize(entry.scientificName) === normalizedScientificName
    })

    if (curatedDescription?.description) {
      return curatedDescription.description
    }

    return t('species.fallbackDescription', { commonName: displayCommonName, scientificName })
  }, [commonName, displayCommonName, scientificName])

  const descriptionLabel = useMemo(() => withUmlauts(description), [description])

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t('species.sectionLabel')}
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{displayCommonName}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{scientificName}</p>
        </div>
        <button
          className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
          onClick={onBack}
          type="button"
        >
          {t('common.back')}
        </button>
      </header>

      <div className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {photo ? (
            <img
              alt={t('attribution.photoOf', { name: displayCommonName })}
              className="h-full w-full object-cover"
              decoding="async"
              height={photo.height ?? FALLBACK_HEIGHT}
              loading="lazy"
              src={photo.url}
              width={photo.width ?? FALLBACK_WIDTH}
            />
          ) : isPhotoLoading ? (
            <div className="absolute inset-0 animate-pulse bg-slate-200" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {t('common.noImage')}
            </div>
          )}
          {photo?.sourceUrl ? (
            <button
              className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600 shadow-sm hover:bg-white dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-slate-900"
              onClick={() => {
                onAttributionOpen?.()
              }}
              title={
                [
                  photo.attribution?.author
                    ? t('attribution.author', { author: photo.attribution.author })
                    : null,
                  photo.attribution?.license
                    ? t('attribution.license', { license: photo.attribution.license })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || t('attribution.showAttribution')
              }
              type="button"
            >
              ©
            </button>
          ) : null}
        </div>
        <div className="text-sm text-slate-700 dark:text-slate-300">{descriptionLabel}</div>
      </div>

      {photo?.sourceUrl ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {t('attribution.sourceLabel')}{' '}
          <a
            className="font-medium text-slate-700 underline-offset-2 hover:underline dark:text-slate-300"
            href={photo.sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('attribution.wikimediaLink')}
          </a>
          {photo.attribution?.author ? `, ${photo.attribution.author}` : ''}
          {photo.attribution?.license ? `, ${t('attribution.license', { license: photo.attribution.license })}` : ''}
          {photo.attribution?.licenseUrl ? (
            <>
              {' '}
              (
              <a
                className="font-medium text-slate-700 underline-offset-2 hover:underline dark:text-slate-300"
                href={photo.attribution.licenseUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t('attribution.licenseText')}
              </a>
              )
            </>
          ) : null}
        </p>
      ) : null}

      {speciesInfo ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {t('species.rarityLabel', { value: formatRarity(speciesInfo.rarityStatus) })}
          </span>
          {speciesInfo.familyCommon ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {t('species.familyBadge', { value: speciesInfo.familyCommon })}
            </span>
          ) : null}
        </div>
      ) : null}

      {speciesInfo?.familyCommon ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t('species.familyLabel')}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('species.familyDescription')}
          </p>
          {familyError ? (
            <p className="mt-3 text-sm text-rose-600">{familyError}</p>
          ) : familyMatches ? (
            familyMatches.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {t('species.familyEmpty')}
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {familyMatches.map((entry) => (
                  <button
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                    key={`${entry.scientificName}-${entry.commonName}`}
                    onClick={() => {
                      onSpeciesSelect?.({
                        commonName: getLocalizedCommonName(entry.commonName, entry.scientificName),
                        scientificName: entry.scientificName,
                      })
                    }}
                    type="button"
                  >
                    {getLocalizedCommonName(entry.commonName, entry.scientificName)}
                  </button>
                ))}
              </div>
            )
          ) : null}
          {isFamilyLoading ? (
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {t('species.familyLoading')}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {t('species.detectionsLabel')}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('species.detectionsLoaded', { count: detections.length })}</p>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              onClick={() => {
                void refresh()
              }}
              type="button"
            >
              {t('common.refresh')}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
            {t('species.detectionsLoading')}
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-sm text-rose-600">{error}</div>
        ) : detections.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
            {t('species.detectionsEmpty')}
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-200 bg-white text-left text-sm dark:divide-slate-700 dark:bg-slate-900">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    {t('species.timestampColumn')}
                  </th>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    {t('species.confidenceColumn')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {detections.map((detection) => (
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800" key={detection.id}>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {formatTimestamp(detection.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getConfidenceBadgeClassName(detection.confidence)}`}
                      >
                        {formatConfidence(detection.confidence)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error ? (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('species.detectionsLimit')}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default SpeciesDetailView
