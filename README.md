# BirdNET Dashboard

BirdNET Dashboard is a React + TypeScript frontend for browsing BirdNET-Go detections.
It provides live highlights, day and archive views, species detail pages, rarity spotlights,
and Wikimedia-based image attribution data.

## Project docs

- UI guidelines: `UI_GUIDELINES.md`
- Security policy: `SECURITY.md`
- Technical review and roadmap: `technicalreview.md`
- Architecture and operations docs: `docs/README.md`

## Features

- Live landing page with highlighted recent detections
- Today and archive detection views with pagination-aware data loading
- Species detail view with family-level related species enrichment
- Rarity spotlight view and notable species matching
- Wikimedia/Wikipedia photo loading with attribution modal
- Dark/light theme toggle and URL-driven navigation state

## Tech stack

- Vite + React 18 + TypeScript
- Tailwind CSS 4
- ESLint for linting
- Vitest + Testing Library for unit/integration tests
- Docker multi-stage build (Node 24 + NGINX)

## Prerequisites

- Node.js 24
- npm 11+

You can use `.nvmrc`:

```bash
nvm use
```

## Local development

```bash
npm ci
npm run dev
```

Default dev server: `http://localhost:5173`

## Environment variables

- `VITE_BIRDNET_API_BASE_URL` (optional)
  - Example: `http://localhost:8080`
  - If unset, frontend uses relative `/api/v2/...` paths.

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

## NPM scripts

- `npm run dev` - start Vite dev server
- `npm run lint` - run ESLint
- `npm run test` - run Vitest once
- `npm run test:watch` - run Vitest in watch mode
- `npm run build` - type-check and create production bundle
- `npm run preview` - preview production build locally

## Architecture overview

- `src/api/` - API client, BirdNET data API, image/attribution API
- `src/features/` - feature modules (`detections`, `landing`, `rarity`, `species`)
- `src/data/` - curated species metadata and descriptions
- `src/App.tsx` - shell, top-level view routing, attribution modal
- `docker/` - NGINX runtime config for containerized deployment

## Deployment

Build container image:

```bash
docker build -t birdnet-dashboard .
```

The image serves static assets via NGINX and proxies allowed API paths defined in
`docker/nginx.conf`.

## Known gaps

- E2E smoke tests are not yet in place.
- Router migration (from manual URL state to dedicated router) is still planned.
- Additional observability instrumentation is still planned.

## Troubleshooting

- `npm run test` fails in older Node versions:
  - Ensure `node -v` reports Node 24.
- API calls fail in dev:
  - Verify `VITE_BIRDNET_API_BASE_URL` and backend reachability.
- Missing species images:
  - Wikimedia lookups can be incomplete; retry is automatic with backoff.
