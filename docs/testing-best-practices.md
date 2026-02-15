# Testing Best Practices

## What to test

- Test code paths that carry product risk: data fetching, routing state,
  filtering, retries, and error handling.
- Start with happy-path behavior (what users do when things work).
- Add failure-path tests where the code has explicit fallback behavior.

## What not to over-test

- Do not add tests for static JSX/layout-only markup that has no behavior.
- Avoid brittle assertions on class names or exact DOM structure unless required
  for accessibility or a regression.

## Unit test guidelines

- Keep unit tests deterministic (mock network and time when needed).
- Assert contracts, not internals (returned value, thrown error type/code,
  transformed payloads).
- Include edge cases only when the production code has dedicated branches for
  that edge case.

## Integration test guidelines

- Cover route transitions and state restoration (query params, back/forward,
  modal open/close, theme persistence).
- Prefer user-level events (`click`, `type`) over direct state manipulation.

## E2E guidelines

- Keep one happy-path per main view and one cross-view navigation scenario.
- Use stable API mocks and assert critical UI outputs only.
- Keep smoke tests fast and deterministic; avoid broad visual assertions.

## PR checklist for test quality

- Happy path covered.
- Error/fallback path covered when applicable.
- No low-value snapshot or styling-only assertions.
- `npm run test:coverage` and `npm run test:e2e` pass locally.
