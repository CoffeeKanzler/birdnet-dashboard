# Continuation Brief — BirdNET Dashboard

_Written for Codex hand-off. Last session: 2026-02-17._

---

## What was done this session

### Features implemented in this branch

1. **Statistics view** (`src/features/statistics/StatisticsView.tsx`)
   - 30-day summary: total detections, unique species, avg confidence
   - Top-10 species bar chart (clickable → SpeciesDetailView)
   - 24-bin hourly activity histogram
   - Progressive loading counter while data arrives

2. **Phase 2 UX polish** (Codex)
   - Confidence color badges: green ≥80%, amber 50–79%, rose <50% — in TodayView and SpeciesDetailView
   - Scroll-to-top floating button in App.tsx (appears after 300px scroll)
   - Dark mode consistency audit across all views

3. **Parallel page fetching** (`src/features/detections/useArchiveDetections.ts`)
   - `parallelBatchSize` option added — fetches N pages concurrently via `Promise.all`
   - Sliding-window approach: advance cursor, stop when any page is short/empty
   - Applied to: Statistics (`parallelBatchSize: 5`), Archive (`parallelBatchSize: 5`), Highlights (`parallelBatchSize: 5`)
   - Both `range` and `global` modes parallelized

4. **localStorage day cache** (`src/features/detections/dayCache.ts`)
   - Caches completed-day API responses: `birdnet-day-cache-v1:{startDate}:{endDate}:{offset}`
   - Guard: only writes when `endDate < today` (immutable past data only)
   - Used by `useArchiveDetections` in range mode

5. **Background cache warmer** (`src/features/detections/useBackgroundCacheWarmer.ts`)
   - Fires on any page load (wired into App.tsx)
   - Warms the 29-day range key `(today-29, yesterday)` — matches Statistics query key exactly
   - One page at a time, 2s delay between fetches, `requestIdleCallback` for low priority
   - Skips already-cached pages, aborts on unmount

6. **Key bug fixes**
   - `gcTime` raised to 10 min (was 2 min, less than 5-min `staleTime` — TanStack evicted data before it went stale)
   - Statistics `rangeEnd` changed to today-midnight so `endDate` = yesterday → caching allowed
   - Highlights switched from `queryMode: 'global'` → `queryMode: 'range'` (enables dayCache)
   - Warmer `DAYS_TO_WARM` fixed: 30 → 29 (was producing different `startDate` than Statistics)

7. **E2E cache tests** (`e2e/cache.spec.ts`)
   - Statistics populates localStorage on first load
   - Statistics reload makes 0 API calls (served from cache)
   - Warmer populates cache while on live view
   - Highlights view has cache keys available on first load (primarily from warmer)
   - Highlights reload makes ≤2 API calls (explained below)

---

## Known remaining issue: Highlights cache

**Highlights (RarityView) still makes 1-2 API calls on reload.**

Why: `RarityView` sets `rangeEnd = tomorrow` so it includes today's live detections.
In `useArchiveDetections`, this makes `endDate = today's date string`.
`setDayCachedPage` has the guard: `if (endDate >= todayDateString()) return` — so it **never writes** for Highlights.

**Do NOT** change Highlights' `rangeEnd` to today-midnight. That would cut off today's detections, which is the whole point of a live highlights view.

**Proper fix options** (not yet implemented):
- **Option A**: Cache only the purely-historical portion of Highlights separately. Fetch [29 days ago → yesterday] from cache, fetch [today] fresh, merge. This requires splitting the fetch inside useArchiveDetections or at the RarityView level.
- **Option B**: Accept the limitation — Highlights always re-fetches today's slice (small). The historical pages are already fast via TanStack's 10-min in-memory gcTime. On a fresh session, Highlights re-fetches all pages (same as before), but TanStack keeps them for 10 min after that.

Option B is acceptable for now. The E2E test reflects this with `toBeLessThanOrEqual(2)`.

---

## Architecture notes

### Cache key structure
```
birdnet-day-cache-v1:{startDate}:{endDate}:{offset}
```
- `startDate` / `endDate` = ISO date strings in UTC (from `toISOString().slice(0, 10)`)
- All callers (Statistics, Archive, warmer) must produce the **same** startDate/endDate to share cache
- Statistics: startDate = today-29 days (UTC), endDate = yesterday (UTC) ← CORRECT after fixes
- Warmer: startDate = today-29 days (UTC), endDate = yesterday (UTC) ← CORRECT after DAYS_TO_WARM=29 fix

### queryMode: 'range' vs 'global'
- `range`: uses `start_date`/`end_date` API params → date-filtered at server → dayCache integrated
- `global`: fetches all detections globally, filters client-side by timestamp → dayCache NOT used
- Highlights was switched from global → range this session. Keep it as range.

### Files changed this session
- `src/features/statistics/StatisticsView.tsx` — new view + rangeEnd fix
- `src/features/detections/useArchiveDetections.ts` — parallelBatchSize, dayCache integration, gcTime=10min
- `src/features/detections/dayCache.ts` — new file
- `src/features/detections/useBackgroundCacheWarmer.ts` — new file (DAYS_TO_WARM=29)
- `src/features/rarity/RarityView.tsx` — queryMode: 'global' removed, parallelBatchSize: 5 added
- `src/features/detections/ArchiveView.tsx` — parallelBatchSize: 5 added
- `src/App.tsx` — stats nav + StatisticsView + useBackgroundCacheWarmer wired
- `src/i18n/locales/de.json` + `en.json` — stats.* and scrollTop.* keys added
- `src/api/queryKeys.ts` — maxDetections optional param added to range key
- `e2e/cache.spec.ts` — new cache E2E tests

---

## Roadmap context

- **Phase 1** (Whitelabel/i18n): COMPLETE ✓
- **Phase 2** (UX Polish): largely done this session
  - Remaining: audio playback feature (from ROADMAP.md)
- **Phase 3** (React Router migration) — see `docs/rfc/routing-migration.md`

## Commands
```bash
npm run build          # tsc + vite build
npm run lint           # zero warnings policy
npm run test           # vitest (95/75 coverage thresholds)
npm run test:e2e       # playwright
bash deploy-dev.sh --quick   # docker build + up, no tests
```
