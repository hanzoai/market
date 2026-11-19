import { expect, test } from '@playwright/test'

import { departures } from './flow'
import { mock, world } from './mock'

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
const jwt = (exp: number) => `${b64url({ alg: 'RS256' })}.${b64url({ sub: 'acme/ada', orgs: [{ org: 'acme' }], exp })}.sig`

test('sign-in is on hanzo.ai: Try Hanzo leaves for hanzo.ai/login with this site’s own request as hanzo-market, PKCE S256, its verifier kept here, and nothing typed or asked on this origin', async ({ page }) => {
  await mock(page, world())
  const left = await departures(page)
  const issuer: string[] = []
  const asked: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (r.isNavigationRequest() && u.hostname === 'hanzo.id') issuer.push(r.url())
    if (u.pathname === '/v1/iam/login' || u.pathname === '/v1/iam/accounts') asked.push(u.pathname)
  })
  await page.goto('/sell')
  await page.getByRole('button', { name: 'Try Hanzo' }).click()
  await expect.poll(() => left.length, { message: 'the browser never left for hanzo.ai' }).toBeGreaterThan(0)

  const to = left[0]
  const origin = new URL(page.url()).origin
  expect(to.origin + to.pathname).toBe('https://hanzo.ai/login')
  expect(to.searchParams.get('client_id')).toBe('hanzo-market')
  expect(to.searchParams.get('response_type')).toBe('code')
  expect(to.searchParams.get('redirect_uri')).toBe(`${origin}/auth/callback`)
  expect(to.searchParams.get('code_challenge_method')).toBe('S256')
  expect(to.searchParams.get('code_challenge')).toBeTruthy()
  // A first sign-in asks nothing of hanzo.ai: a session it holds answers at once.
  expect(to.searchParams.get('prompt')).toBeNull()
  // The state is this site's, and the verifier that answers the challenge never leaves it.
  const state = to.searchParams.get('state')
  expect(state).toBeTruthy()
  expect(await page.evaluate(() => localStorage.getItem('hanzo_iam_state'))).toBe(state)
  expect(await page.evaluate(() => localStorage.getItem('hanzo_iam_code_verifier'))).toBeTruthy()
  expect(to.search).not.toContain('code_verifier')
  // The code comes back to the page the sign-in started from.
  expect(await page.evaluate(() => sessionStorage.getItem('market:return'))).toBe('/sell')
  await expect(page.getByRole('textbox', { name: 'Email' })).toHaveCount(0)
  expect(asked).toEqual([])
  expect(issuer).toEqual([])
})

test('the code hanzo.ai sends back is exchanged here with the verifier kept here, and the sign-in lands on the page it started from', async ({ page }) => {
  await mock(page, world())
  await page.goto('/sell')
  const exchange = page.waitForRequest((r) => {
    const u = new URL(r.url())
    return u.hostname === 'hanzo.id' && u.pathname === '/v1/iam/oauth/token' && r.method() === 'POST'
  })
  await page.getByRole('button', { name: 'Try Hanzo' }).click()
  const body = new URLSearchParams((await exchange).postData() ?? '')
  expect(body.get('code')).toBe('test-code')
  expect(body.get('client_id')).toBe('hanzo-market')
  expect(body.get('code_verifier')).toBeTruthy()
  await page.waitForURL((u) => u.pathname === '/sell')
  await expect(page.getByRole('heading', { name: 'Set up your organization' })).toBeVisible()
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
  await page.getByRole('button', { name: 'Try Hanzo' }).click()
  await page.waitForURL((u) => u.pathname === '/sell')
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
})
