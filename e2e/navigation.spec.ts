import { expect, test } from '@playwright/test'

import { installBirdnetApiMocks } from './support/mockBirdnet'

test('today species card opens detail and returns back', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=today')
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()

  await page.locator('article[role="button"]').filter({ hasText: 'Amsel' }).first().click()
  await expect(page).toHaveURL(/view=species/)
  await expect(page.getByRole('heading', { name: 'Amsel' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Singdrossel' })).toBeVisible()

  await page.getByRole('button', { name: 'Zurueck' }).click()
  await expect(page).toHaveURL(/view=today/)
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()
})

test('attribution modal opens and closes from footer', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=landing')
  await page.getByRole('button', { name: 'Bildnachweise' }).click()

  await expect(page.getByRole('heading', { name: 'Wikimedia/Wikipedia Lizenzen' })).toBeVisible()
  // Landing cards load species photos which populate attribution records —
  // so either the table or the empty-state text will be shown.
  await expect(page.getByText(/Diese Liste zeigt aktuell geladene Bilder|Noch keine Bildnachweise geladen/)).toBeVisible()

  await page.getByRole('button', { name: /Schlie/ }).click()
  await expect(page.getByRole('heading', { name: 'Wikimedia/Wikipedia Lizenzen' })).toBeHidden()
})

test('theme toggle persists across reload', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=landing')

  const html = page.locator('html')
  const before = (await html.getAttribute('data-theme')) ?? 'light'
  const target = before === 'dark' ? 'light' : 'dark'

  await page.getByRole('button', { name: /Design aktivieren/ }).click()
  await expect(html).toHaveAttribute('data-theme', target)

  await page.reload()
  await expect(html).toHaveAttribute('data-theme', target)
})
