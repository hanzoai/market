import { expect, test } from '@playwright/test'

// Read-only checks that run against a deployed storefront (BASE_URL=…) as well
// as the dev server. No sign-in, no writes, no payments.

test('@live the storefront loads with the Hanzo chrome and the catalog', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Agents, apps, skills and MCP servers' })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search the marketplace' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Try Hanzo' }).first()).toHaveAttribute('href', '/login')
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

test('@live signing in stays on this site: /login draws the sign-in and nothing goes to hanzo.id', async ({ page }) => {
  const issuer: string[] = []
  page.on('request', (r) => {
    if (r.isNavigationRequest() && new URL(r.url()).hostname === 'hanzo.id') issuer.push(r.url())
  })
  await page.goto('/sell')
  await page.getByRole('button', { name: 'Try Hanzo' }).click()
  await page.waitForURL((u) => u.pathname === '/login')
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
  expect(issuer).toEqual([])
})
