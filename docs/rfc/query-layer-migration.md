# RFC: Unified Query Layer with TanStack Query

Status: proposed

## Context

The app has four data-fetching hooks that each independently implement the same
patterns: AbortController lifecycle, request ID tracking, loading/error state,
error reporting, and user-facing error messages. This duplication makes changes
error-prone and inflates the codebase.

### Current hooks and their shared patterns

| Hook | File | Lines | Abort | RequestId | Retry | Pagination | Error report |
|---|---|---|---|---|---|---|---|
| `useDetections` | `src/features/detections/useDetections.ts` | 127 | yes | yes | via apiClient | no | yes |
| `useArchiveDetections` | `src/features/detections/useArchiveDetections.ts` | 227 | yes | yes | via apiClient | manual while-loop | yes |
| `useSpeciesDetections` | `src/features/species/useSpeciesDetections.ts` | 166 | yes | yes | via apiClient | no (stub `loadMore`) | yes |
| `useSpeciesPhoto` | `src/features/detections/useSpeciesPhoto.ts` | 107 | yes | yes | own exponential backoff | no | yes |

Every hook manually implements:
1. `abortRef` + `AbortController` creation and cleanup
2. `requestIdRef` for race condition prevention
3. `useState` for `isLoading`, `error`, data
4. `reportFrontendError()` in catch blocks
5. `toUserErrorMessage()` for user-facing strings
6. Stale-request guard (`if (requestId !== requestIdRef.current) return`)

### Pain points

- **~200 lines of boilerplate** across hooks that could be eliminated
- **Inconsistent capabilities**: `useDetections` has refresh interval, `useArchiveDetections` has early-stop, `useSpeciesDetections` has a stub `loadMore` — none share infrastructure
- **No cache sharing**: species info is fetched redundantly across views (SpeciesDetailView has its own 800-entry cache)
- **Testing overhead**: each hook needs its own abort/race-condition test coverage
- **Complex pagination**: `useArchiveDetections` is 227 lines with 6 exit conditions in a while-loop; this logic is fragile and hard to extend

## Goal

Replace manual fetch orchestration in hooks with TanStack Query (React Query),
consolidating abort handling, caching, retry, and state management into the
framework while preserving all current behavior.

## Decision

Adopt TanStack Query v5 incrementally, migrating one hook at a time. Each
migration must be backward-compatible (same return type, same UI behavior).

## Design

### Query key schema

```typescript
// All keys namespaced under 'birdnet' to allow bulk invalidation
const queryKeys = {
  detections: {
    today: () => ['birdnet', 'detections', 'today'] as const,
    recent: (limit: number) => ['birdnet', 'detections', 'recent', limit] as const,
    page: (limit: number) => ['birdnet', 'detections', 'page', limit] as const,
    range: (start: string, end: string) => ['birdnet', 'detections', 'range', start, end] as const,
    species: (scientificName: string) => ['birdnet', 'detections', 'species', scientificName] as const,
  },
  speciesInfo: (scientificName: string) => ['birdnet', 'species-info', scientificName] as const,
  speciesPhoto: (common: string, scientific: string) => ['birdnet', 'species-photo', common, scientific] as const,
  familyMatches: (familyKey: string) => ['birdnet', 'family-matches', familyKey] as const,
}
```

### QueryClient configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s before refetch
      gcTime: 5 * 60_000,          // 5min garbage collection
      retry: 1,                     // matches current apiClient default
      retryDelay: (attempt) => 300 * 2 ** Math.max(0, attempt - 1),
      refetchOnWindowFocus: false,  // explicit refresh only
    },
  },
})
```

### Migration map

Each hook maps to TanStack Query primitives:

| Current hook | TanStack primitive | Notes |
|---|---|---|
| `useDetections` | `useQuery` + `refetchInterval` | Replace manual setInterval with built-in refetchInterval |
| `useArchiveDetections` | `useQuery` with custom `queryFn` | Pagination while-loop stays in queryFn; TanStack handles abort, cache, state |
| `useSpeciesDetections` | `useQuery` | Direct replacement; `loadMore` → `useInfiniteQuery` when needed |
| `useSpeciesPhoto` | `useQuery` with `retry` + `retryDelay` | Replace manual exponential backoff with TanStack retry config |

### Shared error handling

Create a global `onError` handler on the QueryClient that calls
`reportFrontendError()` automatically, eliminating per-hook error reporting:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global error handler replaces per-hook reportFrontendError calls
      meta: {}, // per-query metadata for source tagging
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      reportFrontendError({
        source: (query.meta?.source as string) ?? 'unknown',
        error,
        metadata: query.meta as Record<string, unknown>,
      })
    },
  }),
})
```

### Species info cache consolidation

The current `speciesInfoCache` Map in `SpeciesDetailView.tsx` (800 entries) and
`familyLookupCache` Map (200 entries) become TanStack Query cache entries with
automatic garbage collection. No more manual `pruneCacheMap()`.

## Migration strategy

### Phase 2a: Foundation (prerequisite for all hooks)

1. Install `@tanstack/react-query` and `@tanstack/react-query-devtools` (dev only)
2. Create `src/api/queryKeys.ts` with the key schema above
3. Create `src/api/queryClient.ts` with the QueryClient configuration
4. Wrap `<App />` in `<QueryClientProvider>` in `main.tsx`
5. Add global error handler on QueryCache
6. **No hook changes yet** — existing hooks continue to work

**Validation:**
- `npm run lint` passes
- `npm run build` passes
- `npm run test` passes (all 36 existing tests)
- App behaves identically

### Phase 2b: Migrate `useSpeciesPhoto` (simplest hook)

This hook has the simplest data flow — single fetch, no pagination, no progressive
loading. Good first migration target.

**Before (107 lines):**
- Manual AbortController, requestIdRef, retryTick state, 3 useEffects

**After (~25 lines):**
```typescript
export const useSpeciesPhoto = (commonName?: string, scientificName?: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.speciesPhoto(commonName ?? '', scientificName ?? ''),
    queryFn: ({ signal }) => fetchSpeciesPhoto({ commonName, scientificName, signal }),
    enabled: Boolean(commonName?.trim() || scientificName?.trim()),
    retry: 3,
    retryDelay: (attempt) => 30_000 * 2 ** attempt,
    meta: { source: 'useSpeciesPhoto.fetch' },
  })

  return {
    photo: data ?? null,
    isLoading,
    error: error ? toUserErrorMessage(error, 'Artenfoto konnte nicht geladen werden', 'Wikimedia') : null,
  }
}
```

**Validation:**
- Existing `useSpeciesPhoto` behavior unchanged from user perspective
- Photo loads, retries on failure, shows error state
- All existing tests pass

### Phase 2c: Migrate `useDetections` (today view)

**Before (127 lines):**
- Manual AbortController, requestIdRef, refresh callback, scroll restoration, setInterval

**After (~30 lines):**
```typescript
export const useDetections = (options: UseDetectionsOptions = {}) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.detections.today(),
    queryFn: ({ signal }) => fetchDetections({ limit: options.limit, signal }),
    refetchInterval: options.refreshIntervalMs ?? 60_000,
    meta: { source: 'useDetections.refresh' },
  })

  return {
    detections: data ?? [],
    isLoading,
    error: error ? toUserErrorMessage(error, 'Erkennungen konnten nicht geladen werden', 'BirdNET') : null,
    lastUpdated: null, // can use dataUpdatedAt from useQuery if needed
    refresh: refetch,
  }
}
```

**Note:** Scroll restoration logic moves to the view component where it belongs.

**Validation:**
- Today view loads detections, auto-refreshes
- Manual refresh button works
- Error states display correctly

### Phase 2d: Migrate `useSpeciesDetections`

**Before (166 lines):**
- Manual AbortController, requestIdRef, normalize/match logic, stub loadMore

**After (~35 lines):**
- `useQuery` for initial batch
- Filtering/normalization logic stays (it's domain logic, not fetch orchestration)
- `loadMore` becomes `useInfiniteQuery` when implementing infinite scroll

**Validation:**
- Species detail detections load correctly
- Filtering by species name works
- Error states display correctly

### Phase 2e: Migrate `useArchiveDetections` (most complex)

This is the most complex hook. The pagination while-loop with 6 exit conditions
stays as the `queryFn` — TanStack Query handles everything around it.

**Before (227 lines):**
- Manual AbortController, requestIdRef, complex pagination loop, progressive UI updates, deduplication

**After (~80 lines):**
- Pagination logic stays in `queryFn` but simplified (no manual abort/requestId)
- Progressive UI updates via `onSuccess` callbacks or intermediate `queryClient.setQueryData`
- Deduplication logic unchanged
- Cache key includes date range → automatic invalidation on range change

**Validation:**
- Archive view loads, paginates, deduplicates
- Date range changes trigger fresh fetch
- Early-stop logic works for rarity view
- Progressive results display during loading

### Phase 2f: Consolidate SpeciesDetailView caches

1. Replace `speciesInfoCache` Map with TanStack Query cache entries
2. Replace `familyLookupCache` Map with query cache entries
3. Remove manual `pruneCacheMap()` calls
4. Family lookup becomes a dependent query (`enabled: !!speciesInfo?.familyCommon`)

**Validation:**
- Species detail view works identically
- Family matches load and display
- Cache is shared across species views (navigating to a previously viewed species is instant)

## Acceptance criteria

- [ ] All 4 data-fetching hooks migrated to TanStack Query
- [ ] Manual AbortController/requestIdRef patterns eliminated from hooks
- [ ] Module-level cache Maps (`speciesInfoCache`, `familyLookupCache`, `photoCache`) replaced by query cache
- [ ] Global error reporting via QueryCache `onError` — no per-hook `reportFrontendError` calls
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes (update tests to use QueryClientProvider wrapper)
- [ ] `npm run test:e2e` passes
- [ ] No user-visible behavior changes
- [ ] Bundle size increase from TanStack Query documented and acceptable (~13kB gzipped)

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Bundle size increase (~13kB gzipped) | Low | Acceptable for the complexity reduction; monitor via build output |
| Progressive loading in archive view may need custom queryFn | Moderate | Keep pagination loop; use `queryClient.setQueryData` for intermediate updates |
| Test migration effort | Low | Wrap test renders in `QueryClientProvider` with fresh client per test |
| Learning curve for contributors | Low | TanStack Query is well-documented and widely adopted |

## Rollback

Each phase is an independent PR. If any phase causes regressions:
1. Revert the specific PR
2. Previous hooks remain functional
3. QueryClientProvider wrapper is harmless if no hooks use it

## Dependencies

- TanStack Query v5: `@tanstack/react-query` (~13kB gzipped)
- Optional: `@tanstack/react-query-devtools` (dev only, tree-shaken in production)

## Out of scope

- React Router migration (covered by separate RFC: `docs/rfc/routing-migration.md`)
- Server-side rendering / SSR support
- Optimistic updates (no mutations in this app)
- Persisted cache (localStorage/IndexedDB)
