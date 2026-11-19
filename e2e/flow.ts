import { expect, type Page } from '@playwright/test'

import { HANZO_AI } from './mock'

/**
 * Sign in the way a real sign-in ends: Try Hanzo leaves through /login for
 * hanzo.ai with this site's own request, hanzo.ai (the mock's, holding a
 * session) sends the browser back to /auth/callback with a code and the
 * request's state, and the callback exchanges it with hanzo.id. Nothing is
 * typed. Waits to land back on `path`.
 */
export async function signIn(page: Page, path: string) {
  await page.getByRole('button', { name: 'Try Hanzo' }).click()
  await page.waitForURL((u) => u.pathname + u.search === path)
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toHaveCount(0)
}

/**
 * Every address the page leaves for that `where` matches (by default hanzo.ai's
 * sign-in and sign-up), in order. Each is refused rather than served, as
 * hanzo-inc/platform's sign-out check does, so the run never reaches hanzo.ai or
 * hanzo.id and the document stays on this site with its storage still readable.
 * Set after `mock`, so it is asked first.
 */
export async function departures(page: Page, where: RegExp = HANZO_AI): Promise<URL[]> {
  const left: URL[] = []
  await page.route(where, (route) => {
    if (route.request().isNavigationRequest()) left.push(new URL(route.request().url()))
    return route.abort('aborted')
  })
  return left
}

/** The storefront's published address. */
export const MARKET = 'https://hanzo.market'

/**
 * Serve `page` the storefront at its published address: https://hanzo.market
 * answered by the dev server at `dev`, so what only the published host does (a
 * sign-out that leaves for hanzo.id rather than staying local) runs here too. The
 * platform's paths fall through to `mock`, and the dev server's update socket
 * meets a silent stand-in, so nothing reaches the real host. Calls to
 * api.hanzo.ai from that origin are cross-origin and `mock` answers them without
 * CORS, so a test here reads no platform data; it is for the session alone.
 */
export async function market(page: Page, dev: string) {
  await page.routeWebSocket(/^wss:\/\/hanzo\.market(:\d*)?\//, () => {})
  await page.route(/^https:\/\/hanzo\.market\//, async (route) => {
    const u = new URL(route.request().url())
    if (u.pathname.startsWith('/v1/') || u.pathname.startsWith('/.well-known/agent-skills/')) return route.fallback()
    const headers = { ...route.request().headers() }
    delete headers.host
    return route.fulfill({ response: await page.request.fetch(`${dev}${u.pathname}${u.search}`, { headers }) })
  })
}

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')

/** hanzo.id answers the callback's code exchange on `page` with a token that lists two orgs: acme (home) and globex. */
export async function twoOrgs(page: Page) {
  const both = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({
    sub: 'acme/ada',
    iss: 'https://hanzo.id',
    aud: 'hanzo-market',
    orgs: [
      { org: 'acme', role: 'admin' },
      { org: 'globex', role: 'admin' },
    ],
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.sig`
  await page.route(/hanzo\.id\/v1\/iam\/oauth\/token/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ access_token: both, refresh_token: 'r', id_token: both, token_type: 'Bearer', expires_in: 3600 }),
    }),
  )
}
