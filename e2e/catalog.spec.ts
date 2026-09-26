import { expect, test } from '@playwright/test'

import { mock, world } from './mock'

// Red market-5: the apps directory held 453, one page of 60 was loaded, and the
// Apps facet and "Show more" stopped at 60. Here the directory holds 130.
test('everything a directory holds is counted and reachable by paging its server', async ({ page }) => {
  const w = world({
    apps: Array.from({ length: 130 }, (_, i) => ({ id: `acme/app-${i}`, org: 'acme', name: `app-${i}`, kind: 'repo', origin: 'community', forkable: true })),
  })
  await mock(page, w)
  await page.goto('/apps')
  await expect(page.getByRole('button', { name: 'Apps 130' })).toBeVisible()
  await expect(page.locator('[data-item^="app:"]')).toHaveCount(48)
  await page.getByRole('button', { name: 'Show more · 82 left' }).click()
  await expect(page.locator('[data-item^="app:"]')).toHaveCount(96)
  await page.getByRole('button', { name: 'Show more · 34 left' }).click()
  await expect(page.locator('[data-item^="app:"]')).toHaveCount(130)
  await expect(page.locator('[data-item="app:acme/app-129"]')).toBeVisible()
  await expect(page.getByRole('button', { name: /Show more/ })).toHaveCount(0)
  // Each page was asked of the server, where the last left off.
  expect(w.calls.filter((c) => c.startsWith('GET /v1/catalog')).map((c) => new URL(c.slice(4), 'http://x').searchParams.get('offset'))).toEqual(['0', '48', '96'])
})
