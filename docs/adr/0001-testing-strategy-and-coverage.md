# ADR 0001: Testing Strategy and Coverage Guardrails

Status: accepted

## Context

The project now has a mix of API logic, stateful hooks, and UI rendering flows.
We need high confidence on critical paths without adding brittle tests for static
markup that do not protect real behavior.

## Decision

1. Keep a layered test strategy:
   - Unit tests for API clients and utility logic.
   - Integration-style component tests for routing state and user interactions.
   - Playwright E2E happy-path smoke tests for end-to-end flows.
2. Prefer behavior-focused assertions over snapshot- or class-heavy assertions.
3. Require coverage in CI via `npm run test:coverage`.
4. Enforce minimum Vitest thresholds:
   - statements: 95
   - lines: 95
   - functions: 95
   - branches: 75

## Rationale

- High line/statement/function thresholds keep pressure on core logic tests.
- Branch threshold is lower because UI flow code includes defensive branches
  (abort/timeouts, browser edge events) that are expensive to simulate fully.
- Happy-path E2E tests validate that mocked API contracts still produce working
  user journeys in the browser.
- This avoids writing low-value tests for visual-only markup while still
  protecting behavior and regressions.

## Consequences

- New features should add at least one happy-path test and relevant failure-path
  coverage where failure handling exists.
- Coverage regressions fail CI early.
- Test changes should target user-observable behavior and public module
  contracts before internal implementation details.
