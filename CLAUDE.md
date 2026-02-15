# CLAUDE.md

## Project Overview

**BirdNET-Showoff** is a React SPA that visualizes bird species detections from a BirdNET-Go backend. It displays real-time and historical detections for a local neighborhood (local area) with species photos sourced from Wikipedia/Wikimedia. The entire UI is in German.

## Tech Stack

- **Framework:** React 18 + TypeScript 5
- **Bundler:** Vite 6
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- **Font:** Space Grotesk (loaded from Google Fonts in `src/index.css`)
- **Deployment:** Docker (multi-stage: Node 24 build -> Nginx Alpine)
- **No router library** — navigation uses URL query parameters + `window.history` API
- **No state management library** — React hooks only (useState, useEffect, useMemo, useCallback, useRef)
- **No test framework** — there are no tests

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # TypeScript check (tsc) + Vite production build
npm run lint      # ESLint with zero warnings allowed
npm run preview   # Preview production build locally
```

The `build` command runs `tsc && vite build`. TypeScript errors will fail the build.

## Project Structure

```
src/
├── api/                    # API client layer
│   ├── birdnet.ts          # BirdNET-Go API client (detections, species info)
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
├── utils/                  # Utility functions (date, scroll)
├── App.tsx                 # Root component (routing, theme, header, attribution modal)
├── main.tsx                # React entry point (StrictMode)
└── index.css               # Global styles, CSS variables, dark mode overrides
```

## Architecture Patterns

### Routing

No router library. Views are controlled by URL query parameters (`?view=today`, `?view=species&common=...&scientific=...&from=today`). `App.tsx` parses and manages route state via `parseRouteState()` and `createRoute()`, using `window.history.pushState/replaceState`.

Views: `landing` | `today` | `archive` | `rarity` | `species`

### Data Flow

1. **API clients** (`src/api/`) fetch raw data from BirdNET-Go and Wikipedia
2. **Custom hooks** (`use*.ts` in feature dirs) manage state, pagination, AbortController lifecycle
3. **View components** (`*View.tsx`) render UI and delegate to hooks
4. **Shared components** (`SpeciesCard`) are reused across views

### Caching

In-memory `Map` caches with size limits and LRU-style eviction:
- Photo cache: max 600 entries
- Attribution registry: max 600 entries
- Species info cache: max 800 entries
- Missing photo retry: 30-second backoff

### State Management

All state is local React state. No global store. Cross-component communication uses:
- Props drilling from `App.tsx`
- Custom DOM events (`birdnet-attribution-updated`) for attribution updates

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
| `VITE_BIRDNET_API_BASE_URL` | Base URL for BirdNET-Go backend. Defaults to empty (relative paths). Accessed via `import.meta.env`. |

## Code Conventions

### TypeScript

- **Strict mode** enabled (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
- Target: ES2020, module: ESNext, JSX: react-jsx
- All types inline or co-located — no separate `types/` directory
- API response types use optional fields with explicit type annotations

### Naming

- `camelCase` for variables, functions, hooks
- `PascalCase` for React components, type aliases
- `SCREAMING_SNAKE_CASE` for constants (e.g., `MAX_PHOTO_CACHE_ENTRIES`, `THEME_STORAGE_KEY`)
- Custom hooks: `use<Feature>` (e.g., `useDetections`, `useSpeciesPhoto`, `useNotableSpotlight`)
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

### Components

- Functional components with hooks only
- Keyboard accessibility required: `Enter`/`Space` on interactive cards
- Lazy image loading (`loading="lazy"`)
- Loading states use skeleton cards
- AbortController for canceling in-flight requests on unmount or navigation

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
- Strict regex validation on all API query parameters
- Only GET/HEAD methods allowed on API routes
- SPA fallback: `try_files $uri /index.html`
- All unrecognized `/api/` paths return 404

## CI/CD

GitHub Actions (`.github/workflows/security.yml`):
- **vulnerability-audit**: `npm audit --audit-level=high` on every push/PR
- **secret-scan**: gitleaks full-history scan on every push/PR

## Key Files Reference

| File | Purpose |
|---|---|
| `src/App.tsx` | Root component: routing, theme toggle, header, attribution modal |
| `src/api/birdnet.ts` | All BirdNET-Go API calls, core types (`Detection`, `SpeciesInfo`) |
| `src/api/birdImages.ts` | Wikipedia/Wikimedia photo fetching with caching and attribution |
| `src/features/detections/components/SpeciesCard.tsx` | Reusable bird species card component |
| `src/data/notableSpecies.ts` | Static database of notable/rare species |
| `src/index.css` | Global CSS, theme variables, dark mode overrides, animations |
| `docker/nginx.conf` | Nginx routing rules with API parameter validation |
| `UI_GUIDELINES.md` | Comprehensive UI/UX design system and rules |

## Important Guidelines

1. **Read `UI_GUIDELINES.md`** before making any visual or UX changes — it defines the design system
2. **German UI text only** — never introduce English-facing user copy
3. **No unused code** — TypeScript strict checks and ESLint will reject it
4. **Run `npm run build`** to verify changes — it performs full type checking before bundling
5. **Run `npm run lint`** to verify lint compliance — zero warnings allowed
6. **Image attribution is mandatory** — every Wikipedia/Wikimedia image must have proper attribution tracking
7. **Keep navigation simple** — 4 main views (Live, Heute, Archiv, Highlights) + species detail
8. **No external state libraries** — use React hooks, keep state local to components
9. **Performance matters** — use memoization, lazy loading, bounded caches, AbortController for cleanup
