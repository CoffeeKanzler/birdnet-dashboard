import { expect, test, type Page } from '@playwright/test'

import { installBirdnetApiMocks } from './support/mockBirdnet'

const getCacheKeys = async (page: Page): Promise<string[]> => {
  return page.evaluate(() => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith('birdnet-day-cache-v1:')) {
        keys.push(key)
      }
    }
    return keys
  })
}

test('statistics page loads using summary endpoint on first load', async ({ page }) => {
  await installBirdnetApiMocks(page)

  let apiCallCount = 0
  page.on('request', (req) => {
    if (
      req.url().includes('/api/v2/summary/30d') ||
      req.url().includes('/api/v2/detections')
    ) {
      apiCallCount += 1
    }
  })

  await page.goto('/?view=stats')
  await expect(page.getByRole('heading', { name: 'Statistiken' })).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(apiCallCount).toBeGreaterThan(0)
})

test('statistics page uses localStorage cache on reload (no API calls)', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=stats')
  await expect(page.getByRole('heading', { name: 'Statistiken' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Erkennungen gesamt')).toBeVisible()
  await expect(page.getByText(/^\d+$/).first()).toBeVisible()

  let postCacheApiCalls = 0
  page.on('request', (req) => {
    if (req.url().includes('/api/v2/detections')) {
      postCacheApiCalls += 1
    }
  })

  await page.reload()
  await page.waitForLoadState('networkidle')

  expect(postCacheApiCalls).toBe(0)
  await expect(page.getByText('Erkennungen gesamt')).toBeVisible()
  await expect(page.getByText(/^\d+$/).first()).toBeVisible()
})

test('background warmer populates cache without blocking live view', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=landing')
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible()

  await page.waitForTimeout(3000)

  const cacheKeys = await getCacheKeys(page)
  expect(cacheKeys.length).toBeGreaterThan(0)
})

test('highlights page has cache keys available on first load', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=rarity')
  await expect(page.getByRole('heading', { name: 'Top 10 Highlights' })).toBeVisible()
  await page.waitForLoadState('networkidle')

  const cacheKeys = await getCacheKeys(page)
  expect(cacheKeys.length).toBeGreaterThan(0)
})

test('highlights page uses cache on reload (allows up to 2 API calls)', async ({ page }) => {
  await installBirdnetApiMocks(page)

  await page.goto('/?view=rarity')
  await expect(page.getByRole('heading', { name: 'Top 10 Highlights' })).toBeVisible()
  await page.waitForLoadState('networkidle')

  let postCacheApiCalls = 0
  page.on('request', (req) => {
    if (req.url().includes('/api/v2/detections')) {
      postCacheApiCalls += 1
    }
  })

  await page.reload()
  await page.waitForLoadState('networkidle')

  // Highlights includes today's range; day cache intentionally skips storing pages
  // where endDate >= today, so a small number of reload fetches is expected.
  expect(postCacheApiCalls).toBeLessThanOrEqual(2)
  await expect(page.getByRole('heading', { name: 'Top 10 Highlights' })).toBeVisible()
})
