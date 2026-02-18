import { expect, test } from '@playwright/test'

import { installBirdnetApiMocks } from './support/mockBirdnet'

test('species detail shows rarity badge and family section', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=species&common=Eisvogel&scientific=Alcedo%20atthis&from=rarity')
  await expect(page.getByRole('heading', { name: 'Eisvogel' })).toBeVisible()

  await expect(page.getByText(/Seltenheit:.*selten/)).toBeVisible()
  await expect(page.getByText(/Familie:.*Eisvoegel/)).toBeVisible()
})

test('species detail shows detections table with entries', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=species&common=Amsel&scientific=Turdus%20merula&from=today')
  await expect(page.getByRole('heading', { name: 'Amsel' })).toBeVisible()

  await expect(page.getByText('Erkennungen dieser Art')).toBeVisible()
  await expect(page.getByText('Zeitpunkt').first()).toBeVisible()
  await expect(page.getByText('Sicherheit').first()).toBeVisible()
})

test('species detail shows related species as clickable buttons', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=species&common=Amsel&scientific=Turdus%20merula&from=today')
  await expect(page.getByRole('heading', { name: 'Amsel' })).toBeVisible()
  await expect(page.getByText('Weitere erkannte Arten derselben Familie.')).toBeVisible()

  const singdrosselButton = page.getByRole('button', { name: 'Singdrossel' })
  await expect(singdrosselButton).toBeVisible({ timeout: 15_000 })

  await singdrosselButton.click()
  await expect(page).toHaveURL(/view=species.*Turdus.philomelos/)
  await expect(page.getByRole('heading', { name: 'Singdrossel' })).toBeVisible()
})

test('family section uses one cached family endpoint request', async ({ page }) => {
  await installBirdnetApiMocks(page)

  let familyCalls = 0
  let speciesCalls = 0
  page.on('request', (request) => {
    const requestUrl = request.url()
    if (requestUrl.includes('/api/v2/family-matches')) {
      familyCalls += 1
    }
    if (requestUrl.includes('/api/v2/species')) {
      speciesCalls += 1
    }
  })

  await page.goto('/?view=species&common=Amsel&scientific=Turdus%20merula&from=today')
  await expect(page.getByRole('heading', { name: 'Amsel' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Singdrossel' })).toBeVisible({ timeout: 15_000 })

  expect(familyCalls).toBe(1)
  expect(speciesCalls).toBeLessThanOrEqual(2)
})

test('species detail refresh button reloads detections', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=species&common=Kohlmeise&scientific=Parus%20major&from=today')
  await expect(page.getByRole('heading', { name: 'Kohlmeise' })).toBeVisible()

  const refreshButton = page.getByRole('button', { name: 'Aktualisieren' })
  await expect(refreshButton).toBeVisible()
  await refreshButton.click()

  await expect(page.getByText('Erkennungen dieser Art')).toBeVisible()
})
