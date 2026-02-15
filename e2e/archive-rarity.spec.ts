import { expect, test } from '@playwright/test'

import { installBirdnetApiMocks } from './support/mockBirdnet'

test('archive view supports quick range and species filter', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=archive')
  await expect(page.getByRole('heading', { name: 'Erkennungen im Datumsbereich' })).toBeVisible()

  await page.getByRole('button', { name: 'Letzte 30 Tage' }).click()
  await expect(page.locator('article[role="button"]').filter({ hasText: 'Rotmilan' })).toBeVisible()

  await page.getByLabel('Artenfilter').fill('does-not-exist')
  await expect(
    page.getByText('Keine Erkennungen passen in diesem Zeitraum zu diesem Filter.'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Leeren' }).click()
  await expect(page.locator('article[role="button"]').filter({ hasText: 'Rotmilan' })).toBeVisible()
})

test('rarity highlight opens species detail and returns', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=rarity')
  await expect(page.getByRole('heading', { name: 'Top 10 Highlights' })).toBeVisible()
  await expect(page.locator('article[role="button"]').filter({ hasText: 'Eisvogel' })).toBeVisible()

  await page.locator('article[role="button"]').filter({ hasText: 'Eisvogel' }).first().click()
  await expect(page).toHaveURL(/view=species.*from=rarity/)
  await expect(page.getByRole('heading', { name: 'Eisvogel' })).toBeVisible()

  await page.getByRole('button', { name: 'Zurueck' }).click()
  await expect(page).toHaveURL(/view=rarity/)
  await expect(page.getByRole('heading', { name: 'Top 10 Highlights' })).toBeVisible()
})
