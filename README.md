# BirdNET Dashboard

A React + TypeScript frontend for browsing BirdNET-Go bird detections. Built for local neighborhood users who want to see what birds are visiting their area in real time.

**Live highlights, daily and archive views, species detail pages, rarity spotlights, and Wikimedia-based image attribution** -- all in a calm, nature-oriented German UI.

## Features

- **Live landing page** -- highlighted recent detections with auto-refresh (30s interval), deduplicated by species, responsive grid layout
- **Today view** -- paginated detections from the current day with scroll-aware progressive loading
- **Archive view** -- date range picker for historical detections with pagination and scientific name filtering
- **Rarity spotlight** -- curated notable species matching across a 30-day lookback window
- **Species detail** -- individual species profile with photo, description, rarity badge, family-level related species discovery, and detection history
- **Image attribution** -- Wikimedia/Wikipedia photo loading with full copyright and license tracking via attribution modal
- **Dark/light theme** -- toggle with system preference detection and localStorage persistence
- **URL-driven navigation** -- shareable deep links for all views

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5.2 |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| Unit/Integration tests | Vitest + React Testing Library |
| E2E tests | Playwright (Chromium) |
| Linting | ESLint |
| Runtime | Docker (Node 24 build + NGINX alpine) |
| CI/CD | GitHub Actions (quality gate, E2E smoke, security scans) |

## Prerequisites

- Node.js 24
- npm 11+

```bash
nvm use   # uses .nvmrc
```

## Local development

```bash
npm ci
npm run dev
```

Default dev server: `http://localhost:5173`

## Environment variables

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `VITE_BIRDNET_API_BASE_URL` | No | `http://localhost:8080` | API base URL. If unset, uses relative `/api/v2/...` paths. |
| `VITE_APP_VERSION` | No | `v1.2.3` | Included in frontend error telemetry records. |
| `VITE_SITE_NAME` | No | `My Garden Birds` | Site name shown in the header. |
| `VITE_SITE_TAGLINE` | No | `Live detections from the garden.` | Tagline shown below the site name. |
| `VITE_SITE_SUBTITLE` | No | `BirdNET-Go` | Subtitle label in the header (default: `BirdNET-Go`). |
| `VITE_LOCALE` | No | `en` | UI language (`de` or `en`). Controls all labels and date formatting. |
| `VITE_DEFAULT_THEME` | No | `dark` | Default colour theme: `light`, `dark`, or `system`. |

## Customization

The dashboard is designed to be whitelabel-ready. All branding and language settings are controlled via environment variables — no code changes required for a custom deployment.

### Branding via environment variables

Set any combination of the following variables in your `.env` file or Docker environment:

```env
VITE_SITE_NAME=My Garden Birds
VITE_SITE_TAGLINE=Live detections from the back garden.
VITE_SITE_SUBTITLE=BirdNET-Go
VITE_LOCALE=en
VITE_DEFAULT_THEME=system
```

For Docker Compose deployments, pass them as environment keys and rebuild the image, or use `--build-arg` with the Dockerfile `ARG` declarations.

### Adding a new language

1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/<locale>.json` (e.g. `fr.json`).
2. Translate all string values in the new file. Keys must remain identical.
3. Copy `src/i18n/species/en.json` to `src/i18n/species/<locale>.json` and translate species names and descriptions.
4. Register the new locale in `src/i18n/index.ts`:
   ```ts
   import fr from './locales/fr.json'
   import frSpecies from './species/fr.json'
   // add 'fr' to the `locales` and `speciesLocales` maps
   ```
5. Add the locale code to the `localeMap` in `src/config/site.ts` if it needs a specific date-formatting locale (e.g. `fr: 'fr-FR'`).
6. Set `VITE_LOCALE=fr` in your environment.

### Customizing notable species for a different region

The curated list of notable species lives in `src/data/notableSpecies.ts`. It is pre-configured for a central-European deployment. To adapt it for your region:

1. Edit `src/data/notableSpecies.ts` — add, remove, or reorder entries to match local birds of interest.
2. Each entry needs at minimum a `commonName` matching the name returned by your BirdNET-Go instance.
3. Add corresponding locale entries to `src/i18n/species/de.json` and `src/i18n/species/en.json` (keyed by scientific name) to supply translated descriptions and notability labels.

## Quality checks

```bash
npm run lint            # ESLint
npm run test:coverage   # Vitest with coverage thresholds (95/75)
npm run build           # Type-check + production bundle
npm run test:e2e        # Playwright E2E smoke tests
```

## NPM scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest once |
| `npm run test:coverage` | Run Vitest with coverage thresholds |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run build` | Type-check and create production bundle |
| `npm run preview` | Preview production build locally |

## Architecture overview

```
src/
  api/           API client, BirdNET data API, image/attribution API
  features/
    landing/     Live highlights landing page
    detections/  Today + Archive views, shared hooks and components
    rarity/      Rarity spotlight view + notable species matching
    species/     Species detail view with family enrichment
  data/          Curated species metadata and descriptions
  observability/ Frontend error reporting
  utils/         Shared utilities (error messages, date helpers)
  App.tsx        Shell, top-level view routing, attribution modal
docker/          NGINX runtime config for containerized deployment
e2e/             Playwright E2E test specs and mock helpers
docs/            Architecture decisions, RFCs, runbooks, security triage
```

## Deployment

Build and run the container image:

```bash
docker build -t birdnet-dashboard .
docker run -p 8080:80 -e BIRDNET_API_URL=http://your-birdnet-go:8080 birdnet-dashboard
```

The image serves static assets via NGINX and proxies three allowed API paths defined in `docker/nginx.conf`:
- `GET /api/v2/detections` -- pagination + date range filters
- `GET /api/v2/species` -- scientific name lookup
- `GET /api/v2/detections/recent` -- limit parameter only

All other `/api/` paths return 404. Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) are set by default.

## Project docs

| Document | Purpose |
|----------|---------|
| [`ROADMAP.md`](ROADMAP.md) | Feature roadmap and improvement plan |
| [`UI_GUIDELINES.md`](UI_GUIDELINES.md) | Product tone, layout, accessibility rules |
| [`SECURITY.md`](SECURITY.md) | Security policy |
| [`technicalreview.md`](technicalreview.md) | Technical review findings and status |
| [`docs/README.md`](docs/README.md) | Architecture and operations docs index |
| [`docs/testing-best-practices.md`](docs/testing-best-practices.md) | Testing standards |
| [`docs/rfc/routing-migration.md`](docs/rfc/routing-migration.md) | Proposed React Router migration |
| [`docs/runbook.md`](docs/runbook.md) | Operational incident handling |

## Known gaps

- **Not yet whitelabel-ready** -- branding, locale, and all UI strings are hard-coded for a single German deployment. Whitelabel + i18n is the top roadmap priority.
- **Router migration** -- routing is manually managed in `App.tsx` (RFC exists, not yet implemented)
- **Dark mode gaps** -- some views lack full dark-mode class coverage
- **No statistics/trends view** -- aggregated detection data is not surfaced
- **No audio playback** -- BirdNET audio clips are not exposed in the UI
- **E2E coverage** -- currently smoke-level only

See [`ROADMAP.md`](ROADMAP.md) for the full improvement plan.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm run test` fails | Ensure `node -v` reports Node 24 |
| API calls fail in dev | Verify `VITE_BIRDNET_API_BASE_URL` and backend reachability |
| Missing species images | Wikimedia lookups can be incomplete; retry is automatic with 30s backoff |
| Dark mode looks broken | Some views may lack dark-mode classes; see known gaps above |

## License

See project license file.
