import { expect, test } from '@playwright/test'

test('app shell loads', async ({ page }) => {
  await page.goto('/?view=landing')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('today view shows friendly API error state', async ({ page }) => {
  await page.route('**/api/v2/detections*', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'unavailable' }),
    })
  })

  await page.goto('/?view=today')
  await expect(
    page
      .getByText('BirdNET ist momentan nicht verfuegbar. Bitte spaeter erneut versuchen.')
      .first(),
  ).toBeVisible()
})

test('today view renders grouped detections and can filter species', async ({ page }) => {
  await page.route('**/api/v2/detections*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: '1',
            common_name: 'Amsel',
            scientific_name: 'Turdus merula',
            timestamp: '2026-02-14T08:15:00Z',
            confidence: 0.95,
          },
          {
            id: '2',
            common_name: 'Amsel',
            scientific_name: 'Turdus merula',
            timestamp: '2026-02-14T09:20:00Z',
            confidence: 0.91,
          },
          {
            id: '3',
            common_name: 'Rotkehlchen',
            scientific_name: 'Erithacus rubecula',
            timestamp: '2026-02-14T09:45:00Z',
            confidence: 0.88,
          },
        ],
      }),
    })
  })

  await page.route('**://*.wikipedia.org/**', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.goto('/?view=today')

  await expect(page.getByText('Erkennungen gesamt').first()).toBeVisible()
  await expect(page.getByText('3').first()).toBeVisible()
  await expect(page.getByText('Top-Art').first()).toBeVisible()
  await expect(page.getByText('Amsel').first()).toBeVisible()

  await page.getByPlaceholder('Artnamen eingeben').fill('Rot')
  await expect(page.getByText('Filter: Rot').first()).toBeVisible()
  await expect(page.getByText('1').first()).toBeVisible()
  await expect(page.getByText('Rotkehlchen').first()).toBeVisible()
})

test('archive view can render grouped species from date-range query', async ({ page }) => {
  await page.route('**/api/v2/detections*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'a',
            common_name: 'Blaumeise',
            scientific_name: 'Cyanistes caeruleus',
            timestamp: '2026-02-13T12:00:00Z',
            confidence: 0.81,
          },
          {
            id: 'b',
            common_name: 'Kohlmeise',
            scientific_name: 'Parus major',
            timestamp: '2026-02-12T10:00:00Z',
            confidence: 0.85,
          },
          {
            id: 'c',
            common_name: 'Kohlmeise',
            scientific_name: 'Parus major',
            timestamp: '2026-02-12T10:20:00Z',
            confidence: 0.9,
          },
        ],
        total: 3,
      }),
    })
  })

  await page.route('**://*.wikipedia.org/**', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.goto('/?view=archive')

  await expect(page.getByRole('heading', { name: 'Archiv-Erkennungen' })).toBeVisible()
  await expect(page.getByText('Erkennungen gesamt').first()).toBeVisible()
  await expect(page.getByText('Kohlmeise').first()).toBeVisible()

  await page.getByPlaceholder('Artnamen eingeben').fill('Blaumeise')
  await expect(page.getByText('Filter: Blaumeise')).toBeVisible()
  await expect(page.getByText('Blaumeise').first()).toBeVisible()
})
