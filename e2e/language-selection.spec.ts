import { expect, test } from '@playwright/test'

import { installBirdnetApiMocks } from './support/mockBirdnet'

const LOCALE_STORAGE_KEY = 'birdnet-showoff-locale'
const LANGUAGE_TOGGLE_LABEL = /Language|Sprache|common\.language/

test.use({ locale: 'fr-FR' })

test('defaults to German when no lang query and no stored locale', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=today')

  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()
  await expect(page).not.toHaveURL(/lang=/)
})

test('applies ?lang=en override on first load', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=today&lang=en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: "Today's Detections" })).toBeVisible()
  await expect(page).toHaveURL(/lang=en/)
  await expect
    .poll(async () =>
      page.evaluate((key) => window.localStorage.getItem(key), LOCALE_STORAGE_KEY),
    )
    .toBe('en')
})

test('header language toggle persists selected locale in localStorage', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=today')

  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('heading', { name: 'Heutige Erkennungen' })).toBeVisible()

  await page.getByRole('button', { name: LANGUAGE_TOGGLE_LABEL }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: "Today's Detections" })).toBeVisible()
  await expect(page).toHaveURL(/lang=en/)
  await expect
    .poll(async () =>
      page.evaluate((key) => window.localStorage.getItem(key), LOCALE_STORAGE_KEY),
    )
    .toBe('en')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: "Today's Detections" })).toBeVisible()
  await expect(page).toHaveURL(/lang=en/)
  await expect
    .poll(async () =>
      page.evaluate((key) => window.localStorage.getItem(key), LOCALE_STORAGE_KEY),
    )
    .toBe('en')
})
