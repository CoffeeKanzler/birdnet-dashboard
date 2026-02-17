import { expect, test } from '@playwright/test'

import { installBirdnetApiMocks } from './support/mockBirdnet'

const TODAY_HEADING = /Heutige Erkennungen|Today's Detections/
const LAST_UPDATED_LABEL = /Zuletzt aktualisiert:|Last updated:/
const REFRESH_LABEL = /Aktualisieren|Refresh/
const TODAY_OVERVIEW_LABEL = /Übersicht heute|Today's Overview/

test('today view filter narrows species cards and clear resets', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=today')
  await expect(page.getByRole('heading', { name: TODAY_HEADING })).toBeVisible()

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
  await expect(page.getByRole('heading', { name: TODAY_HEADING })).toBeVisible()

  await expect(page.getByText(LAST_UPDATED_LABEL)).toBeVisible()
  await expect(page.getByRole('button', { name: REFRESH_LABEL })).toBeVisible()
  await expect(page.getByText(TODAY_OVERVIEW_LABEL)).toBeVisible()
})
