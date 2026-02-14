# UI Guidelines

These guidelines define the visual and interaction rules for `birdnet-showoff`.

## Product Tone

- Audience: local neighborhood users, non-technical first.
- Language: German in all visible UI copy.
- Style: calm, nature-oriented, readable, trustworthy.
- Goal: show bird detections fast, with minimal friction.

## Information Architecture

- Main nav order must stay simple and stable:
  - `Live`
  - `Heute`
  - `Archiv`
  - `Highlights`
- `Live` is the landing focus (quick glance, no deep controls).
- `Heute` and `Archiv` are data views.
- `Highlights` is curated/topical, not a full analytics screen.

## Layout Rules

- Prioritize content above controls on mobile.
- Keep header compact and non-jumpy while scrolling.
- Avoid stacked control walls; prefer single-row horizontal controls with overflow.
- Keep cards visually consistent across views:
  - image block on top
  - common name
  - scientific name
  - optional metadata row

## Typography and Copy

- Use clear German labels and proper umlauts (`local area`, `Übersicht`, etc.).
- Avoid developer wording in UI (`query`, `endpoint`, `payload`, etc.).
- Keep helper text short, one sentence when possible.
- Prefer action labels over jargon:
  - good: `Aktualisieren`, `Mehr laden`, `Erneut versuchen`
  - avoid: internal/technical terms

## Colors and Theme

- Light mode is default unless user/system prefers dark.
- Dark mode must preserve contrast and readability first, style second.
- Status colors:
  - neutral loading: slate tones
  - warnings/errors: rose/red tones
  - positive/live states: emerald tones

## Interaction Rules

- Every interactive card must be keyboard accessible (`Enter`/`Space`).
- Buttons and tabs should not shift layout when active/inactive.
- Avoid hidden destructive interactions.
- Show partial results while long datasets are still loading.

## Performance UX

- Never block whole sections if partial data is available.
- Prefer progressive loading over long empty waits.
- For long-running views, show clear loading state text.
- Keep expensive operations bounded and cache results where safe.

## Image and Attribution UX

- Image source is Wikimedia/Wikipedia; treat attribution as mandatory.
- Show a subtle `©` badge on image cards when attribution exists.
- Clicking `©` opens attribution details (not external redirect by default).
- `Bildnachweise` table should include:
  - species
  - author
  - license
  - source link
- Missing data must be explicit (`nicht angegeben`), never silently omitted.

## Accessibility

- Minimum tap target size: ~36px high for buttons/tabs.
- Maintain visible focus styles.
- Keep text contrast high in both themes.
- Avoid color-only meaning; combine with text labels.

## Content-Specific Rules

- `Live` badge logic:
  - show `Live` only for fresh detections
  - show relative age otherwise (`Vor X min`, `Vor X h`)
- In Highlights, avoid over-control complexity if it harms speed.
- Species detail should support exploration:
  - photo
  - short description
  - family-related species links

## Consistency Checklist (before release)

- Labels use German with correct umlauts.
- Mobile first paint shows meaningful bird content quickly.
- No tab/header flicker on scroll.
- Loading states are visible and understandable.
- Attribution flow works from `©` and footer `Bildnachweise`.
- Dark mode is readable across all key views.
