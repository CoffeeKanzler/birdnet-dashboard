import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchDetectionsPage,
  fetchSpeciesInfo,
  type SpeciesInfo,
} from '../../api/birdnet'
import { siteConfig } from '../../config/site'
import { notableSpecies } from '../../data/notableSpecies'
import { speciesDescriptions } from '../../data/speciesDescriptions'
import { getSpeciesData, t } from '../../i18n'
import { reportFrontendError } from '../../observability/errorReporter'
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

type FamilyMatch = {
  commonName: string
  scientificName: string
}

const familyLookupCache = new Map<string, FamilyMatch[]>()
const speciesInfoCache = new Map<string, SpeciesInfo | null>()
const MAX_FAMILY_LOOKUP_CACHE = 200
const MAX_SPECIES_INFO_CACHE = 800

function pruneCacheMap<T>(map: Map<string, T>, maxEntries: number) {
  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value
    if (typeof oldestKey !== 'string') {
      break
    }

    map.delete(oldestKey)
  }
}

const setSpeciesInfoCache = (key: string, value: SpeciesInfo | null) => {
  speciesInfoCache.set(key, value)
  pruneCacheMap(speciesInfoCache, MAX_SPECIES_INFO_CACHE)
}

const setFamilyLookupCache = (key: string, value: FamilyMatch[]) => {
  familyLookupCache.set(key, value)
  pruneCacheMap(familyLookupCache, MAX_FAMILY_LOOKUP_CACHE)
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
    return '0%'
  }

  const percent = Math.round((value > 1 ? value : value * 100) * 10) / 10
  return `${percent}%`
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
  const { detections, isLoading, error, refresh } = useSpeciesDetections(
    commonName,
    scientificName,
  )
  const { photo, isLoading: isPhotoLoading } = useSpeciesPhoto(commonName, scientificName)
  const [speciesInfo, setSpeciesInfo] = useState<SpeciesInfo | null>(null)
  const [familyMatches, setFamilyMatches] = useState<FamilyMatch[] | null>(null)
  const [isFamilyLoading, setIsFamilyLoading] = useState(false)
  const [familyError, setFamilyError] = useState<string | null>(null)
  const familyRequestIdRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      try {
        const info = await fetchSpeciesInfo({
          scientificName,
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setSpeciesInfo(info)
        }
      } catch {
        if (!controller.signal.aborted) {
          setSpeciesInfo(null)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [scientificName])

  const loadFamilyMatches = useCallback(async () => {
    if (!speciesInfo?.familyCommon) {
      return
    }

    const requestId = familyRequestIdRef.current + 1
    familyRequestIdRef.current = requestId

    const familyKey = speciesInfo.familyCommon.trim().toLowerCase()
    const cached = familyLookupCache.get(familyKey)
    if (cached) {
      setFamilyMatches(cached)
    }

    setIsFamilyLoading(true)
    setFamilyError(null)

    try {
      const PAGE_LIMIT = 500
      const MAX_SCAN_PAGES = 2
      const MAX_BACKGROUND_PAGES = 120
      const MAX_FAMILY_MATCHES = 20
      const MAX_SPECIES_INFO_CALLS = 24
      const MAX_SPECIES_INFO_CALLS_BACKGROUND = 120
      const LOOKUP_CONCURRENCY = 6
      const candidateSpecies = new Map<
        string,
        {
          commonName: string
          scientificName: string
        }
      >()

      for (let pageIndex = 0; pageIndex < MAX_SCAN_PAGES; pageIndex += 1) {
        const page = await fetchDetectionsPage({
          limit: PAGE_LIMIT,
          offset: pageIndex * PAGE_LIMIT,
        })

        if (page.length === 0) {
          break
        }

        for (const detection of page) {
          const key = detection.scientificName.trim().toLowerCase()
          if (!key || key === 'unbekannte art') {
            continue
          }

          if (!candidateSpecies.has(key)) {
            candidateSpecies.set(key, {
              commonName: detection.commonName,
              scientificName: detection.scientificName,
            })
          }
        }

        if (page.length < PAGE_LIMIT) {
          break
        }
      }

      if (requestId !== familyRequestIdRef.current) {
        return
      }

      const matchesByScientific = new Map<string, FamilyMatch>()
      const ownScientificName = scientificName.trim().toLowerCase()

      const candidateList = Array.from(candidateSpecies.values()).filter((entry) => {
        const scientificKey = entry.scientificName.trim().toLowerCase()
        return Boolean(scientificKey) && scientificKey !== ownScientificName
      })

      const unresolved: Array<{ commonName: string; scientificName: string }> = []

      for (const entry of candidateList) {
        const scientificKey = entry.scientificName.trim().toLowerCase()

        const cachedInfo = speciesInfoCache.get(scientificKey)
        if (cachedInfo === undefined) {
          unresolved.push(entry)
          continue
        }

        if (!cachedInfo?.familyCommon) {
          continue
        }

        if (cachedInfo.familyCommon.trim().toLowerCase() !== familyKey) {
          continue
        }

        matchesByScientific.set(scientificKey, {
          commonName: entry.commonName,
          scientificName: entry.scientificName,
        })
      }

      const unresolvedLimited = unresolved.slice(0, MAX_SPECIES_INFO_CALLS)

      for (let index = 0; index < unresolvedLimited.length; index += LOOKUP_CONCURRENCY) {
        const batch = unresolvedLimited.slice(index, index + LOOKUP_CONCURRENCY)

        await Promise.all(
          batch.map(async (entry) => {
            const scientificKey = entry.scientificName.trim().toLowerCase()
            const info = await fetchSpeciesInfo({ scientificName: entry.scientificName })
            setSpeciesInfoCache(scientificKey, info)

            if (requestId !== familyRequestIdRef.current) {
              return
            }

            if (!info?.familyCommon) {
              return
            }

            if (info.familyCommon.trim().toLowerCase() !== familyKey) {
              return
            }

            matchesByScientific.set(scientificKey, {
              commonName: entry.commonName,
              scientificName: entry.scientificName,
            })
          }),
        )

        if (matchesByScientific.size >= MAX_FAMILY_MATCHES) {
          break
        }
      }

      if (requestId !== familyRequestIdRef.current) {
        return
      }

      let matches = Array.from(matchesByScientific.values())
        .sort((a, b) => a.commonName.localeCompare(b.commonName, 'de'))
        .slice(0, MAX_FAMILY_MATCHES)

      setFamilyMatches(matches)

      const backgroundCandidates = new Map(candidateSpecies)
      let emptySpeciesPagesInRow = 0

      for (let pageIndex = MAX_SCAN_PAGES; pageIndex < MAX_BACKGROUND_PAGES; pageIndex += 1) {
        const page = await fetchDetectionsPage({
          limit: PAGE_LIMIT,
          offset: pageIndex * PAGE_LIMIT,
        })

        if (requestId !== familyRequestIdRef.current) {
          return
        }

        if (page.length === 0) {
          break
        }

        let newSpeciesInPage = 0

        for (const detection of page) {
          const key = detection.scientificName.trim().toLowerCase()
          if (!key || key === 'unbekannte art') {
            continue
          }

          if (!backgroundCandidates.has(key)) {
            backgroundCandidates.set(key, {
              commonName: detection.commonName,
              scientificName: detection.scientificName,
            })
            newSpeciesInPage += 1
          }
        }

        if (newSpeciesInPage === 0) {
          emptySpeciesPagesInRow += 1
        } else {
          emptySpeciesPagesInRow = 0
        }

        if (page.length < PAGE_LIMIT || emptySpeciesPagesInRow >= 3) {
          break
        }
      }

      const backgroundList = Array.from(backgroundCandidates.values()).filter((entry) => {
        const scientificKey = entry.scientificName.trim().toLowerCase()
        return Boolean(scientificKey) && scientificKey !== ownScientificName
      })

      const backgroundUnresolved: Array<{ commonName: string; scientificName: string }> = []

      for (const entry of backgroundList) {
        const scientificKey = entry.scientificName.trim().toLowerCase()

        if (matchesByScientific.has(scientificKey)) {
          continue
        }

        const cachedInfo = speciesInfoCache.get(scientificKey)
        if (cachedInfo === undefined) {
          backgroundUnresolved.push(entry)
          continue
        }

        if (
          cachedInfo?.familyCommon &&
          cachedInfo.familyCommon.trim().toLowerCase() === familyKey
        ) {
          matchesByScientific.set(scientificKey, {
            commonName: entry.commonName,
            scientificName: entry.scientificName,
          })
        }
      }

      const unresolvedBackgroundLimited = backgroundUnresolved.slice(
        0,
        MAX_SPECIES_INFO_CALLS_BACKGROUND,
      )

      for (
        let index = 0;
        index < unresolvedBackgroundLimited.length;
        index += LOOKUP_CONCURRENCY
      ) {
        const batch = unresolvedBackgroundLimited.slice(index, index + LOOKUP_CONCURRENCY)

        await Promise.all(
          batch.map(async (entry) => {
            const scientificKey = entry.scientificName.trim().toLowerCase()
            const info = await fetchSpeciesInfo({ scientificName: entry.scientificName })
            setSpeciesInfoCache(scientificKey, info)

            if (requestId !== familyRequestIdRef.current) {
              return
            }

            if (
              info?.familyCommon &&
              info.familyCommon.trim().toLowerCase() === familyKey
            ) {
              matchesByScientific.set(scientificKey, {
                commonName: entry.commonName,
                scientificName: entry.scientificName,
              })
            }
          }),
        )

        if (requestId !== familyRequestIdRef.current) {
          return
        }

        matches = Array.from(matchesByScientific.values())
          .sort((a, b) => a.commonName.localeCompare(b.commonName, 'de'))
          .slice(0, MAX_FAMILY_MATCHES)

        setFamilyMatches(matches)
      }

      if (requestId !== familyRequestIdRef.current) {
        return
      }

      matches = Array.from(matchesByScientific.values())
        .sort((a, b) => a.commonName.localeCompare(b.commonName, 'de'))
        .slice(0, MAX_FAMILY_MATCHES)

      setFamilyLookupCache(familyKey, matches)
      setFamilyMatches(matches)
    } catch (error) {
      if (requestId !== familyRequestIdRef.current) {
        return
      }

      reportFrontendError({
        source: 'SpeciesDetailView.loadFamilyMatches',
        error,
        metadata: {
          scientificName,
          family: speciesInfo?.familyCommon ?? '',
        },
      })

      setFamilyError(
        toUserErrorMessage(
          error,
          t('error.familyLoad'),
          'BirdNET',
        ),
      )
    } finally {
      if (requestId === familyRequestIdRef.current) {
        setIsFamilyLoading(false)
      }
    }
  }, [scientificName, speciesInfo?.familyCommon])

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

    return t('species.fallbackDescription', { commonName, scientificName })
  }, [commonName, scientificName])

  const descriptionLabel = useMemo(() => withUmlauts(description), [description])

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t('species.sectionLabel')}
          </p>
          <h2 className="text-xl font-semibold text-slate-900">{commonName}</h2>
          <p className="mt-1 text-sm text-slate-500">{scientificName}</p>
        </div>
        <button
          className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-200"
          onClick={onBack}
          type="button"
        >
          {t('common.back')}
        </button>
      </header>

      <div className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-white">
          {photo ? (
            <img
              alt={t('attribution.photoOf', { name: commonName })}
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
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t('common.noImage')}
            </div>
          )}
          {photo?.sourceUrl ? (
            <button
              className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600 shadow-sm hover:bg-white"
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
        <div className="text-sm text-slate-700">{descriptionLabel}</div>
      </div>

      {photo?.sourceUrl ? (
        <p className="mt-3 text-xs text-slate-500">
          {t('attribution.sourceLabel')}{' '}
          <a
            className="font-medium text-slate-700 underline-offset-2 hover:underline"
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
                className="font-medium text-slate-700 underline-offset-2 hover:underline"
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
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {t('species.familyBadge', { value: speciesInfo.familyCommon })}
            </span>
          ) : null}
        </div>
      ) : null}

      {speciesInfo?.familyCommon ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t('species.familyLabel')}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {t('species.familyDescription')}
          </p>
          {familyError ? (
            <p className="mt-3 text-sm text-rose-600">{familyError}</p>
          ) : familyMatches ? (
            familyMatches.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                {t('species.familyEmpty')}
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {familyMatches.map((entry) => (
                  <button
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                    key={`${entry.scientificName}-${entry.commonName}`}
                    onClick={() => {
                      onSpeciesSelect?.({
                        commonName: entry.commonName,
                        scientificName: entry.scientificName,
                      })
                    }}
                    type="button"
                  >
                    {entry.commonName}
                  </button>
                ))}
              </div>
            )
          ) : null}
          {isFamilyLoading ? (
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              {t('species.familyLoading')}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t('species.detectionsLabel')}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{t('species.detectionsLoaded', { count: detections.length })}</p>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
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
          <div className="px-4 py-6 text-sm text-slate-500">
            {t('species.detectionsLoading')}
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-sm text-rose-600">{error}</div>
        ) : detections.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            {t('species.detectionsEmpty')}
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-200 bg-white text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    {t('species.timestampColumn')}
                  </th>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    {t('species.confidenceColumn')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detections.map((detection) => (
                  <tr className="hover:bg-slate-50" key={detection.id}>
                    <td className="px-4 py-3 text-slate-700">
                      {formatTimestamp(detection.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatConfidence(detection.confidence)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error ? (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">
              {t('species.detectionsLimit')}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default SpeciesDetailView
