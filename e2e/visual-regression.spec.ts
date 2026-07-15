import { expect, test, type Page } from '@playwright/test'

import { installBirdnetApiMocks } from './support/mockBirdnet'

// These checks catch layout/visual regressions (elements moved, overlapping,
// grid breakage) that functional assertions miss entirely. Views are chosen,
// and dynamic regions masked or scoped out, so each screenshot is stable
// across days: no absolute "today"-relative dates or freshly-generated photo
// URLs are left unmasked in frame.

const installEmptyBirdnetApiMocks = async (page: Page): Promise<void> => {
  await page.route('**/api/rest_v1/page/summary/**', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/w/api.php**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"query":{"pages":{}}}' })
  })
  await page.route('**/api/v2/species**', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'not found' }),
    })
  })
  await page.route('**/api/v2/family-matches**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ family_common: '', matches: [] }),
    })
  })
  await page.route('**/api/v2/summary/30d', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: new Date().toISOString(),
        window_start: '2000-01-01',
        window_end: '2000-01-31',
        stats: {
          total_detections: 0,
          unique_species: 0,
          avg_confidence: 0,
          hourly_bins: Array.from({ length: 24 }, () => 0),
          top_species: [],
        },
        archive: { groups: [] },
      }),
    })
  })
  await page.route('**/api/v2/detections/recent**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/api/v2/detections**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], total: 0 }),
    })
  })
}

test('landing view layout', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=landing')
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible()

  const cards = page.locator('div[role="button"]')
  await expect(cards.first()).toBeVisible()

  await expect(page.locator('main')).toHaveScreenshot('landing-main.png')
})

test('species card layout', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=landing')
  const firstCard = page.locator('div[role="button"]').first()
  await expect(firstCard).toBeVisible()

  await expect(firstCard).toHaveScreenshot('species-card.png')
})

test('today view empty state layout', async ({ page }) => {
  await installEmptyBirdnetApiMocks(page)

  await page.goto('/?view=today')
  await expect(page.getByRole('heading', { name: /Heutige Erkennungen/ })).toBeVisible()
  await expect(page.getByText('Heute noch keine Erkennungen vorhanden.')).toBeVisible()

  await expect(page.locator('main')).toHaveScreenshot('today-empty-main.png', {
    mask: [page.getByText(/^Zuletzt aktualisiert:/)],
  })
})

test('archive view empty results panel layout', async ({ page }) => {
  await installEmptyBirdnetApiMocks(page)

  await page.goto('/?view=archive')
  await expect(page.getByRole('heading', { name: 'Erkennungen im Datumsbereich' })).toBeVisible()

  // Scoped to the results panel only — the date-range header above it shows
  // today-relative absolute dates that legitimately differ day to day.
  const resultsPanel = page.locator('main .mt-6.rounded-xl.border-slate-200')
  await expect(resultsPanel).toBeVisible()
  await expect(resultsPanel).toHaveScreenshot('archive-empty-results.png')
})

test('rarity view empty state layout', async ({ page }) => {
  await installEmptyBirdnetApiMocks(page)

  await page.goto('/?view=rarity')
  await expect(page.getByText('Keine besonderen Arten in diesem Zeitraum gefunden.')).toBeVisible()

  await expect(page.locator('main')).toHaveScreenshot('rarity-empty-main.png')
})

test('species detail layout for a species with no photo, rarity data, or detections', async ({ page }) => {
  await installEmptyBirdnetApiMocks(page)

  await page.goto(
    '/?view=species&common=Unbekannte%20Testart&scientific=Testus%20incognitus&from=today',
  )
  await expect(page.getByRole('heading', { name: 'Unbekannte Testart' })).toBeVisible()
  await expect(page.getByText('Keine Erkennungen fuer diese Art gefunden.')).toBeVisible()

  await expect(page.locator('main')).toHaveScreenshot('species-detail-empty-main.png')
})
