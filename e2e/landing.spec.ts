import { expect, test } from '@playwright/test'

import { installBirdnetApiMocks } from './support/mockBirdnet'

test('landing view loads and shows live detection cards', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=landing')
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible()
  await expect(page.getByText('Automatisch alle 30 Sekunden aktualisiert.')).toBeVisible()

  const cards = page.locator('article[role="button"]')
  await expect(cards.first()).toBeVisible()

  const cardCount = await cards.count()
  expect(cardCount).toBeGreaterThanOrEqual(1)
  // Grid is responsive: up to 3 (mobile), 6 (sm), or 9 (lg+) cards
  expect(cardCount).toBeLessThanOrEqual(9)
})

test('landing card click navigates to species detail and back', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=landing')
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible()

  const firstCard = page.locator('article[role="button"]').first()
  await expect(firstCard).toBeVisible()

  const speciesName = await firstCard.locator('h3').textContent()
  await firstCard.click()

  await expect(page).toHaveURL(/view=species/)
  await expect(page.getByRole('heading', { name: speciesName! })).toBeVisible()
  await expect(page.getByText('Art-Detail')).toBeVisible()

  // Back from species goes to lastMainView. When entering from landing,
  // lastMainView defaults to 'today' (landing is not a valid lastMainView).
  await page.getByRole('button', { name: 'Zurueck' }).click()
  await expect(page).toHaveURL(/view=today/)
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()
})
