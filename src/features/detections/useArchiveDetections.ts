import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import {
  type Detection,
  fetchDetectionsPage,
  fetchDetectionsRangePage,
} from '../../api/birdnet'
import { queryKeys } from '../../api/queryKeys'
import { toUserErrorMessage } from '../../utils/errorMessages'
import { getDayCachedPage, setDayCachedPage } from './dayCache'

type UseArchiveDetectionsState = {
  detections: Detection[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

type UseArchiveDetectionsOptions = {
  earlyStopLookupKeys?: Set<string>
  earlyStopTarget?: number
  queryMode?: 'range' | 'global'
  maxDetections?: number
  parallelBatchSize?: number
  staleTime?: number
  enabled?: boolean
}

const PAGE_LIMIT = 500
const MAX_RANGE_PAGES = 200
const DEFAULT_ARCHIVE_STALE_TIME = 60 * 60_000

const toTimestamp = (value: string): number | null => {
  const parsed = new Date(value).valueOf()
  return Number.isNaN(parsed) ? null : parsed
}

export const useArchiveDetections = (
  rangeStart: Date,
  rangeEnd: Date,
  options: UseArchiveDetectionsOptions = {},
): UseArchiveDetectionsState => {
  const startTime = rangeStart.valueOf()
  const endTime = rangeEnd.valueOf()
  const validRange = !Number.isNaN(startTime) && !Number.isNaN(endTime)
  const startDate = validRange ? rangeStart.toISOString().slice(0, 10) : ''
  const endDate = validRange
    ? new Date(endTime - 1).toISOString().slice(0, 10)
    : ''
  const mode = options.queryMode ?? 'range'
  const parallelBatchSize = Math.max(1, Math.floor(options.parallelBatchSize ?? 1))

  const queryKey = queryKeys.detections.range(startDate, endDate, mode, options.maxDetections)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const collected: Detection[] = []
      const seenPageSignatures = new Set<string>()
      const seenDetectionKeys = new Set<string>()
      const matchedLookupKeys = new Set<string>()
      let pageCount = 0

      const mergePage = (
        detections: Detection[],
        offset: number,
      ): { newItemsInPage: number; skippedDuplicatePage: boolean } => {
        if (detections.length === 0) {
          return { newItemsInPage: 0, skippedDuplicatePage: false }
        }

        const firstId = detections[0]?.id ?? 'none'
        const lastId = detections[detections.length - 1]?.id ?? 'none'
        const signature = `${offset}|${firstId}|${lastId}|${detections.length}`
        if (seenPageSignatures.has(signature)) {
          return { newItemsInPage: 0, skippedDuplicatePage: true }
        }
        seenPageSignatures.add(signature)

        let newItemsInPage = 0
        for (const detection of detections) {
          const key = detection.id
            ? String(detection.id)
            : `${detection.timestamp}|${detection.commonName}|${detection.scientificName}`

          if (seenDetectionKeys.has(key)) {
            continue
          }

          if (mode === 'global' || mode === 'range') {
            const timestamp = toTimestamp(detection.timestamp)
            if (timestamp === null || timestamp < startTime || timestamp >= endTime) {
              continue
            }
          }

          seenDetectionKeys.add(key)
          collected.push(detection)
          newItemsInPage += 1

          if (options.earlyStopLookupKeys && options.earlyStopTarget) {
            const commonName = detection.commonName?.trim().toLowerCase()
            const scientificName = detection.scientificName?.trim().toLowerCase()

            if (commonName && options.earlyStopLookupKeys.has(commonName)) {
              matchedLookupKeys.add(commonName)
            }

            if (scientificName && options.earlyStopLookupKeys.has(scientificName)) {
              matchedLookupKeys.add(scientificName)
            }
          }
        }

        return { newItemsInPage, skippedDuplicatePage: false }
      }

      const shouldStop = (): boolean => {
        if (options.maxDetections && collected.length >= options.maxDetections) {
          return true
        }

        if (
          options.earlyStopLookupKeys &&
          options.earlyStopTarget &&
          matchedLookupKeys.size >= options.earlyStopTarget
        ) {
          return true
        }

        return false
      }

      if (mode === 'range') {
        signal.throwIfAborted()

        const cachedFirstPage = getDayCachedPage(startDate, endDate, 0)
        const firstPage =
          cachedFirstPage ??
          (await fetchDetectionsRangePage({
            startDate,
            endDate,
            limit: PAGE_LIMIT,
            offset: 0,
            signal,
          }))
        if (!cachedFirstPage) {
          setDayCachedPage(startDate, endDate, 0, firstPage)
        }
        pageCount += 1

        const firstPageMerge = mergePage(firstPage.detections, 0)
        const firstPageOldest = firstPage.detections[firstPage.detections.length - 1]
        const firstPageOldestTimestamp = toTimestamp(firstPageOldest?.timestamp ?? '')

        if (
          firstPage.detections.length === 0 ||
          firstPageMerge.skippedDuplicatePage ||
          firstPageMerge.newItemsInPage === 0 ||
          firstPage.detections.length < PAGE_LIMIT ||
          (firstPageOldestTimestamp !== null && firstPageOldestTimestamp < startTime) ||
          shouldStop() ||
          pageCount >= MAX_RANGE_PAGES
        ) {
          return collected
        }

        let nextOffset = PAGE_LIMIT
        while (pageCount < MAX_RANGE_PAGES) {
          signal.throwIfAborted()

          const remainingPageBudget = MAX_RANGE_PAGES - pageCount
          if (remainingPageBudget <= 0) {
            break
          }

          const batchSize = Math.min(parallelBatchSize, remainingPageBudget)
          const batchOffsets = Array.from(
            { length: batchSize },
            (_, index) => nextOffset + index * PAGE_LIMIT,
          )
          const batchPages = await Promise.all(
            batchOffsets.map(async (offset) => {
              const cachedPage = getDayCachedPage(startDate, endDate, offset)
              if (cachedPage) {
                return {
                  offset,
                  page: cachedPage,
                }
              }

              const page = await fetchDetectionsRangePage({
                startDate,
                endDate,
                limit: PAGE_LIMIT,
                offset,
                signal,
              })
              setDayCachedPage(startDate, endDate, offset, page)
              return {
                offset,
                page,
              }
            }),
          )
          pageCount += batchOffsets.length

          let encounteredDuplicatePage = false
          let encounteredShortOrEmptyPage = false
          let encounteredOldestBeforeStart = false
          let anyNewItemsInBatch = false

          for (const { offset, page } of batchPages) {
            if (page.detections.length < PAGE_LIMIT) {
              encounteredShortOrEmptyPage = true
            }

            const merged = mergePage(page.detections, offset)
            if (merged.skippedDuplicatePage) {
              encounteredDuplicatePage = true
              continue
            }
            if (merged.newItemsInPage > 0) {
              anyNewItemsInBatch = true
            }

            const oldest = page.detections[page.detections.length - 1]
            const oldestTimestamp = toTimestamp(oldest?.timestamp ?? '')
            if (oldestTimestamp !== null && oldestTimestamp < startTime) {
              encounteredOldestBeforeStart = true
            }
          }

          if (
            encounteredDuplicatePage ||
            encounteredShortOrEmptyPage ||
            encounteredOldestBeforeStart ||
            !anyNewItemsInBatch ||
            shouldStop() ||
            pageCount >= MAX_RANGE_PAGES
          ) {
            break
          }

          nextOffset += batchOffsets.length * PAGE_LIMIT
        }

        return collected
      }

      signal.throwIfAborted()

      const firstPageDetections = await fetchDetectionsPage({
        limit: PAGE_LIMIT,
        offset: 0,
        signal,
      })
      pageCount += 1

      const firstPageMerge = mergePage(firstPageDetections, 0)

      const firstPageOldest = firstPageDetections[firstPageDetections.length - 1]
      const firstPageOldestTimestamp = toTimestamp(firstPageOldest?.timestamp ?? '')

      if (
        firstPageDetections.length === 0 ||
        firstPageMerge.skippedDuplicatePage ||
        firstPageDetections.length < PAGE_LIMIT ||
        firstPageMerge.newItemsInPage === 0 ||
        (firstPageOldestTimestamp !== null && firstPageOldestTimestamp < startTime) ||
        shouldStop() ||
        pageCount >= MAX_RANGE_PAGES
      ) {
        return collected
      }

      let nextOffset = PAGE_LIMIT
      while (pageCount < MAX_RANGE_PAGES) {
        signal.throwIfAborted()

        const remainingPageBudget = MAX_RANGE_PAGES - pageCount
        if (remainingPageBudget <= 0) {
          break
        }

        const batchSize = Math.min(parallelBatchSize, remainingPageBudget)
        const batchOffsets = Array.from(
          { length: batchSize },
          (_, index) => nextOffset + index * PAGE_LIMIT,
        )
        const batchPages = await Promise.all(
          batchOffsets.map(async (offset) => ({
            offset,
            detections: await fetchDetectionsPage({
              limit: PAGE_LIMIT,
              offset,
              signal,
            }),
          })),
        )
        pageCount += batchOffsets.length

        let encounteredDuplicatePage = false
        let encounteredShortOrEmptyPage = false
        let encounteredOldestBeforeStart = false
        let anyNewItemsInBatch = false

        for (const { offset, detections } of batchPages) {
          if (detections.length < PAGE_LIMIT) {
            encounteredShortOrEmptyPage = true
          }

          const merged = mergePage(detections, offset)
          if (merged.skippedDuplicatePage) {
            encounteredDuplicatePage = true
            continue
          }

          if (merged.newItemsInPage > 0) {
            anyNewItemsInBatch = true
          }

          const oldest = detections[detections.length - 1]
          const oldestTimestamp = toTimestamp(oldest?.timestamp ?? '')
          if (oldestTimestamp !== null && oldestTimestamp < startTime) {
            encounteredOldestBeforeStart = true
          }
        }

        if (
          encounteredDuplicatePage ||
          encounteredShortOrEmptyPage ||
          encounteredOldestBeforeStart ||
          !anyNewItemsInBatch ||
          shouldStop() ||
          pageCount >= MAX_RANGE_PAGES
        ) {
          break
        }

        nextOffset += batchOffsets.length * PAGE_LIMIT
      }

      return collected
    },
    enabled: validRange && (options.enabled ?? true),
    staleTime: options.staleTime ?? DEFAULT_ARCHIVE_STALE_TIME,
    gcTime: Math.max(options.staleTime ?? DEFAULT_ARCHIVE_STALE_TIME, 2 * 60 * 60_000),
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
    meta: {
      source: 'useArchiveDetections.refresh',
      mode,
    },
  })

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  return {
    detections: data ?? [],
    isLoading,
    error: error
      ? toUserErrorMessage(
          error,
          'Archiv-Erkennungen konnten nicht geladen werden',
          'BirdNET',
        )
      : null,
    refresh,
  }
}
