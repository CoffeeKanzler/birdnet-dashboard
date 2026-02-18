# Family Function Rate-Limit Fix Roadmap

**Status: PLANNED**
**Target branch: `main`**

## Problem

The family matches logic in `src/features/species/SpeciesDetailView.tsx` can trigger too many API requests in a short time. It currently does broad detection-page scans and many per-species lookups, which causes fast `429` rate-limit responses.

Current hotspots:
- `MAX_BACKGROUND_PAGES = 120`
- `MAX_SPECIES_INFO_CALLS = 24`
- `MAX_SPECIES_INFO_CALLS_BACKGROUND = 120`
- `LOOKUP_CONCURRENCY = 6`
- repeated `fetchSpeciesInfo(...)` calls for many unresolved species

## Goals

- Keep family matches useful in the species detail view.
- Avoid burst traffic that triggers rate limits.
- Make behavior predictable with strict request budgets.
- Degrade gracefully when budgets are exhausted.
- Correctly match species when family fields contain multiple values.
- Move family matching network fan-out out of the browser.

## Non-goals

- Rewriting unrelated archive/statistics flows.
- Adding a heavy backend service in the first iteration.

## Target Behavior

- Frontend should call only one Node endpoint for family matches.
- Species detail should never fire an unbounded background crawl.
- Family matching should run within a strict per-view request budget.
- UI should show partial/cached results quickly and not block on exhaustive matching.
- On `429`, the feature should back off and stop retry storms.
- Family matching should work for both single-family and multi-family labels.

## Implementation Plan

### Phase 1: Immediate Guardrails (fast fix)

1. Route all family matching through Node:
- Frontend uses one internal endpoint (`/api/v2/family-matches`) and stops direct fan-out calls.
- Node owns all upstream requests, rate-limit handling, and caching.

2. Enforce hard request budgets:
- Max species-info lookups per detail load: 6-10 total.
- Concurrency cap: 2 (not 6).
- Time budget: stop additional lookups after a short window (example: 1.5s).

3. Prioritize cached data first:
- Use query cache and only fetch unresolved species until budget is consumed.
- Return partial matches once budget is reached (no more network fan-out).

4. Add explicit rate-limit handling:
- On first `429`, stop remaining family lookups for that request cycle.
- Set temporary cooldown (example: 60s) before next family lookup attempt.

### Phase 2: Data Shape Improvement (low risk)

1. Precompute species-family index:
- Build and cache `scientificName -> normalized family tokens[]`.
- Prefer data already present in fetched payloads; backfill only missing entries under budget.

2. Build species-family index from already-fetched detection pages:
- If detection payload already includes family data, avoid per-species info calls entirely.
- If not present, keep strict lookup budget from Phase 1.

3. Introduce shared in-memory session cache:
- Cache `scientificName -> familyCommon` for current app session.
- Reuse across species detail navigations to avoid repeated calls.

4. Add stale-while-revalidate behavior:
- Serve cached family matches immediately.
- Refresh in background only within request/concurrency budgets.

5. Add multi-family normalization/parser:
- Parse family labels into tokens using separators (`,`, `/`, `;`, `|`, `&`, `+`) and conjunction words (`and`, `und`).
- Normalize spacing/case/diacritics for stable comparison.
- Match by token intersection, not strict full-string equality.

### Phase 3: Structural Fix (permanent)

1. Keep backend-aggregated endpoint as canonical path:
- Server endpoint computes top family-related species with bounded workload.
- Frontend remains a thin client and never returns to multi-call fan-out.

2. Add server-side caching and refresh policy:
- Cache endpoint response with hourly refresh and stale grace.
- Keep response size bounded (example: top 20).

3. Move rate-limit protection to server boundary:
- Centralized throttling/backoff avoids many clients generating duplicate bursts.

## Observability and Verification

Add metrics/log fields:
- family lookup requests per detail view load
- species-info calls made vs budget
- rate-limit (`429`) count for family flow
- cooldown activated count
- median and p95 family-section load time

Add test coverage:
- unit: budget cutoff behavior
- unit: `429` cooldown and stop-on-rate-limit behavior
- integration: cached-first and partial-result rendering
- e2e: species page remains responsive when API returns `429`

## Acceptance Criteria

- No more burst pattern from detail view that triggers immediate `429`.
- Max network calls per family load stays within configured budget.
- Family section still renders useful results from cache/partial data.
- Repeated navigation between species does not multiply request volume linearly.
- Browser network trace for species detail shows a single family endpoint call (plus unrelated page assets).

## Suggested Rollout

1. Ship Phase 1 with feature flag defaults enabled.
2. Monitor `429` and latency for 24-48h on dev/prod.
3. If stable, implement Phase 2 cache/index improvements.
4. Plan Phase 3 endpoint in a separate PR with API contract review.
