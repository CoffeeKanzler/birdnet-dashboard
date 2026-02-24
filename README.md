# BirdNET Dashboard

BirdNET Dashboard is a React + TypeScript frontend for [BirdNET-Go](https://github.com/tphakala/birdnet-go). It provides live and historical bird detection views with a hardened API wrapper for self-hosted deployments.

## Features

- Live, Today, Archive, Highlights, and Statistics views
- Family-match endpoint to avoid frontend fan-out calls
- Disk-backed caches for summary and recent detections
- Graceful stale-data fallback when upstream is temporarily unavailable
- Health endpoints for monitoring (`/healthz`, `/readyz`, `/cachez`)
- Docker image with NGINX + Node runtime wrapper
- Demo-mode build with mock data (GitHub Pages workflow included)

## Tech Stack

- React 19 + TypeScript
- Vite
- TanStack Query
- Tailwind CSS
- Vitest + React Testing Library
- Playwright

## Quick Start

```bash
nvm use
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Scripts

```bash
npm run dev            # start local dev server
npm run build          # typecheck + production build
npm run lint           # eslint (warnings fail)
npm run test           # unit/integration tests
npm run test:coverage  # coverage report
npm run test:e2e       # playwright tests
npm run preview        # preview production build
```

## Configuration

### Frontend build variables

- `VITE_SITE_NAME`
- `VITE_SITE_TAGLINE`
- `VITE_SITE_SUBTITLE`
- `VITE_LOCALE` (`en` or `de`)
- `VITE_DEFAULT_THEME` (`light`, `dark`, `system`)
- `VITE_BIRDNET_API_BASE_URL` (defaults to same-origin)
- `VITE_DEMO_MODE` (`true` enables mock API responses)
- `VITE_BASE_PATH` (useful for GitHub Pages)

### Runtime variables (server wrapper)

- `BIRDNET_API_BASE_URL`
- `SUMMARY_CACHE_FILE`
- `RECENT_CACHE_FILE`
- `FAMILY_CACHE_FILE`
- `RECENT_REFRESH_MS`
- `RECENT_SNAPSHOT_LIMIT`
- `MAX_SUMMARY_PAGES`
- `UPSTREAM_TIMEOUT_MS`
- `FAMILY_MATCH_TTL_MS`
- `FAMILY_PARTIAL_MATCH_TTL_MS`
- `FAMILY_SPECIES_INFO_TTL_MS`
- `FAMILY_SPECIES_INFO_LOOKUP_BUDGET`
- `FAMILY_SPECIES_INFO_LOOKUP_CONCURRENCY`
- `FAMILY_MATCH_CANDIDATE_LIMIT`
- `FAMILY_RATE_LIMIT_COOLDOWN_MS`
- `HEALTHCHECK_TOKEN`
- `INTERNAL_PROXY_VALUE`

## Docker

Build:

```bash
docker build -t birdnet-dashboard:latest .
```

Run (example):

```bash
docker run --rm -p 8080:80 \
  -e BIRDNET_API_BASE_URL=http://birdnet-go:8080 \
  -e HEALTHCHECK_TOKEN=change-me \
  -v $(pwd)/.cache:/cache \
  birdnet-dashboard:latest
```

Persistent `/cache` storage is recommended so cache snapshots survive container restarts.

## API Surface

Exposed app API routes:

- `GET /api/v2/summary/30d`
- `GET /api/v2/detections`
- `GET /api/v2/detections/recent`
- `GET /api/v2/species`
- `GET /api/v2/family-matches`

All other `/api/*` routes return `404`.

## Health Endpoints

- `/healthz` basic liveness
- `/readyz` readiness (cache warm state)
- `/cachez` cache health/status

These endpoints are protected at the proxy level and are intended for trusted monitoring only.

## Demo Deployment (GitHub Pages)

A Pages workflow is included at `.github/workflows/demo-pages.yml`.
It builds the app in demo mode with mock data and sanitized public branding.

## Security

See `SECURITY.md` for reporting and security policy details.

## License

Project license is defined in the repository license file.
