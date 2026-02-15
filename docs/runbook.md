# Operations Runbook

## Scope

This runbook covers the most common frontend operational issues:

1. BirdNET API is unavailable or degraded.
2. Species image loading fails repeatedly.
3. New deployment appears healthy but UI is stale/broken.

## 1) BirdNET API down

### Symptoms

- UI panels show fetch errors for detections/species.
- `npm run build` and static assets are fine, but runtime data is missing.

### Checks

1. Confirm API endpoint reachability from frontend host.
2. Confirm reverse proxy routes for `/api/v2/*` are active.
3. Inspect container logs for backend and frontend proxy.

### Mitigation

- Restore backend service connectivity first.
- If temporary outage, show user-facing retry guidance in status channel.

## 2) Image fetch issues (Wikimedia/Wikipedia)

### Symptoms

- Many species cards remain on fallback image state.
- Attribution list shows many "Kein Bild geladen" rows.

### Checks

1. Verify outbound network access to Wikimedia/Wikipedia endpoints.
2. Check browser console for repeated image API failures.
3. Confirm retry/backoff behavior is active (`useSpeciesPhoto`).

### Mitigation

- Keep app functional without images; this is non-critical for detections.
- If external outage persists, add temporary UI banner for image source outage.

## 3) Deployment looks stale or broken

### Symptoms

- New release deployed, but users still see old behavior.
- Unexpected 404/403 responses for API routes.

### Checks

1. Confirm new image digest/container tag is running.
2. Validate NGINX config and API route restrictions.
3. Hard refresh browser and clear service-worker/cache layers (if applicable).

### Mitigation

- Roll back to previous known-good image.
- Re-deploy after config validation.

## Validation Commands

Run before/after mitigation:

```bash
npm run lint
npm run test
npm run build
```
