import { expect, test } from '@playwright/test'

// Read-only checks that run against a deployed storefront (BASE_URL=…) as well
// as the dev server. No sign-in, no writes, no payments.

test('@live the storefront loads with the Hanzo chrome and the catalog', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Agents, apps, skills and MCP servers' })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search the marketplace' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Start selling' }).first()).toBeVisible()
  await expect(page.getByRole('contentinfo')).toBeVisible()
  expect(errors).toEqual([])
})

test('@live deep links land on the app', async ({ page }) => {
  for (const path of ['/agents', '/skills', '/sell', '/l/unknown']) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBeLessThan(500)
    await expect(page.locator('#root')).not.toBeEmpty()
  }
  await page.goto('/sell')
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
})
