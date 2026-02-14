import { expect, test } from '@playwright/test'

test('app shell loads', async ({ page }) => {
  await page.goto('/?view=landing')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('today view shows friendly API error state', async ({ page }) => {
  await page.route('**/api/v2/detections*', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'unavailable' }),
    })
  })

  await page.goto('/?view=today')
  await expect(
    page
      .getByText('BirdNET ist momentan nicht verfuegbar. Bitte spaeter erneut versuchen.')
      .first(),
  ).toBeVisible()
})
