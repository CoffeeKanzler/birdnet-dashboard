# CLAUDE.md

## Project Overview

**BirdNET-Showoff** is a React SPA that visualizes bird species detections from a BirdNET-Go backend. It displays real-time and historical detections for a local neighborhood (Vöhrum) with species photos sourced from Wikipedia/Wikimedia. The entire UI is in German.

## Tech Stack

- **Framework:** React 18 + TypeScript 5
- **Bundler:** Vite 6
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- **Font:** Space Grotesk (loaded from Google Fonts in `src/index.css`)
- **Testing:** Vitest + React Testing Library (unit/integration), Playwright (E2E)
- **Deployment:** Docker (multi-stage: Node 24 build -> Nginx Alpine)
- **No router library** — navigation uses URL query parameters + `window.history` API (migration RFC exists at `docs/rfc/routing-migration.md`)
- **No state management library** — React hooks only (useState, useEffect, useMemo, useCallback, useRef)

## Commands

```bash
npm run dev            # Start Vite dev server
npm run build          # TypeScript check (tsc) + Vite production build
npm run lint           # ESLint with zero warnings allowed
npm run preview        # Preview production build locally
npm run test           # Run Vitest once
npm run test:coverage  # Run Vitest with coverage thresholds (95% statements/lines/functions, 75% branches)
npm run test:watch     # Run Vitest in watch mode
npm run test:e2e       # Run Playwright E2E tests
```

The `build` command runs `tsc && vite build`. TypeScript errors will fail the build.

## Project Structure

```
src/
├── api/                    # API client layer
│   ├── apiClient.ts        # Centralized HTTP client (timeout, retry, typed errors)
│   ├── apiClient.test.ts
│   ├── birdnet.ts          # BirdNET-Go API client (detections, species info)
│   ├── birdnet.test.ts
│   └── birdImages.ts       # Wikipedia/Wikimedia image + attribution fetching
├── assets/                 # Static assets (images, SVGs)
├── data/                   # Static data
│   ├── notableSpecies.ts   # Notable/rare species database
│   └── speciesDescriptions.ts
├── features/               # Feature-organized modules
│   ├── landing/            # Live view (3 recent detection cards)
│   ├── detections/         # Today + Archive views
│   │   ├── components/     # Shared components (SpeciesCard)
│   │   ├── TodayView.tsx
│   │   ├── ArchiveView.tsx
│   │   ├── DetectionsView.tsx
│   │   ├── useDetections.ts
│   │   ├── useArchiveDetections.ts
│   │   └── useSpeciesPhoto.ts
│   ├── species/            # Single species detail view
│   └── rarity/             # Notable species highlights view
├── observability/          # Error tracking
│   ├── errorReporter.ts    # Frontend error collection (bounded buffer, custom events)
│   └── errorReporter.test.ts
├── utils/                  # Utility functions
│   ├── date.ts             # Date formatting (YMD format)
│   ├── dateRange.ts        # Date input/parsing utilities
│   ├── scroll.ts           # Scroll position restoration
│   ├── errorMessages.ts    # Maps technical errors to German user-facing messages
│   └── errorMessages.test.ts
├── test/
│   └── setup.ts            # Vitest global setup (matchMedia mock, RTL cleanup)
├── App.tsx                 # Root component (routing, theme, header, attribution modal)
├── App.test.tsx            # Navigation integration tests
├── main.tsx                # React entry point (StrictMode)
└── index.css               # Global styles, CSS variables, dark mode overrides

e2e/                        # Playwright E2E tests
├── smoke.spec.ts           # App shell + error state smoke tests
├── navigation.spec.ts      # View navigation, species detail, theme persistence
├── archive-rarity.spec.ts  # Archive filtering, rarity navigation
└── support/
    └── mockBirdnet.ts      # Mock API for E2E tests

docs/                       # Technical documentation
├── README.md               # Docs index
├── runbook.md              # Operational troubleshooting guide
├── testing-best-practices.md
├── adr/                    # Architecture Decision Records
│   └── 0001-testing-strategy-and-coverage.md
├── rfc/                    # RFCs
│   └── routing-migration.md
└── security/
    └── container-scan-triage.md
```

## Architecture Patterns

### Routing

No router library. Views are controlled by URL query parameters (`?view=today`, `?view=species&common=...&scientific=...&from=today`). `App.tsx` parses and manages route state via `parseRouteState()` and `createRoute()`, using `window.history.pushState/replaceState`. A migration to React Router is proposed in `docs/rfc/routing-migration.md`.

Views: `landing` | `today` | `archive` | `rarity` | `species`

### API Client

All HTTP requests go through `src/api/apiClient.ts` which provides:
- `requestJson<T>()` — typed JSON fetch with timeout, retry, abort handling
- `ApiClientError` — typed errors with codes: `aborted`, `timeout`, `network`, `http`, `parse`
- Exponential backoff retry for transient failures (408, 425, 429, 5xx)
- `buildApiUrl()` — URL construction with query params

### Data Flow

1. **API client** (`src/api/apiClient.ts`) handles HTTP with retry/timeout
2. **API wrappers** (`birdnet.ts`, `birdImages.ts`) normalize responses
3. **Custom hooks** (`use*.ts` in feature dirs) manage state, pagination, AbortController lifecycle
4. **View components** (`*View.tsx`) render UI and delegate to hooks
5. **Error messages** (`src/utils/errorMessages.ts`) map `ApiClientError` to German user-facing text

### Caching

In-memory `Map` caches with size limits and LRU-style eviction:
- Photo cache: max 600 entries
- Attribution registry: max 600 entries
- Species info cache: max 800 entries
- Missing photo retry: 30-second backoff

### Observability

`src/observability/errorReporter.ts` collects frontend errors in a bounded circular buffer (max 200). Emits `birdnet-frontend-error` CustomEvents. Includes release version tagging via `VITE_APP_VERSION`.

## API Endpoints

### BirdNET-Go API (proxied via Nginx in production)

| Endpoint | Params | Purpose |
|---|---|---|
| `GET /api/v2/detections` | `numResults`, `offset`, `start_date`, `end_date`, `queryType`, `search` | Paginated detections |
| `GET /api/v2/detections/recent` | `limit` | Most recent detections |
| `GET /api/v2/species` | `scientific_name` | Species metadata |

### External APIs

- **Wikipedia REST:** `https://de.wikipedia.org/api/rest_v1/page/summary/{title}` (German first, English fallback)
- **Wikimedia Commons:** `https://commons.wikimedia.org/w/api.php` for image attribution metadata

## Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_BIRDNET_API_BASE_URL` | Base URL for BirdNET-Go backend. Defaults to empty (relative paths). |
| `VITE_APP_VERSION` | Release version tag included in error telemetry records. Optional. |

## Code Conventions

### TypeScript

- **Strict mode** enabled (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
- Target: ES2020, module: ESNext, JSX: react-jsx
- All types inline or co-located — no separate `types/` directory

### Naming

- `camelCase` for variables, functions, hooks
- `PascalCase` for React components, type aliases
- `SCREAMING_SNAKE_CASE` for constants (e.g., `MAX_PHOTO_CACHE_ENTRIES`, `THEME_STORAGE_KEY`)
- Custom hooks: `use<Feature>` (e.g., `useDetections`, `useSpeciesPhoto`)
- View components: `<Feature>View` (e.g., `TodayView`, `ArchiveView`)

### Styling

- Tailwind CSS utility classes exclusively — no CSS modules, no styled-components
- Dark mode via CSS class toggle (`.dark` on `<html>`) with overrides in `src/index.css`
- CSS custom properties for theme colors (`--bg-base`, `--surface`, `--text-main`, etc.)
- Responsive breakpoints: `sm:`, `md:`, `lg:`

### UI Language

- **All visible text must be in German** with correct umlauts (Ä, Ö, Ü, ä, ö, ü, ß)
- Date formatting: `Intl.DateTimeFormat('de-DE', ...)`
- Avoid developer/technical jargon in UI copy
- Use German action labels: `Aktualisieren`, `Mehr laden`, `Erneut versuchen`
- Missing data: display `nicht angegeben`, never silently omit

### Error Handling

- Use `ApiClientError` from `src/api/apiClient.ts` for all API errors
- Map errors to user-facing messages via `toUserMessage()` from `src/utils/errorMessages.ts`
- Report errors via `reportFrontendError()` from `src/observability/errorReporter.ts`

### Testing

- See `docs/testing-best-practices.md` for full guidelines
- Test behavior, not implementation details
- Unit tests for deterministic logic (API normalization, matching, error mapping)
- Integration tests for navigation/state transitions
- E2E smoke tests for critical paths
- Coverage thresholds: 95% statements/lines/functions, 75% branches

## Linting

ESLint config (`.eslintrc.cjs`):
- Extends: `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `plugin:react-hooks/recommended`
- Plugin: `react-refresh` (warns on non-component exports)
- **Zero warnings policy**: `--max-warnings 0`

## Docker / Deployment

Multi-stage Dockerfile:
1. **Build stage** (Node 24 Alpine): `npm ci && npm run build` -> output in `/app/dist`
2. **Serve stage** (Nginx Alpine): serves static files, proxies API to `birdnet-go:8080`

Nginx (`docker/nginx.conf`) enforces:
- Security headers (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS)
- Strict regex validation on all API query parameters
- Only GET/HEAD methods allowed on API routes
- SPA fallback: `try_files $uri /index.html`

## CI/CD

### Quality Gate (`.github/workflows/ci.yml`)
- **quality-gate**: lint, test:coverage, build (Node 24)
- **e2e-smoke**: Playwright smoke tests (runs after quality-gate passes)

### Security (`.github/workflows/security.yml`)
- **vulnerability-audit**: `npm audit --audit-level=high`
- **secret-scan**: gitleaks full-history scan
- **container-image-scan**: Trivy scan (HIGH + CRITICAL severity gate)

## Key Documentation

| File | Purpose |
|---|---|
| `UI_GUIDELINES.md` | UI/UX design system (typography, colors, accessibility, interaction rules) |
| `technicalreview.md` | Technical review with status tracking and phased roadmap |
| `docs/rfc/routing-migration.md` | RFC for React Router migration |
| `docs/runbook.md` | Operational troubleshooting guide |
| `docs/testing-best-practices.md` | Testing strategy and patterns |
| `docs/adr/0001-testing-strategy-and-coverage.md` | ADR on coverage thresholds |

## Important Guidelines

1. **Read `UI_GUIDELINES.md`** before making any visual or UX changes
2. **German UI text only** — never introduce English-facing user copy
3. **No unused code** — TypeScript strict checks and ESLint will reject it
4. **Run `npm run build`** to verify — performs full type checking before bundling
5. **Run `npm run lint`** — zero warnings allowed
6. **Run `npm test`** — all tests must pass
7. **Image attribution is mandatory** — every Wikipedia/Wikimedia image must have proper attribution tracking
8. **Use the centralized API client** (`src/api/apiClient.ts`) for all HTTP requests
9. **Map errors to user-facing messages** via `src/utils/errorMessages.ts`
10. **Report errors** via `reportFrontendError()` for observability
11. **Keep navigation simple** — 4 main views (Live, Heute, Archiv, Highlights) + species detail
12. **No external state libraries** — use React hooks, keep state local
13. **Performance matters** — use memoization, lazy loading, bounded caches, AbortController for cleanup
