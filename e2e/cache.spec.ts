import { expect, test } from '@playwright/test'

import { installBirdnetApiMocks } from './support/mockBirdnet'

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

test('statistics page reuses warm summary on reload (no detection API calls)', async ({ page }) => {
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

  let summaryCalls = 0
  let recentCalls = 0
  page.on('request', (req) => {
    if (req.url().includes('/api/v2/summary/30d')) {
      summaryCalls += 1
    }
    if (req.url().includes('/api/v2/detections/recent')) {
      recentCalls += 1
    }
  })

  await page.goto('/?view=landing')
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible()

  await page.waitForTimeout(3000)
  expect(summaryCalls).toBeGreaterThan(0)
  expect(recentCalls).toBeGreaterThan(0)
})

test('highlights page has cache keys available on first load', async ({ page }) => {
  await installBirdnetApiMocks(page)

  let summaryCalls = 0
  page.on('request', (req) => {
    if (req.url().includes('/api/v2/summary/30d')) {
      summaryCalls += 1
    }
  })

  await page.goto('/?view=rarity')
  await expect(page.getByRole('heading', { name: 'Top 10 Highlights' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(summaryCalls).toBeGreaterThan(0)
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
