import { expect, type Page } from '@playwright/test'

/** Sign in on this site's own /login, whose credential call the mock answers, and wait to land back on `path`. */
export async function signIn(page: Page, path: string) {
  await page.getByRole('button', { name: 'Try Hanzo' }).click()
  await page.waitForURL((u) => u.pathname + u.search === path)
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toHaveCount(0)
}

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')

/** hanzo.id answers sign-ins on `page` with a token that lists two orgs: acme (home) and globex. */
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
