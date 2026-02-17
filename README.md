# BirdNET Dashboard

Whitelabel-ready frontend for BirdNET-Go with fast cached navigation, precomputed summary APIs, and graceful fallback when the live backend is temporarily unavailable.

## What this is

- React + TypeScript frontend for BirdNET detections
- NGINX + Node wrapper runtime (single container image)
- Designed for small/self-hosted servers with limited CPU/RAM/traffic budget
- Supports separate `dev` and `prod` deployments from the same codebase

## Key capabilities

- Live landing page with auto-refresh
- Today, Archive, Highlights, and Statistics views
- Whitelabel branding via build args/env vars
- Precomputed 30-day summary endpoint (`/api/v2/summary/30d`)
- Disk-backed caches to survive container restarts
- Stale-mode fallback when BirdNET-Go is unreachable

## Runtime behavior (important)

This app now has two cache layers:

1. `summary-30d.json` (disk-backed)
- Used by Archive/Highlights/Statistics
- Served via `/api/v2/summary/30d`
- Survives container restarts

2. `recent-detections.json` (disk-backed)
- Used as fallback for live detection APIs
- Powers degraded mode for Live/Today when backend is down

### Response headers

Wrapper endpoints expose cache mode via headers:

- `x-summary-cache: fresh | stale | warming`
- `x-detections-cache: live | stale`

UI uses these to show degraded notices and avoid showing "Live" when data is stale.

## Whitelabel configuration

Whitelabel is controlled at build-time by `VITE_*` args.

### Supported build args

- `VITE_SITE_NAME`
- `VITE_SITE_TAGLINE`
- `VITE_SITE_SUBTITLE`
- `VITE_LOCALE` (`de` or `en`)
- `VITE_DEFAULT_THEME` (`light`, `dark`, `system`)
- `VITE_BIRDNET_API_BASE_URL` (usually empty for same-origin proxy)

Example Docker build:

```bash
docker build \
  --build-arg VITE_SITE_NAME="My Birds" \
  --build-arg VITE_SITE_TAGLINE="Live detections from my garden" \
  --build-arg VITE_SITE_SUBTITLE="BirdNET-Go" \
  --build-arg VITE_LOCALE="en" \
  --build-arg VITE_DEFAULT_THEME="system" \
  -t birdnet-dashboard:custom .
```

## Runtime env vars (wrapper)

These are evaluated inside the container at runtime:

- `BIRDNET_API_BASE_URL` (default: `http://birdnet-go:8080`)
- `SUMMARY_CACHE_FILE` (default: `/cache/summary-30d.json`)
- `RECENT_CACHE_FILE` (default: `/cache/recent-detections.json`)
- `RECENT_SNAPSHOT_LIMIT` (default: `2000`)
- `RECENT_REFRESH_MS` (default: `900000` / 15min)
- `UPSTREAM_TIMEOUT_MS` (default: `12000`)
- `MAX_SUMMARY_PAGES` (default: `5000`)

`INTERNAL_PROXY_VALUE` is generated automatically in `docker/start.sh` if not provided.

## Required persistent volume

Mount `/cache` to host storage so summary/recent snapshots survive recreates.

Example:

```yaml
services:
  birdnet-showoff:
    build:
      context: /opt/user/birdnet-dashboard-prod
      dockerfile: /opt/user/birdnet-dashboard-prod/Dockerfile
      args:
        VITE_SITE_NAME: "BirdNET Dashboard"
        VITE_SITE_TAGLINE: "Live-Erkennungen aus der garden."
        VITE_SITE_SUBTITLE: "BirdNET-Go"
        VITE_LOCALE: "de"
        VITE_DEFAULT_THEME: "system"
    environment:
      - SUMMARY_CACHE_FILE=/cache/summary-30d.json
      - RECENT_CACHE_FILE=/cache/recent-detections.json
    volumes:
      - /opt/user/birdnet-dashboard-cache/prod:/cache
```

## Proxy/API model

The container exposes only a controlled API surface.

Allowed paths:

- `GET/HEAD /api/v2/summary/30d`
- `GET/HEAD /api/v2/detections`
- `GET/HEAD /api/v2/detections/recent`
- `GET/HEAD /api/v2/species`

All other `/api/*` return `404`.

## Fallback expectations

When BirdNET-Go is down:

- Live page: still loads using recent snapshot, shows degraded banner, timestamps as "X min ago"
- Today page: still loads from stale snapshot and shows degraded banner
- Archive/Highlights/Statistics: continue from cached summary snapshot
- Species details may be limited if uncached upstream data is required

## Local development

```bash
nvm use
npm ci
npm run dev
```

Build validation:

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Deploy workflow used in this repo

Dev and prod are separate working directories:

- Dev source: `/opt/user/birdnet-dashboard`
- Prod source checkout: `/opt/user/birdnet-dashboard-prod`
- Compose file: `/opt/user/homelab-compose.yml`

Typical release flow:

1. Commit and push from `birdnet-dashboard`
2. Tag release (`vX.Y.Z`)
3. In `birdnet-dashboard-prod`, checkout that tag
4. Rebuild/redeploy `birdnet-showoff` via compose

## Security notes

- Wrapper server binds to loopback inside container (`127.0.0.1:3001`)
- Internal proxy header is required for wrapper API access
- NGINX enforces allowed methods/query shapes and rate/connection limits
- Security headers are enabled (CSP, HSTS, X-Frame-Options, etc.)
- Keep network segmentation (edge/backend/traefik) in compose

## Project structure

- `src/` frontend app and views
- `server/server.mjs` wrapper API + cache logic
- `docker/nginx.conf` API allowlist and proxying
- `docker/start.sh` runtime startup and secret generation
- `e2e/` Playwright tests

## License

See repository license file.
