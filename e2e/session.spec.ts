import { expect, test } from '@playwright/test'

import { mock, world } from './mock'

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
const jwt = (exp: number) => `${b64url({ alg: 'RS256' })}.${b64url({ sub: 'acme/ada', orgs: [{ org: 'acme' }], exp })}.sig`

test('sign-in is authorization code + PKCE S256 as client hanzo-market, with no secret', async ({ page }) => {
  await mock(page, world())
  await page.goto('/sell')
  const asked = page.waitForRequest(/hanzo\.id\/v1\/iam\/oauth\/authorize/)
  await page.getByRole('button', { name: 'Sign in with Hanzo' }).click()
  const u = new URL((await asked).url())
  expect(u.searchParams.get('client_id')).toBe('hanzo-market')
  expect(u.searchParams.get('code_challenge_method')).toBe('S256')
  expect(u.searchParams.get('code_challenge')).toBeTruthy()
  expect(u.searchParams.get('client_secret')).toBeNull()
})

// Red market-8: an expired token whose refresh hanzo.id refuses was still a session,
// so the Gate never offered sign-in and every read went out with the dead bearer.
test('an expired session whose refresh is refused is asked to sign in again', async ({ page }) => {
  await mock(page, world())
  await page.route(/hanzo\.id\/v1\/iam\/oauth\/token/, (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"error":"invalid_grant"}' }),
  )
  await page.addInitScript((t) => {
    localStorage.setItem('hanzo_iam_access_token', t)
    localStorage.setItem('hanzo_iam_refresh_token', 'revoked')
    localStorage.setItem('hanzo_iam_expires_at', String(Date.now() - 86_400_000))
  }, jwt(Math.floor(Date.now() / 1000) - 86_400))
  const bearers: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (r.headers().authorization && u.pathname.startsWith('/v1/') && u.hostname !== 'hanzo.id') bearers.push(u.pathname)
  })
  await page.goto('/sell')
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Set up your organization' })).toHaveCount(0)
  expect(bearers).toEqual([])
})

// A token the gateway refuses (revoked, or expired between refreshes) signs the reader out.
test('a session the gateway refuses is signed out', async ({ page }) => {
  await mock(page, world())
  await page.route(/\/v1\/principal$/, (route) =>
    route.fulfill({ status: 401, contentType: 'application/problem+json', body: JSON.stringify({ status: 401, detail: 'token revoked' }) }),
  )
  await page.goto('/sell')
  await page.getByRole('button', { name: 'Sign in with Hanzo' }).click()
  await page.waitForURL((u) => u.pathname === '/sell')
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
})
