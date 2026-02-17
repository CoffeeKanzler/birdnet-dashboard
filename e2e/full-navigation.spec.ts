import { expect, test } from '@playwright/test'

import { installBirdnetApiMocks } from './support/mockBirdnet'

test('navigates through all four main views in sequence', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=landing')
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible()
  await expect(page).toHaveURL(/view=landing/)

  await page.getByRole('button', { name: 'Heute' }).click()
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()
  await expect(page).toHaveURL(/view=today/)

  await page.getByRole('button', { name: 'Archiv' }).click()
  await expect(page.getByRole('heading', { name: 'Erkennungen im Datumsbereich' })).toBeVisible()
  await expect(page).toHaveURL(/view=archive/)

  await page.getByRole('button', { name: 'Highlights' }).click()
  await expect(page.getByRole('heading', { name: 'Top 10 Highlights' })).toBeVisible()
  await expect(page).toHaveURL(/view=rarity/)

  await page.getByRole('button', { name: 'Live' }).click()
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible()
  await expect(page).toHaveURL(/view=landing/)
})

test('browser back and forward buttons navigate between views', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=landing')
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible()

  await page.getByRole('button', { name: 'Heute' }).click()
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()

  await page.getByRole('button', { name: 'Archiv' }).click()
  await expect(page.getByRole('heading', { name: 'Erkennungen im Datumsbereich' })).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()
  await expect(page).toHaveURL(/view=today/)

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible()
  await expect(page).toHaveURL(/view=landing/)

  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()
  await expect(page).toHaveURL(/view=today/)
})

test('deep link to species detail view loads correctly', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=species&common=Amsel&scientific=Turdus%20merula&from=today')
  await expect(page.getByRole('heading', { name: 'Amsel' })).toBeVisible()
  await expect(page.getByText('Art-Detail')).toBeVisible()
  await expect(page.getByText('Turdus merula')).toBeVisible()

  await page.getByRole('button', { name: 'Zurueck' }).click()
  await expect(page).toHaveURL(/view=today/)
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()
})

test('deep link to species detail with from=rarity returns to rarity', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=species&common=Eisvogel&scientific=Alcedo%20atthis&from=rarity')
  await expect(page.getByRole('heading', { name: 'Eisvogel' })).toBeVisible()

  await page.getByRole('button', { name: 'Zurueck' }).click()
  await expect(page).toHaveURL(/view=rarity/)
  await expect(page.getByRole('heading', { name: 'Top 10 Highlights' })).toBeVisible()
})

test('statistics view shows heading and summary cards', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=stats')
  await expect(page.getByRole('heading', { name: 'Statistiken' })).toBeVisible()
})

test('statistics nav button routes to stats view', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=landing')
  await page.getByRole('button', { name: 'Statistik' }).click()
  await expect(page.getByRole('heading', { name: 'Statistiken' })).toBeVisible()
  await expect(page).toHaveURL(/view=stats/)
})
