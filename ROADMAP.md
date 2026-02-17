# Roadmap – BirdNET Dashboard

Stand: 2026-02-16

This roadmap covers **whitelabel/i18n** (top priority), **feature improvements**, **architecture**, and **operational maturity**. Items are grouped by priority and roughly ordered within each phase.

---

## Phase 1 – Whitelabel & Internationalization (top priority)

The dashboard is currently hard-coded for a single German-language deployment ("BirdNET Dashboard"). Making it whitelabel-ready so anyone can deploy their own instance with their own branding and language is the primary goal.

### 1a. Configuration-driven branding

- **Problem:** Site name ("BirdNET Dashboard"), tagline ("Live-Erkennungen aus der garden."), and "BirdNET-Go" header label are hard-coded in `App.tsx`.
- **Action:** Extract all branding into a central config file (`src/config/site.ts` or environment variables):
  - `siteName` – e.g. "BirdNET Dashboard" or "My Garden Birds"
  - `siteTagline` – e.g. "Live-Erkennungen aus der garden."
  - `siteSubtitle` – e.g. "BirdNET-Go"
  - `locale` – e.g. "de-DE" or "en-US"
  - `defaultTheme` – "light" | "dark" | "system"
- **Env vars:** Expose as `VITE_SITE_NAME`, `VITE_SITE_TAGLINE`, `VITE_LOCALE` etc. so Docker deployments can customize without rebuilding.
- **Files:** `App.tsx` (lines 244, 247, 254)

### 1b. i18n string extraction

- **Problem:** ~150+ German UI strings are scattered across 15 files. No translation infrastructure exists.
- **Action:** Introduce a lightweight i18n system:
  1. Create `src/i18n/` with locale JSON files (`de.json`, `en.json`)
  2. Add a `useTranslation()` hook or simple `t('key')` function
  3. Extract all hard-coded strings into translation keys
  4. Ship with German (complete) and English (complete) as built-in locales
- **Library choice:** Keep it minimal -- either a simple custom `t()` function with JSON lookups, or use a small library like `i18next` / `react-i18next` if interpolation and pluralization complexity warrants it.
- **String categories to extract (~150+ strings across 15 files):**

  | Category | Count | Key files |
  |----------|-------|-----------|
  | Navigation labels | 4 | `App.tsx` |
  | Section headings & titles | 20+ | All view files |
  | Button labels | 10+ | All view files |
  | Loading/status messages | 15+ | View files, hooks |
  | Empty state messages | 10+ | View files |
  | Error message templates | 8 | `errorMessages.ts` |
  | Attribution/legal copy | 8+ | `App.tsx` |
  | Fallback strings | 10+ | Various |
  | Data labels (stats, confidence) | 10+ | `TodayView`, `SpeciesDetailView` |
  | Time-relative labels ("Vor X min") | 3 | `LandingView.tsx` |

### 1c. Locale-aware date and number formatting

- **Problem:** `'de-DE'` is hard-coded in 5 files for `Intl.DateTimeFormat` and `.toLocaleDateString()`.
- **Action:** Use the site config locale for all date/number formatting. Create a shared `src/utils/format.ts` that reads locale from config.
- **Files:** `dateRange.ts`, `TodayView.tsx`, `SpeciesDetailView.tsx`, `RarityView.tsx`, `NotableSection.tsx`

### 1d. Species descriptions as translatable data

- **Problem:** `speciesDescriptions.ts` (84 entries) and `notableSpecies.ts` (50+ entries) contain German descriptions, notability labels ("Greifvogel", "Eule"), and reason arrays ("Spektakuläre Jagd", etc.).
- **Action:**
  - Move species descriptions into locale-keyed JSON: `src/i18n/species/de.json`, `src/i18n/species/en.json`
  - Keep scientific names as-is (they're universal)
  - Notable species metadata (notability, whyNotable) should be translation keys
  - Fallback: if a species description isn't translated, show the scientific name only
- **Note:** English species descriptions can be generated or sourced from Wikipedia summaries. German ones already exist.

### 1e. Rarity labels localization

- **Problem:** `formatRarity()` in `SpeciesDetailView.tsx` maps API values to German strings ("sehr selten", "häufig", etc.).
- **Action:** Move rarity label mapping into the i18n system as translation keys.

### 1f. Whitelabel documentation

- **Problem:** No guide for deploying a custom-branded instance.
- **Action:** Add a "Customization" section to the README explaining:
  - How to set branding via environment variables
  - How to add a new language
  - How to customize notable species for a different region

### Acceptance criteria (Phase 1)
- [x] A new deployment can be configured with custom name/tagline via env vars alone
- [x] Switching locale between `de` and `en` renders all UI strings in the selected language
- [x] All date/number formatting respects the configured locale
- [x] Species descriptions fall back gracefully when not translated
- [x] README documents the customization process

---

## Phase 2 – UX Polish & Quick Wins (1–2 weeks)

### Dark mode consistency
- **Problem:** Dark mode toggle exists but many views use hard-coded light classes (`bg-white`, `text-slate-900`, `border-slate-200`) without dark counterparts.
- **Action:** Audit every view for missing dark-mode classes. Ensure cards, tables, modals, and section backgrounds all respect the theme toggle.
- **Files:** `App.tsx`, `LandingView.tsx`, `SpeciesDetailView.tsx`, `RarityView.tsx`, `TodayView.tsx`, `ArchiveView.tsx`, `SpeciesCard.tsx`

### Audio playback for detections
- **Problem:** BirdNET-Go records audio clips per detection, but the dashboard doesn't expose them.
- **Action:** Add a play button on detection rows (Today, Archive, Species Detail) that streams the audio clip from the API. Show a small inline player or waveform indicator.
- **API dependency:** Requires `/api/v2/detections/{id}/audio` or similar endpoint from BirdNET-Go.

### Detection confidence visualization
- **Problem:** Confidence is shown as plain text percentage. Users don't quickly grasp relative quality.
- **Action:** Add a small color-coded bar or badge next to confidence values (green >= 80%, amber 50-79%, red <50%).
- **Scope:** `SpeciesDetailView.tsx` detection table, `TodayView.tsx`, `ArchiveView.tsx` rows.

### Empty state improvements
- **Problem:** Empty states are functional but plain. Could be more inviting with an illustration or contextual hint.
- **Action:** Add a simple bird illustration SVG and a short friendly message for each empty state.

### Scroll-to-top button
- **Problem:** Long detection lists require manual scrolling back to the header/navigation.
- **Action:** Add a floating scroll-to-top button that appears after scrolling past 300px.

---

## Phase 3 – New Features (2–4 weeks)

### Statistics / Overview page
- **Problem:** No aggregated view of detection data. Users can't see trends.
- **Action:** Add a new "Statistics" view with:
  - Total detections today / this week / this month
  - Top 10 most detected species (bar chart or ranked list)
  - Detection activity heatmap by hour of day
  - Species diversity count over time
- **Navigation:** Add as a new nav tab between Archive and Highlights.

### Species search / filter
- **Problem:** Finding a specific species requires scrolling through detections. No global search.
- **Action:** Add a search bar (accessible from header or a dedicated page) that filters across all known species by common or scientific name. Clicking a result navigates to the species detail view.

### Map view (if location data available)
- **Problem:** BirdNET-Go can report detection location. Not surfaced in the dashboard.
- **Action:** If the API provides lat/lng per detection, add an optional map view showing detection locations using Leaflet or a simple static map.
- **Fallback:** If no location data, skip this entirely.

### Seasonal calendar / migration tracker
- **Problem:** Users interested in birding want to know when species typically appear.
- **Action:** Show a monthly presence grid per species (based on historical detection data). Indicate which months a species was detected across available data.

### Notification / alert system
- **Problem:** Users must manually check the dashboard to see new rare species.
- **Action:** Add optional browser push notifications for rare species detections (using the Web Push API). Trigger when a species from the notable species list is detected.
- **Scope:** Frontend-only with service worker registration.

### Export / share detections
- **Problem:** No way to export detection data for personal records or sharing.
- **Action:** Add a "CSV Export" button on the Archive view that downloads the current filtered result set. Optionally add a "Share" button that copies a deep link.

---

## Phase 4 – Architecture & Developer Experience (2–4 weeks)

### React Router migration
- **Problem:** Routing is manually managed in `App.tsx` with `pushState`/`replaceState`, making deep linking fragile and adding maintenance burden.
- **Action:** Migrate to React Router per the existing RFC (`docs/rfc/routing-migration.md`). Three phases: router shell, feature routes, remove manual history.
- **Acceptance:** Deep links work, browser back/forward works natively, old `?view=` links redirect.

### TanStack Query for data fetching
- **Problem:** Each feature hook (`useDetections`, `useArchiveDetections`, `useSpeciesDetections`) implements its own fetch/abort/cache/retry pattern.
- **Action:** Introduce TanStack Query as a shared data layer. Migrate hooks incrementally.
- **Benefits:** Automatic caching, background refetch, deduplication, devtools.

### Component extraction and shared UI kit
- **Problem:** Cards, badges, loading skeletons, error banners are duplicated across views with slight variations.
- **Action:** Extract shared components: `<Card>`, `<Badge>`, `<Skeleton>`, `<ErrorBanner>`, `<EmptyState>`. Enforce consistent styling.

### Accessibility audit
- **Problem:** Keyboard navigation exists on cards, but broader a11y hasn't been formally audited.
- **Action:** Run axe-core or Lighthouse a11y audit. Fix critical issues. Add automated a11y checks to CI.

### Performance optimization
- **Problem:** Species detail view fires up to 120 background API calls for family matching. Image cache has no persistence.
- **Action:**
  - Add request debouncing/throttling for family lookups
  - Consider IndexedDB for image attribution cache persistence
  - Lazy-load feature views with `React.lazy()` + `Suspense`
  - Add bundle analysis to CI (`vite-plugin-visualizer`)

---

## Phase 5 – Operational Maturity (ongoing)

### Health monitoring
- **Problem:** No visibility into API availability or error rates from the frontend perspective.
- **Action:** Consider a lightweight status indicator in the header (green dot = API reachable).

### Extended E2E test coverage
- **Problem:** E2E tests are smoke-level only (app loads, basic navigation).
- **Action:** Add E2E scenarios for: archive date filtering, species detail navigation, rarity spotlight rendering, dark mode toggle, attribution modal.

### PWA / offline support
- **Problem:** The dashboard requires a network connection. Mobile users in areas with spotty coverage get blank screens.
- **Action:** Add a service worker for offline caching of the app shell and recently viewed data. Show "Offline" indicator when disconnected.

---

## Completed (for reference)

These items from the original technical review are done:

- [x] Lint quality gate with CI enforcement
- [x] Test infrastructure (Vitest + RTL, 95/75 coverage thresholds)
- [x] Centralized API client with timeout/retry/error classification
- [x] User-facing error messages standardized
- [x] Security headers in NGINX (CSP, HSTS, X-Frame-Options, etc.)
- [x] Container image scanning (Trivy) in CI
- [x] Dependency audit in CI
- [x] E2E smoke tests (Playwright)
- [x] Frontend error reporting with release tagging
- [x] README rewritten from Vite template to project-specific
- [x] Architecture docs, ADRs, RFCs, runbook
- [x] Dynamic live grid based on screen size

---

## How to contribute

Pick any item and create a feature branch. Each item should be a single PR with:
- Implementation
- Tests (unit for logic, E2E for user flows)
- Updated docs if applicable

For architectural items (Phase 4), create or update the relevant RFC in `docs/rfc/` before starting implementation.

For i18n/whitelabel work (Phase 1), coordinate to avoid merge conflicts since many files are touched.
