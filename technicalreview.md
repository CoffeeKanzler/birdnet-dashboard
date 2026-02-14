# Technical Review – birdnet-dashboard

Stand: 2026-02-14 (aktualisiert nach Follow-up)

## Executive Summary

Die App ist funktional und produktionsnah deploybar (**Lint + Build laufen gruen**), hat aber weiterhin klare Luecken bei **Testabdeckung, Architektur-Konsistenz und Betriebsreife**.

**Top-Defizite:**
1. Testabdeckung ist aufgebaut, aber noch nicht vollstaendig (insbesondere E2E fehlt).
2. API-Layer ist zentralisiert, aber User-facing Fehlermeldungen/Policies sind noch nicht einheitlich.
3. Routing und URL-State sind manuell implementiert (wartungsintensiv).
4. Dokumentation ist verbessert, aber noch nicht vollstaendig (ADR/Runbook offen).
5. Security Hardening im NGINX ist rudimentaer (fehlende Security Headers/CSP).

## Status-Update (bereits umgesetzt)

- Lint-Probleme aus dem Review sind behoben:
  - `no-constant-condition` in `src/features/detections/useArchiveDetections.ts` gefixt.
  - Hook-Dependency-Warnungen in `src/App.tsx` und `src/features/species/SpeciesDetailView.tsx` aufgeloest.
- Verifikation erfolgreich:
  - `npm run lint` passt.
  - `npm run build` passt.
  - `npm run test` passt.

## Was konkret fehlt / verbessert werden sollte

## 1) Quality Gate & Lint-Disziplin

### Befund
- `npm run lint` ist lokal wieder gruen.
- Der CI-Gate-Aspekt bleibt offen: Lint sollte als verpflichtender PR-Check erzwungen werden.

### Empfehlung
- Lint-Fehler als **P0** beheben und als verpflichtenden CI-Check einführen.
- Hook-Regeln nicht nur „warn“, sondern zielgerichtet beheben.

### Agent-Tasks
- [x] **P0:** Lint-Fehler in `useArchiveDetections.ts` beheben (`no-constant-condition`).
- [x] **P1:** `react-hooks/exhaustive-deps`-Warnings in `App.tsx` und `SpeciesDetailView.tsx` sauber aufloesen.
- [x] **P1:** CI-Pipeline fuer Lint/Test/Build ist definiert (`quality-gate` in `.github/workflows/ci.yml`).
- [x] **P1:** Branch-Protection konfiguriert: `quality-gate` ist als Required Check auf `main` aktiv.

---

## 2) Testing-Strategie (derzeit praktisch nicht vorhanden)

### Befund
- Test-Runner ist jetzt eingerichtet (Vitest + RTL) und `npm test` ist verfuegbar.
- Erste Unit- und Integrationstests sind vorhanden (`src/api/birdnet.test.ts`, `src/features/rarity/useNotableSpotlight.test.ts`, `src/App.test.tsx`, aktuell 10 Tests).
- Weitere kritische Logik (Matching/Hooks/UI-Flows) ist noch ungetestet.

### Empfehlung
- Minimal starten mit Vitest + React Testing Library.
- Fokus auf deterministische Kernlogik vor UI-Details.

### Agent-Tasks
- [x] **P0:** Test-Stack (Vitest + RTL) aufsetzen inkl. `npm test` Script.
- [x] **P0:** Unit-Tests fuer `src/api/birdnet.ts` (Normalisierung, Pagination, Range-Filter).
- [x] **P1:** Unit-Tests fuer `useNotableSpotlight` und Species-Matching Logik.
- [x] **P1:** Integrationstest fuer Hauptnavigation (`landing/today/archive/rarity/species`) inkl. URL-State.
- [ ] **P2:** Smoke-E2E für „App lädt + API-Fehlerzustand sichtbar“.

---

## 3) Architektur & State Management

### Befund
- Routing/History wird händisch in `App.tsx` verwaltet.
- Mehrere Hooks implementieren ähnliche Fetch-/Abort-/Paging-Muster separat.
- Gefahr von inkonsistenten Zuständen und zunehmender Komplexität.

### Empfehlung
- Mittelfristig Router einsetzen (React Router) statt eigener URL-Engine.
- Serverseitigen Zustand über zentrales Query-Layer (z. B. TanStack Query) vereinheitlichen.
- Reusable Data-Layer (API Client + Query Keys + gemeinsame Error-Policy).

### Agent-Tasks
- [ ] **P1:** Architektur-RFC: Routing-Migration auf React Router (inkl. Übergangsstrategie).
- [x] **P1:** API-Client eingefuehrt (`src/api/apiClient.ts`) inkl. Timeout/Retry/Fehlerklassifikation.
- [ ] **P2:** Hooks auf gemeinsames Query-Layer migrieren (inkrementell pro Feature).

---

## 4) API Robustheit & Fehlerbehandlung

### Befund
- API-Aufrufe laufen ueber einen zentralen Client (`src/api/apiClient.ts`) mit Timeout/Retry.
- Fehler sind technisch klassifiziert (HTTP/Timeout/Network/Abort/Parse), aber User-Messages sind noch nicht ueberall konsistent.
- Teilweise komplexe Stop-/Paging-Logik ohne explizite Guardrail-Tests.

### Empfehlung
- API-Layer zentralisieren:
  - request timeout,
  - retry nur bei transienten Fehlern,
  - standardisierte Fehlerobjekte,
  - optional observability hooks (z. B. error codes).

### Agent-Tasks
- [x] **P1:** `apiClient.ts` erstellt (Abort+Timeout, typed error, JSON parsing, base URL handling).
- [x] **P1:** API-Calls auf zentralen Client migriert (`src/api/birdnet.ts`, `src/api/birdImages.ts`).
- [ ] **P2:** User-facing Fehlermeldungen standardisieren (freundlich + technisch verwertbar).

---

## 5) Security & Deployment Hardening

### Befund
- NGINX regelt Pfade und Query-Pattern restriktiv (positiv).
- Security-Header Baseline ist jetzt vorhanden (CSP, X-Frame-Options, Referrer-Policy, etc.).
- Dependency-Audit ist in CI vorhanden; Container-Scan fehlt noch.

### Empfehlung
- Security-Baseline ergänzen:
  - CSP (mindestens restriktive Startversion),
  - `X-Content-Type-Options`,
  - `X-Frame-Options`/`frame-ancestors`,
  - `Referrer-Policy`,
  - HSTS (falls TLS vorgelagert gesichert ist).

### Agent-Tasks
- [x] **P1:** Security Header Set in NGINX ergaenzt (`docker/nginx.conf`).
- [x] **P1:** Dependency-Audit in CI ist aktiv (`vulnerability-audit` in `.github/workflows/security.yml`).
- [ ] **P2:** Container-Image-Scan (z. B. Trivy/Grype) in CI aufnehmen.

---

## 6) Dokumentation & Developer Experience

### Befund
- `README.md` ist jetzt projektbezogen und nicht mehr im Vite-Template-Status.
- Für Onboarding, Betrieb und Troubleshooting fehlen projektspezifische Leitplanken.

### Empfehlung
- README auf produktiven Stand bringen:
  - Architektur,
  - lokale Entwicklung,
  - Umgebungsvariablen,
  - Build/Deploy,
  - bekannte Grenzen,
  - Troubleshooting.

### Agent-Tasks
- [x] **P0:** README vollstaendig projektbezogen neu strukturiert.
- [ ] **P1:** `docs/` Bereich für Architektur-Entscheidungen (ADR/RFC) anlegen.
- [ ] **P2:** Runbook für Betrieb (Incidents, API down, image fetch issues) ergänzen.

---

## 7) Observability & Betrieb

### Befund
- Frontend-seitige Telemetrie/Monitoring ist nicht erkennbar.
- Kein Error-Budget-/SLO-orientiertes Monitoring sichtbar.

### Empfehlung
- Leichtgewichtig starten:
  - zentraler Error-Reporter,
  - konsistente Error IDs,
  - Basis-Metriken (API latency, failure rate).

### Agent-Tasks
- [ ] **P2:** Frontend Error Tracking integrieren (inkl. Release-Version Tagging).
- [ ] **P2:** Health-/Availability-Konzept für API-Abhängigkeit dokumentieren.

---

## Priorisierte Umsetzungsreihenfolge (Roadmap)

### Phase 1 (1–3 Tage) – Stabilisieren
1. Lint auf Grün bringen.
2. README produktionsfähig machen.
3. Test-Stack initial aufsetzen + erste Kern-Unit-Tests.

### Phase 2 (3–7 Tage) – Absichern
1. API-Client zentralisieren.
2. Security Header in NGINX ergänzen.
3. CI Gates für Lint/Test/Audit etablieren.

### Phase 3 (1–2 Wochen) – Skalierbarkeit
1. Routing- und Data-Layer Refactor (Router + Query-Layer).
2. Observability + Runbooks.
3. Erweiterte Integration/E2E-Tests.

---

## Task-Template für Agenten (copy/paste)

```md
### Task: <kurzer Titel>
**Ziel**
<Welches Problem wird gelöst?>

**Scope**
- In Scope: ...
- Out of Scope: ...

**Technische Umsetzung**
- ...

**Akzeptanzkriterien**
- [ ] ...
- [ ] ...

**Validierung**
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] relevante Tests

**Risiken / Rollback**
- Risiko: ...
- Rollback: ...
```

## Kurzfazit

Wenn du nur 3 Dinge sofort umsetzt, dann:
1. **Lint + CI Gate**,
2. **Test-Foundation**,
3. **zentraler API-Client mit klarer Fehlerstrategie**.

Damit reduzierst du kurzfristig Bugs und schaffst die Grundlage, um Features schneller und mit weniger Regressionen durch Agenten umsetzen zu lassen.
