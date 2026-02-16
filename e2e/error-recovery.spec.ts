import { expect, test } from '@playwright/test'

test('archive view shows error and retries successfully', async ({ page }) => {
  let requestCount = 0

  await page.route('**/api/rest_v1/page/summary/**', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ type: 'not_found' }),
    })
  })

  await page.route('**/w/api.php**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ query: { pages: {} } }),
    })
  })

  await page.route('**/api/v2/species**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        scientific_name: 'test',
        common_name: 'test',
        rarity: { status: 'common' },
        taxonomy: { family_common: 'Test' },
        metadata: { source: 'mock' },
      }),
    })
  })

  await page.route('**/api/v2/detections**', async (route) => {
    requestCount += 1
    if (requestCount <= 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'unavailable' }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'recovery-1',
              common_name: 'Amsel',
              scientific_name: 'Turdus merula',
              confidence: 0.9,
              timestamp: new Date().toISOString(),
            },
          ],
          total: 1,
        }),
      })
    }
  })

  await page.goto('/?view=archive')
  await page.getByRole('button', { name: 'Letzte 7 Tage' }).click()

  await expect(
    page
      .getByText(/BirdNET ist momentan nicht verfuegbar/)
      .first(),
  ).toBeVisible()

  const retryButton = page.getByRole('button', { name: 'Erneut versuchen' })
  await expect(retryButton).toBeVisible()
  await retryButton.click()

  await expect(page.locator('article[role="button"]').filter({ hasText: 'Amsel' })).toBeVisible()
})

test('landing view shows error state when API fails', async ({ page }) => {
  await page.route('**/api/v2/detections/recent**', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'internal error' }),
    })
  })

  await page.route('**/api/rest_v1/page/summary/**', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ type: 'not_found' }),
    })
  })

  await page.goto('/?view=landing')
  await expect(
    page
      .getByText(/BirdNET ist momentan nicht verfuegbar/)
      .first(),
  ).toBeVisible()
})
