# Code Review: BirdNET Dashboard — Main Branch

**Date:** 2026-02-17
**Scope:** Full review of `main` — Security, Code Quality, Maintainability, Testing, CI/CD, Accessibility, Performance, Docker/Deployment

---

## Overall Assessment

The codebase is well-structured and demonstrates strong engineering fundamentals: strict TypeScript, centralized API client with typed errors, comprehensive Nginx hardening, defense-in-depth security headers, and a clear feature-based directory layout. The addition of TanStack React Query and i18n support are positive architectural moves.

That said, the review identified several actionable issues across all review categories. Findings are grouped by area and prioritized within each section.

---

## 1. Security

### 1.1 HIGH — `index.html` lang attribute mismatch

**File:** `index.html:2`

```html
<html lang="en">
```

The default locale is `de` (German), but the HTML lang attribute is hardcoded to `en`. Screen readers and search engines use this attribute to determine content language. This should be dynamically set or default to `de`.

**Suggestion:** Set `lang="de"` in `index.html` (matching the default locale), or inject the locale at build time via Vite's `transformIndexHtml` hook.

---

### 1.2 HIGH — CSP `connect-src` missing `en.wikipedia.org`

**Files:** `docker/nginx.conf:8`, `server/server.mjs:20`

The CSP header allows `connect-src 'self' https://de.wikipedia.org https://commons.wikimedia.org https://upload.wikimedia.org` — but the app fetches from `https://en.wikipedia.org` as a fallback (`src/api/birdImages.ts:89`). This means English Wikipedia fallback requests will be blocked by CSP in production.

**Suggestion:** Add `https://en.wikipedia.org` to `connect-src` in both nginx.conf and server.mjs.

---

### 1.3 MEDIUM — CSP wildcard on `img-src`

**Files:** `docker/nginx.conf:8`, `server/server.mjs:20`

```
img-src 'self' data: https://upload.wikimedia.org https://*.wikimedia.org
```

The wildcard `https://*.wikimedia.org` is overly broad. Only `upload.wikimedia.org` and `commons.wikimedia.org` are used.

**Suggestion:** Replace the wildcard with explicit domains:
```
img-src 'self' data: https://upload.wikimedia.org https://commons.wikimedia.org
```

---

### 1.4 MEDIUM — Internal proxy header defaults to weak value

**File:** `server/server.mjs:33`

```javascript
const INTERNAL_PROXY_VALUE = process.env.INTERNAL_PROXY_VALUE ?? '1'
```

If `start.sh` fails to set the env var or the server is run outside Docker, the proxy auth token is just `'1'`. While the server only binds to localhost, this violates defense-in-depth.

**Suggestion:** Throw an error if `INTERNAL_PROXY_VALUE` is not set, or generate a random value at server startup:
```javascript
const INTERNAL_PROXY_VALUE = process.env.INTERNAL_PROXY_VALUE
if (!INTERNAL_PROXY_VALUE) {
  throw new Error('INTERNAL_PROXY_VALUE environment variable is required')
}
```

---

### 1.5 MEDIUM — i18n `t()` uses RegExp constructor with unescaped keys

**File:** `src/i18n/index.ts:34`

```typescript
value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue))
```

`paramKey` is inserted directly into a RegExp pattern. If a key ever contains regex metacharacters (e.g., `(`, `+`, `*`), this will either match unintended strings or throw a SyntaxError. Currently all keys are hardcoded strings, so the practical risk is low, but this is a latent vulnerability.

**Suggestion:** Use `String.prototype.replaceAll()` instead of RegExp:
```typescript
value = value.replaceAll(`{${paramKey}}`, String(paramValue))
```

---

### 1.6 LOW — Missing `try-catch` around `localStorage.getItem` in theme init

**File:** `src/App.tsx:32`

```typescript
const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
```

`getItem` can throw in restricted contexts (some corporate browsers, iframe sandboxes). The `dayCache.ts` module wraps storage access in try-catch, but `getInitialTheme()` does not.

**Suggestion:** Wrap in try-catch for consistency:
```typescript
const getInitialTheme = (): ThemeMode => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* ignore */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
```

---

### 1.7 LOW — No URL validation for `VITE_BIRDNET_API_BASE_URL`

**File:** `src/api/apiClient.ts:66-72`

The API base URL is read from an environment variable and used directly in URL construction. No validation ensures it is a valid HTTP(S) URL. A misconfigured value (e.g., `javascript:`) could be a risk, though Nginx proxying mitigates this in production.

**Suggestion:** Validate the URL at startup:
```typescript
if (baseUrl) {
  try {
    const url = new URL(baseUrl, window.location.origin)
    if (!url.protocol.startsWith('http')) return ''
  } catch { return '' }
}
```

---

### 1.8 LOW — No Subresource Integrity for Google Fonts

**File:** `src/index.css:1`

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:...');
```

External stylesheet loaded without SRI. If the Google Fonts CDN were compromised, malicious CSS could be injected. SRI is difficult to apply to CSS `@import` — consider self-hosting the font file or loading it via a `<link>` tag with integrity in `index.html`.

---

### 1.9 INFO — Nginx regex complexity in query validation

**File:** `docker/nginx.conf:51`

The regex for `/api/v2/detections` query validation is a single 400+ character pattern with deeply nested alternation. While functional, this is:
- Hard to read and maintain
- A potential (minor) ReDoS vector with nginx's PCRE engine
- Error-prone for future modifications

**Suggestion:** Consider splitting into multiple `if` blocks or using an `nginx map` directive for parameter-by-parameter validation.

---

## 2. Code Quality

### 2.1 HIGH — No React Error Boundary

**File:** `src/App.tsx`

The entire app renders inside a single tree with no Error Boundary. If any component throws during render (e.g., a malformed API response triggers an unexpected TypeError), the whole app crashes to a white screen.

**Suggestion:** Add an Error Boundary wrapping the view components in `App.tsx`. This is especially important for `SpeciesDetailView` which contains complex async logic.

```tsx
<ErrorBoundary fallback={<ErrorFallback onRetry={() => window.location.reload()} />}>
  {/* view rendering */}
</ErrorBoundary>
```

---

### 2.2 HIGH — `SpeciesDetailView` complexity and missing cancellation

**File:** `src/features/species/SpeciesDetailView.tsx:128-423`

`loadFamilyMatches` is a 300-line async callback that:
- Makes up to 120 paginated fetches
- Runs up to 120 concurrent `fetchSpeciesInfo` calls
- Uses `familyRequestIdRef` for stale-request detection but no `AbortSignal` to cancel in-flight HTTP requests

When the component unmounts or species changes, abandoned requests continue executing in the background, consuming bandwidth and potentially updating stale state (the `requestId` check only guards `setState`, not the fetch itself).

**Suggestions:**
1. Pass an `AbortSignal` from a `useEffect` cleanup to `loadFamilyMatches` and forward it to all `fetchDetectionsPage`/`fetchSpeciesInfo` calls.
2. Extract this logic into a dedicated hook (`useFamilyMatches`) or use React Query's built-in query management.
3. Consider reducing the 698-line component into smaller pieces.

---

### 2.3 MEDIUM — `useMediaQuery` defined inside component

**File:** `src/features/landing/LandingView.tsx:7-18`

The `useMediaQuery` custom hook is defined as a module-level function, which is fine — but it creates a new `matchMedia` listener each time `query` changes. Since `LandingView` calls it twice with static strings, this is acceptable, but the hook should guard against the SSR case more defensively.

Note: The hook itself is correctly implemented at module level, not inside the component. No change needed unless it needs reuse elsewhere (then extract to `src/utils/`).

---

### 2.4 MEDIUM — Umlaut conversion is lossy and overly broad

**File:** `src/features/species/SpeciesDetailView.tsx:35-43`

```typescript
const withUmlauts = (value: string): string => {
  return value
    .replace(/Ae/g, 'Ä')
    .replace(/Oe/g, 'Ö')
    .replace(/Ue/g, 'Ü')
    .replace(/ae/g, 'ä')
    .replace(/oe/g, 'ö')
    .replace(/ue/g, 'ü')
}
```

This creates false positives: "Gruen" → "Grün" (correct), but "Aerosmith" → "Ärosmith" and "Maelstrom" → "Mälstrom" would be wrong. In the context of species descriptions this is less likely, but the function name doesn't indicate it's approximate.

**Suggestion:** Either add a comment documenting the limitation or restrict the replacement to known patterns (e.g., word boundaries, German-specific heuristics).

---

### 2.5 MEDIUM — Navigation button repetition in header

**File:** `src/App.tsx:267-361`

Six navigation buttons are nearly identical (same classes, same onClick pattern), differing only in label and view name. This is ~95 lines of duplicated JSX.

**Suggestion:** Extract a `NavButton` component or map over an array of view definitions:
```tsx
const NAV_ITEMS: Array<{ view: MainView; label: string }> = [
  { view: 'landing', label: t('nav.live') },
  { view: 'today', label: t('nav.today') },
  // ...
]
```

---

### 2.6 LOW — Inconsistent `void` operator usage

**Files:** `src/App.tsx:432`, `src/features/species/SpeciesDetailView.tsx:634`

Some Promise-returning calls use `void refresh()` and others use `() => { refresh() }` without `void`. Be consistent — the `void` operator is the correct pattern when intentionally discarding a Promise.

---

### 2.7 LOW — `parseRouteState` called during render and in effect

**File:** `src/App.tsx:94, 121`

`parseRouteState()` is called synchronously during render (line 94) and again in a `useEffect` (line 121). The effect then calls `replaceState`. This double-parse is harmless but redundant.

**Suggestion:** Remove the useEffect at line 120-124 or use `useMemo` for the initial state.

---

## 3. Testing

### 3.1 CRITICAL — Major files have zero test coverage

The following high-risk files have no unit or integration tests:

| File | Lines | Risk |
|------|-------|------|
| `src/api/birdImages.ts` | 482 | **Critical** — Photo fetching, caching, attribution, Wikipedia fallback |
| `src/features/detections/useArchiveDetections.ts` | 377 | **Critical** — Pagination, deduplication, batch parallelization |
| `src/features/detections/dayCache.ts` | 91 | **High** — localStorage caching with TTL |
| `src/features/detections/useDetections.ts` | 85 | **Medium** — Core data hook |
| `src/features/detections/useSummary30d.ts` | 55 | **Medium** — Summary hook with pending state |
| `src/features/detections/useSpeciesPhoto.ts` | 48 | **Medium** — Photo query hook |
| `src/features/species/useSpeciesDetections.ts` | ~50 | **Medium** — Species detection hook |
| `src/utils/date.ts` | 13 | **Low** — Date formatting |
| `src/utils/dateRange.ts` | 41 | **Low** — Date parsing |
| `src/utils/scroll.ts` | 21 | **Low** — Scroll utilities |

The 95% coverage threshold in `vitest.config.ts` is good, but these files represent significant untested business logic. `birdImages.ts` alone has multi-layer caching, LRU eviction, inflight deduplication, and API fallback chains.

**Suggestion:** Prioritize tests for `birdImages.ts`, `useArchiveDetections.ts`, and `dayCache.ts`. These contain the most complex conditional logic and the highest risk of subtle bugs.

---

### 3.2 HIGH — No view component unit tests

All feature view components (`LandingView`, `TodayView`, `ArchiveView`, `SpeciesDetailView`, `RarityView`, `StatisticsView`) lack unit/integration tests. They are only covered by E2E tests, which are slower, harder to debug, and don't test edge cases well.

**Suggestion:** Add React Testing Library tests for critical view behaviors: error states, empty states, loading states, and callback invocations.

---

### 3.3 HIGH — E2E mock uses `new Date()` for test data

**File:** `e2e/support/mockBirdnet.ts`

Test data generation uses `new Date()`, making tests sensitive to the time they run. Tests crossing midnight may produce different results.

**Suggestion:** Use a fixed date in mock data generation to eliminate time-dependent flakiness.

---

### 3.4 MEDIUM — Missing edge case tests for API client

**File:** `src/api/apiClient.test.ts`

The test suite covers the happy path and basic error scenarios but is missing:
- HTTP 408, 425 (retryable status codes)
- HTTP 502, 503 (service errors)
- Response with wrong `Content-Type` header
- Timeout with partial response body
- Concurrent request cancellation

---

### 3.5 MEDIUM — Missing error scenario tests for `errorMessages.ts`

**File:** `src/utils/errorMessages.test.ts`

Tests cover 401, 404, 429, 500, 418 status codes but miss:
- 408, 425 (retryable codes handled by apiClient)
- 502, 503 (gateway errors)
- Error objects with no status code
- Network errors vs timeout errors

---

### 3.6 LOW — `vitest.config.ts` uses `globals: true`

**File:** `vitest.config.ts:12`

Global test functions (`describe`, `it`, `expect`) hide dependencies and reduce explicitness. This is a minor style concern but worth noting.

---

## 4. CI/CD & DevOps

### 4.1 MEDIUM — No CI job timeout

**File:** `.github/workflows/ci.yml`

Neither `quality-gate` nor `e2e-smoke` jobs specify a `timeout-minutes`. A hung test or build can block CI indefinitely.

**Suggestion:** Add `timeout-minutes: 15` to each job.

---

### 4.2 MEDIUM — No coverage artifact upload

**File:** `.github/workflows/ci.yml`

Coverage reports are generated but not uploaded as artifacts. This means there's no way to track coverage trends over time or review coverage in PRs.

**Suggestion:** Add an `actions/upload-artifact` step for coverage reports.

---

### 4.3 MEDIUM — No concurrency control

**File:** `.github/workflows/ci.yml`

Multiple pushes to the same branch trigger parallel CI runs. Stale runs waste resources.

**Suggestion:** Add concurrency group:
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

---

### 4.4 LOW — E2E uses dev server instead of preview build

**File:** `playwright.config.ts:18`

```typescript
command: 'npm run dev -- --host 127.0.0.1 --port 4173',
```

E2E tests run against the Vite dev server, not a production-like preview build. This means E2E tests don't catch production build issues (e.g., tree-shaking removing needed code, CSS purging issues).

**Suggestion:** Use `npm run preview` or pre-build and serve:
```typescript
command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
```

---

### 4.5 LOW — Trivy `ignore-unfixed: true` may hide real issues

**File:** `.github/workflows/security.yml`

Ignoring unfixed vulnerabilities is pragmatic for avoiding false positives, but should be paired with an allowlist/baseline to track known-unfixed issues explicitly.

---

### 4.6 LOW — No SBOM generation

The security workflow scans for vulnerabilities but doesn't generate a Software Bill of Materials. For supply chain transparency, consider adding SBOM generation with `@cyclonedx/cyclonedx-npm` or Syft.

---

## 5. Docker & Deployment

### 5.1 MEDIUM — Dockerfile runs as root

**File:** `Dockerfile:28-43`

The Nginx Alpine stage doesn't create or switch to a non-root user. Both Nginx and the Node wrapper server run as root inside the container.

**Suggestion:** Add a non-root user:
```dockerfile
RUN addgroup -S app && adduser -S app -G app
# ... (Nginx needs root for port 80, so use a higher port or capabilities)
```

Alternatively, run Nginx on port 8080 and map externally.

---

### 5.2 MEDIUM — No health check endpoint

**Files:** `Dockerfile`, `server/server.mjs`

Neither the Dockerfile nor the Node wrapper server provides a health check endpoint. Docker orchestrators (Compose, Kubernetes) can't verify the container is healthy.

**Suggestion:** Add a `HEALTHCHECK` instruction in the Dockerfile and a `/healthz` endpoint in the wrapper server.

---

### 5.3 LOW — No `.dockerignore` file

No `.dockerignore` was found. The `COPY . .` in the build stage copies everything, including `node_modules/`, `.git/`, `e2e/`, `docs/`, and IDE files. This bloats the build context and slows down builds.

**Suggestion:** Add a `.dockerignore`:
```
node_modules
.git
e2e
docs
coverage
*.md
```

---

### 5.4 LOW — `server/server.mjs` has no graceful shutdown

**File:** `server/server.mjs:631-641`

The server starts listening and sets up intervals, but has no `SIGTERM`/`SIGINT` handler. When Docker stops the container, in-flight requests are dropped immediately.

**Suggestion:** Add graceful shutdown:
```javascript
const shutdown = () => {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5000)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
```

---

### 5.5 LOW — No `server/server.mjs` tests

The Node wrapper server (642 lines) has zero tests. It contains complex caching logic, fallback behavior, concurrent page fetching, and summary aggregation. Given that this is production-critical infrastructure, it should have its own test suite.

---

## 6. Accessibility

### 6.1 HIGH — Interactive `<article>` with `role="button"`

**File:** `src/features/landing/LandingView.tsx:81-96`

```tsx
<article
  role={isInteractive ? 'button' : undefined}
  tabIndex={isInteractive ? 0 : undefined}
  onClick={isInteractive ? handleSelect : undefined}
  onKeyDown={isInteractive ? ... : undefined}
>
```

An `<article>` element with `role="button"` is semantically confusing. Articles are landmark elements for screen readers. Using an `<article>` that behaves as a button creates conflicting semantics.

**Suggestion:** Wrap the card content in a `<button>` element or use a `<div>` instead of `<article>` when interactive. Or nest an invisible button inside the article.

---

### 6.2 MEDIUM — Attribution modal has no focus trap or Escape key handling

**File:** `src/App.tsx:437-541`

The attribution modal overlay renders as a `<div>` with no:
- Focus trap (Tab can escape to elements behind the overlay)
- `Escape` key handler to close
- `role="dialog"` or `aria-modal="true"`
- `aria-labelledby` linking to the heading

**Suggestion:** Add dialog semantics and keyboard handling:
```tsx
<div role="dialog" aria-modal="true" aria-labelledby="attribution-heading" onKeyDown={(e) => e.key === 'Escape' && close()}>
```

Consider using the native `<dialog>` element or a focus-trap library.

---

### 6.3 MEDIUM — No skip navigation link

**File:** `src/App.tsx:246`

The sticky header contains 8+ interactive elements. Keyboard users must tab through all of them on every page to reach main content.

**Suggestion:** Add a visually hidden "Skip to content" link as the first focusable element:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only ...">Zum Inhalt springen</a>
```

---

### 6.4 LOW — Color-only status indicators

**File:** `src/features/species/SpeciesDetailView.tsx:70-79`

Confidence badges use green/amber/red colors to indicate levels. Users with color vision deficiency cannot distinguish these.

**Suggestion:** Add text labels or icons alongside the color indicators (the percentage text is already there, so this is partially addressed — but the badge colors alone shouldn't be the sole differentiator in summary views).

---

## 7. Performance

### 7.1 MEDIUM — Background family match scanning is unbounded

**File:** `src/features/species/SpeciesDetailView.tsx:277-317`

The background scan fetches up to `MAX_BACKGROUND_PAGES = 120` pages of 500 detections each (60,000 detections). Each page triggers a network request. On a mobile connection or constrained device, this is excessive.

**Suggestion:** Add network-awareness (e.g., check `navigator.connection?.effectiveType`) or reduce the default scan depth for initial load, expanding only on user request.

---

### 7.2 LOW — `getPhotoAttributionRecords` sorts on every call

**File:** `src/api/birdImages.ts:143-152`

```typescript
export const getPhotoAttributionRecords = (): PhotoAttributionRecord[] => {
  return Array.from(attributionRegistry.values()).sort(...)
}
```

This is called during render in `App.tsx:137`. Every time the attribution modal is opened, the full registry is copied and sorted. With 600 entries this is fine, but it could be memoized.

---

### 7.3 LOW — Scroll event handler recreated on every render

**File:** `src/App.tsx:161-178`

The `handleScroll` function is defined inside a `useEffect` with an empty dependency array, so it's actually created only once. No issue here — the implementation is correct.

---

## 8. Maintainability & Architecture

### 8.1 MEDIUM — No code formatter configured

No Prettier (or alternative formatter) configuration was found. The codebase relies on ESLint for style enforcement, but ESLint is not a formatter. Without a formatter, inconsistencies in whitespace, quote style, and line length will accumulate over time.

**Suggestion:** Add Prettier with a minimal config (`.prettierrc`) and integrate it into the lint command or as a pre-commit hook.

---

### 8.2 MEDIUM — Security headers duplicated in two places

**Files:** `docker/nginx.conf:8-13`, `server/server.mjs:18-26`

The same CSP and security headers are maintained in both Nginx config and the Node wrapper server. When one is updated, the other may be forgotten (as demonstrated by the missing `en.wikipedia.org` in `connect-src`).

**Suggestion:** Either:
- Generate both configs from a single source of truth (e.g., a shared JSON file processed at build time), or
- Remove the headers from server.mjs since Nginx adds them to all responses anyway (the Node server is only reachable via Nginx)

---

### 8.3 MEDIUM — `server/server.mjs` is untyped JavaScript

**File:** `server/server.mjs` (642 lines)

The wrapper server is the only significant JavaScript file in an otherwise fully typed TypeScript project. It handles critical caching, proxying, and fallback logic without any type safety.

**Suggestion:** Convert to TypeScript (e.g., `server.ts` compiled with `tsc` or `tsx`), or at minimum add JSDoc type annotations.

---

### 8.4 LOW — No `@typescript-eslint/no-explicit-any` rule

**File:** `.eslintrc.cjs`

The ESLint config extends `@typescript-eslint/recommended` but doesn't explicitly enable `no-explicit-any`. Since the codebase uses strict mode, adding this rule would catch any `any` types that slip through.

---

### 8.5 LOW — No `no-console` ESLint rule

**File:** `.eslintrc.cjs`

Production frontend code should not contain `console.log` statements. Adding `no-console: 'warn'` would catch accidental debug logging.

---

### 8.6 LOW — Missing `.dockerignore`

(See 5.3 above — listed here for completeness)

---

## 9. Documentation

### 9.1 LOW — Stale `CLAUDE.md` project structure

**File:** `CLAUDE.md`

The documented project structure doesn't reflect all current directories and files. Missing entries include:
- `src/config/site.ts` (whitelabel configuration)
- `src/api/queryClient.ts` and `queryKeys.ts` (TanStack Query)
- `src/api/summary.ts` (summary API)
- `src/i18n/` (internationalization)
- `src/features/statistics/` (statistics view)
- `server/` (Node wrapper server)
- `docker/start.sh` and `docker/nginx.main.conf`

**Suggestion:** Update the project structure section to match the actual codebase.

---

### 9.2 LOW — RFC status not tracked

**Files:** `docs/rfc/routing-migration.md`, `docs/rfc/query-layer-migration.md`

Both RFCs have `status: proposed` but no decision record, owner, or timeline. The query-layer migration appears partially implemented (TanStack Query is already in use) but the RFC doesn't reflect this.

**Suggestion:** Update RFC statuses. Mark the query-layer RFC as `in-progress` since TanStack Query is already integrated.

---

## Summary

### Priority Matrix

| Priority | Count | Key Actions |
|----------|-------|-------------|
| **Critical** | 2 | Add Error Boundary; test `birdImages.ts` and `useArchiveDetections.ts` |
| **High** | 6 | Fix CSP connect-src; add SpeciesDetailView cancellation; test dayCache; fix lang attribute; modal a11y; interactive card semantics |
| **Medium** | 14 | Proxy header hardening; i18n RegExp fix; formatter; health check; CI timeouts; Dockerfile user; duplicate headers; type server.mjs |
| **Low** | 14 | Various improvements (see individual items) |
| **Info** | 2 | Nginx regex complexity; SRI for fonts |

### Security Score: 8/10
Strong foundation with Nginx hardening, CSP, rate limiting, and typed errors. Main gaps: CSP `connect-src` missing `en.wikipedia.org`, wildcard in `img-src`, weak proxy token default.

### Code Quality Score: 7.5/10
Clean TypeScript, good separation of concerns, well-designed API client. Main gaps: no Error Boundary, SpeciesDetailView complexity, no formatter.

### Test Coverage Score: 5/10
Good testing infrastructure (Vitest + RTL + Playwright), high coverage thresholds configured, but critical business logic files are completely untested. The gap between configured thresholds and actual coverage is the biggest risk in the project.

### Deployment Score: 7/10
Solid multi-stage Docker build, security-hardened Nginx, disk-backed caching with fallback. Missing: health checks, non-root user, `.dockerignore`, graceful shutdown.

### Accessibility Score: 6/10
Good basics (aria-labels on buttons, keyboard handlers on cards). Missing: Error Boundary, focus management, dialog semantics, skip navigation.
