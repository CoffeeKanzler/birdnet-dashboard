# ESLint v10 Upgrade Plan

## Status

PRs #55 (Dependabot) and #58 (Renovate) both attempt to bump ESLint from v9 to v10 but fail CI.

Both PRs should be **closed as superseded** — this plan tracks the correct manual upgrade.

---

## Why the PRs Fail

| PR | Problem |
|----|---------|
| #58 (Renovate) | Only updated `package.json` — `package-lock.json` not regenerated → `npm ci` fails |
| #55 (Dependabot) | Updated lockfile but `eslint-plugin-react-hooks@7.0.1` declares peer dep `eslint: "^3...^9"` — does **not** include `^10` → `npm install` fails with `ERESOLVE` |

---

## Root Blocker

`eslint-plugin-react-hooks@7.0.1` (current latest) has peer dep `eslint: "^3.0.0 || ... || ^9.0.0"` — ESLint v10 is excluded.

The canary release `7.1.0-canary-ab18f33d-20260220` (`@next` tag) adds `^10.0.0` to its peer range.
`@typescript-eslint/*@8.x` already supports ESLint v10 (`^8.57.0 || ^9.0.0 || ^10.0.0`).

---

## Required Changes

### 1. Update `eslint-plugin-react-hooks`

Change `package.json` from:
```json
"eslint-plugin-react-hooks": "^7.0.1"
```
to the canary version that supports ESLint v10:
```json
"eslint-plugin-react-hooks": "7.1.0-canary-ab18f33d-20260220"
```

> **Note:** If a stable release with ESLint v10 support lands before this is done, use that instead. Monitor https://www.npmjs.com/package/eslint-plugin-react-hooks.

### 2. Bump ESLint

`package.json`:
```json
"eslint": "^10.0.1"
```

### 3. Remove `.eslintrc.cjs`

ESLint v10 removes support for the legacy eslintrc config format entirely. The project already has `eslint.config.cjs` (flat config) which must remain.

Delete: `.eslintrc.cjs`

### 4. Update the `lint` script

The `--ext` flag is not supported in ESLint v10 (file patterns are defined in the flat config).

Change `package.json` from:
```json
"lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
```
to:
```json
"lint": "eslint . --report-unused-disable-directives --max-warnings 0"
```

The flat config at `eslint.config.cjs` already scopes to `**/*.{ts,tsx}` via the `files` field.

### 5. Regenerate lockfile

```bash
npm install
```

### 6. Verify

```bash
npm run lint
npm run build
npm test
```

---

## Implementation Steps (in order)

1. Close PR #55 (Dependabot ESLint v10) and PR #58 (Renovate ESLint v10) with reference to this plan
2. Edit `package.json`:
   - Bump `eslint` to `^10.0.1`
   - Pin `eslint-plugin-react-hooks` to the canary tag above
   - Remove `--ext ts,tsx` from the `lint` script
3. Delete `.eslintrc.cjs`
4. Run `npm install` to regenerate `package-lock.json`
5. Run `npm run lint && npm run build && npm test` — all must pass
6. Commit and push as a single `chore(deps): upgrade eslint to v10` commit
7. Open PR targeting `main`

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Canary `react-hooks` plugin introduces regression | Low | Dev-only dep; lint rules haven't changed; CI catches any issues |
| New lint errors from ESLint v10 rule changes | Low | ESLint v10 is largely a config-format change; rule set is stable |
| Missing `eslintrc.cjs` breaks editor integrations | None | Editors pick up `eslint.config.cjs` when present |

---

## Alternatives Considered

- **Stay on ESLint v9** — viable but defers technical debt; v10 was released 2026-02-xx and the ecosystem is catching up
- **Use `--legacy-peer-deps`** — not acceptable; the project uses `npm ci` which respects lockfile integrity
- **Close both PRs, wait** — acceptable if the stable `react-hooks` v7.1.0 release is imminent
