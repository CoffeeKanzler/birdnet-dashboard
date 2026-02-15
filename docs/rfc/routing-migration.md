# RFC: Routing Migration to React Router

Status: proposed

## Context

The app currently manages URL state manually in `src/App.tsx`.
This works for current screens, but increases complexity for:

- back/forward navigation correctness,
- deep linking and nested states,
- integration tests and future feature growth.

## Goal

Move from manual URL handling to React Router while preserving existing routes:

- `?view=landing`
- `?view=today`
- `?view=archive`
- `?view=rarity`
- `?view=species&from=<view>&common=<name>&scientific=<name>`

## Decision

Adopt React Router incrementally with route-level components and a compatibility
layer for current query-based links.

## Transition Strategy

### Phase 1: Introduce Router shell (no URL breakage)

- Add React Router and wrap app in `BrowserRouter`.
- Keep existing query params as source of truth.
- Move view parsing/serialization into dedicated route adapter module.

### Phase 2: Route ownership by feature

- Define feature routes (`/`, `/today`, `/archive`, `/rarity`, `/species`).
- Keep query compatibility by redirecting old `?view=...` links.
- Move navigation actions to router navigation APIs.

### Phase 3: Remove manual history state

- Remove direct `window.history.pushState/replaceState` usage from `App.tsx`.
- Keep one canonical route model and typed route params.

## Acceptance Criteria

- Deep links for all five views work directly in browser address bar.
- Browser back/forward works without custom popstate handlers.
- Existing shared links with `?view=...` still resolve via redirects.
- Integration tests cover view navigation and species-detail back behavior.

## Risks

- Route mapping bugs can break shared links.
- Species detail state may regress if route params are not normalized.

## Rollback

- Keep manual routing branch available until phase 2 is validated.
- Revert router wiring and restore `App.tsx` history handling if needed.
