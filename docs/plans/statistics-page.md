# Statistics Page — Implementation Plan

**Status: PLANNED — ready to implement**
**Target branch: `feat/statistics-view`**

---

## Goal

Add a "Statistik / Statistics" nav tab (between Archive and Highlights) that shows
aggregated detection data for the last 30 days, computed entirely client-side.

From ROADMAP Phase 3:
- Total detections in last 30 days
- Unique species count
- Average confidence score
- Top 10 most detected species (ranked list)
- Detection activity by hour of day (24-bin histogram)

---

## Constraints

- **No new npm packages** — pure TSX + CSS, no chart libraries
- **No new API endpoints** — reuse `useArchiveDetections` with 30-day range
- **No new query keys needed** — the range query key covers it
- Fixed 30-day range (same approach as RarityView — faster, simpler)

---

## Existing patterns to follow

- View props pattern: `{ onSpeciesSelect?, onAttributionOpen? }` — see `RarityView.tsx`
- Data fetching: `useArchiveDetections(rangeStart, rangeEnd)` — see `RarityView.tsx`
- i18n: `t('stats.heading')` keys — see any view file
- Section container styling: `rounded-2xl border border-slate-200 bg-white p-6 shadow-sm`
- Stat number display: large `text-2xl font-semibold text-slate-900`
- Error/loading states: see `ArchiveView.tsx` for the exact pattern

---

## Detection type (all fields available)

```typescript
type Detection = {
  id: string
  commonName: string
  scientificName: string
  confidence: number  // 0.0–1.0
  timestamp: string   // ISO 8601
}
```

---

## Files to create / modify

### 1. NEW: `src/features/statistics/StatisticsView.tsx`

Self-contained view. Fetches own data, computes stats with `useMemo`.

**Data computation:**
```typescript
// Fixed 30-day range
const today = useMemo(() => new Date(), [])
const rangeStart = useMemo(() => {
  const d = new Date(today); d.setDate(d.getDate() - 29); d.setHours(0,0,0,0); return d
}, [today])
const rangeEnd = useMemo(() => {
  const d = new Date(today); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0); return d
}, [today])

const { detections, isLoading, error } = useArchiveDetections(rangeStart, rangeEnd)

const totalDetections = detections.length
const uniqueSpecies = useMemo(() => new Set(detections.map(d => d.scientificName)).size, [detections])
const avgConfidence = useMemo(() =>
  detections.length ? Math.round(detections.reduce((s, d) => s + d.confidence, 0) / detections.length * 100) : 0
, [detections])

// Top 10 species by count
const topSpecies = useMemo(() => {
  const counts = new Map<string, { commonName: string; scientificName: string; count: number }>()
  for (const d of detections) {
    const existing = counts.get(d.scientificName)
    if (existing) existing.count++
    else counts.set(d.scientificName, { commonName: d.commonName, scientificName: d.scientificName, count: 1 })
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 10)
}, [detections])

// 24-bin hourly histogram
const hourlyBins = useMemo(() => {
  const bins = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))
  for (const d of detections) {
    const h = new Date(d.timestamp).getHours()
    if (h >= 0 && h < 24) bins[h].count++
  }
  return bins
}, [detections])
const maxHourCount = useMemo(() => Math.max(...hourlyBins.map(b => b.count), 1), [hourlyBins])
```

**UI sections:**

Section 1 — Summary cards (3-col grid):
- Total detections (number)
- Unique species (number)
- Avg confidence (number + %)

Section 2 — Top 10 species (ranked list):
- Each row: rank badge | species name + scientific name | CSS bar proportional to count | count pill
- Clicking a row calls `onSpeciesSelect({ commonName, scientificName })`

Section 3 — Hourly activity histogram:
- 24 CSS bars in a flex row, height proportional to `count / maxHourCount`
- Bar height range: min 2px → max ~96px
- X-axis labels below: 0h, 6h, 12h, 18h, 23h (only those 5)
- Emerald color bars (matches existing badge palette)

**Skeleton loading:** show 3 placeholder cards + blank bar chart while `isLoading`

**Error state:** `border-rose-200 bg-rose-50 text-rose-600` — same as ArchiveView

### 2. MODIFY: `src/App.tsx`

a) Line ~11 — add `'stats'` to MainView type:
```typescript
type MainView = 'landing' | 'today' | 'archive' | 'rarity' | 'stats'
```

b) Line ~22 — add `'stats'` to lastMainView union:
```typescript
lastMainView: 'today' | 'archive' | 'rarity' | 'stats'
```

c) `parseRouteState` — add stats to the valid route check (line ~58):
```typescript
if (routeView === 'today' || routeView === 'archive' || routeView === 'rarity' || routeView === 'stats') {
```

d) `handleViewChange` — add stats to both the nextLastMainView and setLastMainView conditions (lines ~176, ~180):
```typescript
const nextLastMainView = nextView === 'today' || nextView === 'archive' || nextView === 'rarity' || nextView === 'stats' ? nextView : lastMainView
if (nextView === 'today' || nextView === 'archive' || nextView === 'rarity' || nextView === 'stats') {
```

e) Nav button — add after the Highlights button (copy exact styling):
```tsx
<button
  className={`inline-flex h-9 shrink-0 items-center rounded-xl border px-4 py-2 text-[0.65rem] transition ${
    activeNavigationView === 'stats'
      ? 'border-slate-200 bg-white text-slate-900 shadow-sm'
      : 'border-transparent text-slate-500 hover:text-slate-700'
  }`}
  onClick={() => handleViewChange('stats')}
  type="button"
>
  {t('nav.stats')}
</button>
```

f) Route — add before the final `DetectionsView` fallback:
```tsx
) : view === 'stats' ? (
  <StatisticsView
    onAttributionOpen={openAttribution}
    onSpeciesSelect={handleSpeciesSelect}
  />
```

g) Import at top: `import StatisticsView from './features/statistics/StatisticsView'`

### 3. MODIFY: `src/i18n/locales/de.json`

Add after `"nav.highlights"` key:
```json
"nav.stats": "Statistik",
"stats.sectionLabel": "Übersicht",
"stats.heading": "Statistiken",
"stats.description": "Erkennungen der letzten 30 Tage.",
"stats.totalDetections": "Erkennungen gesamt",
"stats.uniqueSpecies": "Verschiedene Arten",
"stats.avgConfidence": "Ø Sicherheit",
"stats.topSpecies": "Häufigste Arten",
"stats.topSpeciesDescription": "Top 10 nach Anzahl Erkennungen.",
"stats.hourlyActivity": "Aktivität nach Uhrzeit",
"stats.hourlyDescription": "Erkennungen pro Stunde.",
"stats.noData": "Keine Erkennungen in den letzten 30 Tagen.",
"stats.loading": "Statistiken werden geladen..."
```

### 4. MODIFY: `src/i18n/locales/en.json`

Same keys, English values:
```json
"nav.stats": "Statistics",
"stats.sectionLabel": "Overview",
"stats.heading": "Statistics",
"stats.description": "Detections from the last 30 days.",
"stats.totalDetections": "Total detections",
"stats.uniqueSpecies": "Unique species",
"stats.avgConfidence": "Avg. confidence",
"stats.topSpecies": "Top species",
"stats.topSpeciesDescription": "Top 10 by detection count.",
"stats.hourlyActivity": "Activity by hour",
"stats.hourlyDescription": "Detections per hour of day.",
"stats.noData": "No detections in the last 30 days.",
"stats.loading": "Loading statistics..."
```

### 5. NEW: `src/features/statistics/StatisticsView.test.tsx`

Required coverage (95% threshold enforced):
- Renders section heading
- Shows correct totalDetections, uniqueSpecies, avgConfidence
- Shows top species list in correct order
- Shows hourly histogram bars
- Shows loading skeleton when isLoading=true
- Shows error banner when error is set
- Clicking a species row calls onSpeciesSelect

Mock `useArchiveDetections` in tests — see existing test files for the mock pattern.

### 6. MODIFY: `e2e/full-navigation.spec.ts`

Add one test to the existing navigation suite:
```typescript
test('statistics view shows heading and summary cards', async ({ page }) => {
  await installBirdnetApiMocks(page)
  await page.goto('/?view=stats')
  await expect(page.getByRole('heading', { name: 'Statistiken' })).toBeVisible()
})
```

Also verify the nav button exists and routes correctly.

---

## Completion checklist

- [ ] Branch: `git checkout -b feat/statistics-view`
- [ ] `src/i18n/locales/de.json` — stats.* keys added
- [ ] `src/i18n/locales/en.json` — stats.* keys added
- [ ] `src/features/statistics/StatisticsView.tsx` — created
- [ ] `src/App.tsx` — type, parseRouteState, handleViewChange, nav button, route, import
- [ ] `src/features/statistics/StatisticsView.test.tsx` — created, passing
- [ ] `e2e/full-navigation.spec.ts` — stats nav test added
- [ ] `bash deploy-dev.sh` — all tests pass, deploys clean
- [ ] Push + PR → merge to main
- [ ] Tag v1.2.0 when ready

---

## Notes for the implementer

- The `useArchiveDetections` hook streams pages and updates queryClient incrementally —
  stats will update live as pages load. Show a subtle "loading more" indicator if isLoading.
- `confidence` is 0.0–1.0 float. Multiply by 100 for display as percentage.
- Timestamps are ISO 8601 strings. Use `new Date(timestamp).getHours()` for hour extraction.
- The hourly histogram should use local time (browser timezone), consistent with
  how the rest of the app displays times.
- Keep the component under ~300 lines. Extract sub-components if it grows larger.
