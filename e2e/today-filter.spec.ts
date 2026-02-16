import { expect, test } from '@playwright/test'

import { installBirdnetApiMocks } from './support/mockBirdnet'

test('today view filter narrows species cards and clear resets', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=today')
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()

  const filterInput = page.getByLabel('Artenfilter')
  await expect(filterInput).toBeVisible()

  await filterInput.fill('Amsel')
  await expect(page.getByText('Filter: Amsel')).toBeVisible()

  await filterInput.fill('zzzznotfound')
  await expect(page.getByText(/Keine Erkennungen passen heute zu diesem Filter/)).toBeVisible()

  await page.getByRole('button', { name: 'Leeren' }).click()
  await expect(page.getByText('Filter:')).toBeHidden()
})

test('today view shows refresh button and summary section', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=today')
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()

  await expect(page.getByText('Zuletzt aktualisiert:')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aktualisieren' })).toBeVisible()
  await expect(page.getByText('Übersicht heute')).toBeVisible()
})
