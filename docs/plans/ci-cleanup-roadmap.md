# CI Cleanup Roadmap

**Status: PLANNED**
**Target branch: `main`**

## Why

Current CI has too many overlapping runs and slow feedback loops. This increases queue time, runner minutes, and merge friction.

## Goals

- Faster PR feedback (target: first result in < 5 minutes).
- Fewer redundant workflow runs.
- Keep security checks intact.
- Reduce total CI runtime and cost.

## Plan

### Phase 1: Workflow Scope and Triggers

1. Split checks by intent:
- `pr-fast`: lint + unit + build (required on PRs).
- `pr-e2e-smoke`: tiny critical smoke set (required on PRs).
- `main-full`: full e2e/regression on pushes to `main`.
- `nightly-heavy`: long-running suites and non-blocking diagnostics.

2. Remove duplicate triggers:
- Avoid running the same suite on both `pull_request` and `push` for feature branches.
- Keep `push` full checks only for `main` and tags.

3. Add path filters:
- Docs-only changes skip app build/tests.
- Frontend-only changes skip backend-only jobs where possible.

### Phase 2: Runtime Reduction

1. Use strict concurrency cancellation:
- Cancel older in-progress runs per branch/workflow.

2. Cache dependencies effectively:
- `npm` cache keyed by lockfile + node version.
- Reuse Playwright browser cache between jobs where possible.

3. Right-size e2e:
- Keep PR smoke tests minimal.
- Move broad navigation permutations to scheduled/main-only jobs.

### Phase 3: Quality Gate Hardening

1. Required checks policy:
- Only fast reliable checks as branch protection required statuses.
- Keep slower suites informative but non-blocking on PR.

2. Test ownership:
- Ensure changed features include unit tests.
- Enforce flaky-test quarantine + follow-up issue workflow.

3. Reporting:
- Publish test summary artifact and timings per job.

## Deliverables

- Updated `.github/workflows/ci.yml` into layered jobs (`pr-fast`, `pr-e2e-smoke`, `main-full`).
- New scheduled workflow for heavy checks.
- Updated branch protection check list (outside repo settings step).
- Baseline metrics doc (before/after run time and queue time).

## Success Criteria

- Median PR CI wall time reduced by at least 40%.
- No increase in post-merge regressions.
- Fewer cancelled/duplicate runs on active PRs.
