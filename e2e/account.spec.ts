import { expect, test, type Page } from '@playwright/test'

import { departures, market, MARKET, signIn } from './flow'
import { END_SESSION, HANZO_AI, mock, token, world } from './mock'

// The signed-in person's menu in the bar, and the ways to be someone else or no
// one. The accounts signed in on this browser are hanzo.ai's to list and choose
// among: this site asks its own origin for no account list and draws no chooser,
// and Switch account and Add account leave for hanzo.ai's chooser with this
// site's own request. Signing out hands the tokens back here and ends the
// session through hanzo.id, back to the home page.

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')

/** A token for `sub`, as hanzo.id mints one for this site. */
const jwt = (sub: string) =>
  `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({ sub, iss: 'https://hanzo.id', aud: 'hanzo-market', orgs: [{ org: 'acme', role: 'admin' }], exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`

/** The subject of the access token this site holds, or null. */
const holder = (page: Page) =>
  page.evaluate(() => {
    const t = localStorage.getItem('hanzo_iam_access_token')
    return t ? (JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { sub: string }).sub : null
  })

/** Signed in on this site, the way a real sign-in ends, and on to `path`. */
async function member(page: Page, path: string) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mock(page, world())
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await page.goto(path)
}

/** The bar's menu, open. */
async function menu(page: Page) {
  await page.getByRole('button', { name: /^Account:/ }).click()
  return page.getByRole('menu')
}

test('signed in, the bar’s menu is their things, Switch account, Add account and Log out, and no account list is asked of this origin', async ({ page }) => {
  const asked: string[] = []
  page.on('request', (r) => {
    const p = new URL(r.url()).pathname
    if (p === '/v1/iam/accounts' || p === '/v1/iam/login') asked.push(p)
  })
  await member(page, '/experts')
  const m = await menu(page)
  for (const name of ['Your jobs', 'Your listings', 'Switch account', 'Add account', 'Log out']) await expect(m.getByRole('menuitem', { name })).toBeVisible()
  // hanzo.ai's chooser holds the other accounts: none are rows here, and there is one way out.
  await expect(m.getByRole('menuitem', { name: 'Sign out of all accounts' })).toHaveCount(0)
  expect(asked).toEqual([])
})

test('Switch account leaves for hanzo.ai’s chooser with this site’s own request, and the account chosen there comes back to this page as them', async ({ page }) => {
  await member(page, '/experts')
  // hanzo.ai's chooser, where Grace is pressed: her code comes back to this site's callback.
  const asked: URL[] = []
  await page.route(HANZO_AI, (route) => {
    const u = new URL(route.request().url())
    asked.push(u)
    const back = new URL(u.searchParams.get('redirect_uri') ?? '')
    back.searchParams.set('code', 'grace-code')
    back.searchParams.set('state', u.searchParams.get('state') ?? '')
    return route.fulfill({ status: 302, headers: { location: back.toString() } })
  })
  await page.route(/hanzo\.id\/v1\/iam\/oauth\/token/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ access_token: jwt('acme/grace'), refresh_token: 'r', id_token: jwt('acme/grace'), token_type: 'Bearer', expires_in: 3600 }),
    }),
  )
  expect(await holder(page)).toBe('acme/ada')
  const exchanged = page.waitForRequest((r) => new URL(r.url()).pathname === '/v1/iam/oauth/token' && (r.postData() ?? '').includes('grace-code'))
  await (await menu(page)).getByRole('menuitem', { name: 'Switch account' }).click()
  await exchanged

  const to = asked[0]
  expect(to.origin + to.pathname).toBe('https://hanzo.ai/login')
  expect(to.searchParams.get('prompt')).toBe('select_account')
  expect(to.searchParams.get('client_id')).toBe('hanzo-market')
  expect(to.searchParams.get('redirect_uri')).toBe(`${new URL(page.url()).origin}/auth/callback`)
  expect(to.searchParams.get('code_challenge_method')).toBe('S256')
  await page.waitForURL((u) => u.pathname === '/experts')
  await expect.poll(() => holder(page)).toBe('acme/grace')
})

test('Add account leaves for hanzo.ai’s chooser with this site’s own request, keeps the session held here, and comes back to the page', async ({ page }) => {
  await member(page, '/experts')
  const left = await departures(page)
  await (await menu(page)).getByRole('menuitem', { name: 'Add account' }).click()
  await expect.poll(() => left.length, { message: 'the browser never left for hanzo.ai' }).toBeGreaterThan(0)
  const to = left[0]
  expect(to.origin + to.pathname).toBe('https://hanzo.ai/login')
  expect(to.searchParams.get('prompt')).toBe('select_account')
  expect(to.searchParams.get('client_id')).toBe('hanzo-market')
  expect(await page.evaluate(() => sessionStorage.getItem('market:return'))).toBe('/experts')
  // Nobody is signed out to add someone: the account held here stays until another comes back.
  expect(await holder(page)).toBe('acme/ada')
})

test('on hanzo.market, Log out hands the tokens back there, then leaves for hanzo.id’s end-session for every Hanzo app, back to the home page', async ({ page, baseURL }) => {
  const w = world()
  await market(page, baseURL ?? '')
  await mock(page, w)
  // Signed in as the callback leaves a browser: the tokens in this site's storage.
  await page.addInitScript((t) => {
    localStorage.setItem('hanzo_iam_access_token', t)
    localStorage.setItem('hanzo_iam_refresh_token', 'refresh')
    localStorage.setItem('hanzo_iam_id_token', t)
    localStorage.setItem('hanzo_iam_expires_at', String(Date.now() + 3_600_000))
  }, token(w))
  const left = await departures(page, END_SESSION)
  const posted: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (r.method() === 'POST' && u.pathname.startsWith('/v1/iam/oauth/')) posted.push(u.origin + u.pathname)
  })
  await page.goto(`${MARKET}/`)
  await (await menu(page)).getByRole('menuitem', { name: 'Log out' }).click()
  await expect.poll(() => left.length, { message: 'the browser never left for hanzo.id' }).toBeGreaterThan(0)

  const out = left[0]
  expect(out.origin + out.pathname).toBe('https://hanzo.id/v1/iam/oauth/logout')
  // Every Hanzo app's grant ends with the session, the browser comes back to the home page, and no token rides in the address.
  expect(Object.fromEntries(out.searchParams)).toEqual({ client_id: 'hanzo-market', everywhere: 'true', post_logout_redirect_uri: `${MARKET}/` })
  expect(posted).toEqual(expect.arrayContaining([`${MARKET}/v1/iam/oauth/revoke`]))
  expect(posted.filter((p) => !p.startsWith(MARKET))).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem('hanzo_iam_access_token'))).toBeNull()
})

test('on a local page Log out hands the tokens back here and stays local, on the home page, signed out', async ({ page }) => {
  await member(page, '/experts')
  const origin = new URL(page.url()).origin
  const away: string[] = []
  const posted: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (r.isNavigationRequest() && (u.hostname === 'hanzo.id' || u.hostname === 'hanzo.ai')) away.push(r.url())
    if (r.method() === 'POST' && u.pathname.startsWith('/v1/iam/oauth/')) posted.push(u.origin + u.pathname)
  })
  await (await menu(page)).getByRole('menuitem', { name: 'Log out' }).click()
  await page.waitForURL((u) => u.origin === origin && u.pathname === '/')
  await expect(page.getByRole('heading', { name: 'Agents, personas, apps, skills, MCP servers and tools' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Account:/ })).toHaveCount(0)
  expect(posted).toEqual(expect.arrayContaining([`${origin}/v1/iam/oauth/revoke`, `${origin}/v1/iam/oauth/logout`]))
  expect(await holder(page)).toBeNull()
  expect(away).toEqual([])
})
