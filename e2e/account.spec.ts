import { expect, test, type Page, type Route } from '@playwright/test'

import { signIn } from './flow'
import { mock, world } from './mock'

// The accounts signed in on this browser: the chooser on /login and the account
// menu in the bar, both @hanzo/app's, on this site's own origin. IAM's account list,
// credential and sign-out calls are answered at the network layer.

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS' }
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })

const ada = { sub: 'acme/ada', owner: 'acme', name: 'ada', displayName: 'Ada Lovelace', email: 'ada@acme.test', avatar: '' }
const grace = { sub: 'acme/grace', owner: 'acme', name: 'grace', displayName: 'Grace Hopper', email: 'grace@acme.test', avatar: '' }

interface Held {
  accounts: Record<string, string>[]
  /** The account each credential call named (`loginHint` in its body), or empty. */
  logins: string[]
  puts: unknown[]
  logouts: string[]
}

/** IAM's account list for this browser, and a credential call that spends a session only for the account it is told to (it asks the person to choose otherwise). */
async function iam(page: Page, accounts: Record<string, string>[], silent = false): Promise<Held> {
  const held: Held = { accounts: [...accounts], logins: [], puts: [], logouts: [] }
  await page.route(/\/v1\/iam\/accounts$/, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (route.request().method() === 'PUT') {
      held.puts.push(route.request().postDataJSON())
      return json(route, { status: 'ok' })
    }
    return json(route, { status: 'ok', data: held.accounts })
  })
  if (!silent) {
    await page.route(/\/v1\/iam\/login(\?|$)/, (route, req) => {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      const named = (req.postDataJSON() as { loginHint?: string } | null)?.loginHint ?? ''
      held.logins.push(named)
      return named ? json(route, { status: 'ok', data: 'test-code' }) : json(route, { status: 'error', msg: 'choose an account' }, 400)
    })
  }
  await page.route(/\/v1\/iam\/oauth\/logout/, (route, req) => {
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const hint = new URLSearchParams(req.postData() ?? '').get('logout_hint')
    if (hint) {
      held.logouts.push(hint)
      held.accounts = held.accounts.filter((a) => a.sub !== hint)
    }
    return json(route, { status: 'ok' })
  })
  return held
}

const rows = (page: Page) => page.getByRole('region', { name: 'Accounts' })

test('/login with several accounts signed in asks which one, and signing in as one is on this site, as that account', async ({ page }) => {
  await mock(page, world())
  const held = await iam(page, [ada, grace])
  const issuer: string[] = []
  page.on('request', (r) => {
    if (r.isNavigationRequest() && new URL(r.url()).hostname === 'hanzo.id') issuer.push(r.url())
  })
  await page.goto('/login')
  await expect(rows(page)).toBeVisible()
  await expect(rows(page).getByRole('button', { name: 'Continue as ada@acme.test' })).toBeVisible()
  await expect(rows(page).getByRole('button', { name: 'Continue as grace@acme.test' })).toBeVisible()
  await expect(rows(page)).toContainText('Ada Lovelace')
  await expect(rows(page)).toContainText('grace@acme.test · acme')
  await expect(rows(page).getByRole('button', { name: 'Use another account' })).toBeVisible()
  await expect(rows(page).getByRole('button', { name: 'Sign out of all accounts' })).toBeVisible()
  // The chooser stands where the form would, and the form is not drawn under it.
  await expect(page.getByRole('heading', { name: 'Log in to Hanzo Market' })).toHaveCount(0)

  await rows(page).getByRole('button', { name: 'Continue as grace@acme.test' }).click()
  await page.waitForURL((u) => u.pathname === '/')
  // IAM was asked, on this origin, for the account that was pressed.
  expect(held.logins).toContain('acme/grace')
  expect(issuer).toEqual([])
})

test('one account alone is the form, not a chooser; one just signed out of is the chooser', async ({ page }) => {
  await mock(page, world())
  await iam(page, [ada])
  await page.goto('/login?from=logout')
  await expect(rows(page)).toBeVisible()
  await expect(rows(page).getByRole('button', { name: 'Sign out of all accounts' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Use another account' }).click()
  await expect(page.getByRole('heading', { name: 'Log in to Hanzo Market' })).toBeVisible()
  await expect(rows(page)).toHaveCount(0)

  const fresh = await page.context().newPage()
  await mock(fresh, world())
  await iam(fresh, [ada])
  await fresh.goto('/login')
  await expect(fresh.getByRole('heading', { name: 'Log in to Hanzo Market' })).toBeVisible()
  await expect(fresh.getByRole('region', { name: 'Accounts' })).toHaveCount(0)
  await fresh.close()
})

test('nobody listed, or IAM not answering, is the sign-in form as it always was', async ({ page }) => {
  await mock(page, world())
  await iam(page, [])
  await page.goto('/login?from=logout')
  await expect(page.getByRole('heading', { name: 'Log in to Hanzo Market' })).toBeVisible()
  await expect(rows(page)).toHaveCount(0)
  const down = await page.context().newPage()
  await mock(down, world())
  await down.route(/\/v1\/iam\/accounts$/, (route) => route.fulfill({ status: 503, contentType: 'text/plain', headers: cors, body: 'down' }))
  await down.goto('/login?from=logout')
  await expect(down.getByRole('heading', { name: 'Log in to Hanzo Market' })).toBeVisible()
  await down.close()
})

test('Sign out on a row ends that account alone, here, and the rest remain', async ({ page }) => {
  await mock(page, world())
  const held = await iam(page, [ada, grace])
  await page.goto('/login')
  await rows(page).getByRole('button', { name: 'Sign out Grace Hopper' }).click()
  await expect(rows(page).getByRole('button', { name: 'Continue as grace@acme.test' })).toHaveCount(0)
  await expect(rows(page).getByRole('button', { name: 'Continue as ada@acme.test' })).toBeVisible()
  expect(held.logouts).toEqual(['acme/grace'])
  // One account is left, so there is no all-accounts way out.
  await expect(rows(page).getByRole('button', { name: 'Sign out of all accounts' })).toHaveCount(0)
})

test('Sign out of all accounts ends every session and lands on the sign-in', async ({ page }) => {
  await mock(page, world())
  const held = await iam(page, [ada, grace])
  await page.goto('/login')
  const ended = page.waitForRequest((r) => new URL(r.url()).pathname === '/v1/iam/oauth/logout' && r.method() === 'POST')
  await rows(page).getByRole('button', { name: 'Sign out of all accounts' }).click()
  const req = await ended
  expect(new URLSearchParams(req.postData() ?? '').get('logout_hint')).toBeNull()
  await page.waitForURL((u) => u.pathname === '/login')
  expect(held.logouts).toEqual([])
})

// ── the bar's menu ───────────────────────────────────────────────────────────

test('signed in with several accounts, the bar’s menu lists the others, Add account and the ways out; choosing one comes back to this page as them', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mock(page, world())
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  const held = await iam(page, [ada, grace], true)
  await page.route(/\/v1\/iam\/login(\?|$)/, (route, req) => {
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    held.logins.push((req.postDataJSON() as { loginHint?: string } | null)?.loginHint ?? '')
    return json(route, { status: 'ok', data: 'test-code' })
  })
  await page.goto('/experts')
  await page.getByRole('button', { name: /^Account:/ }).click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: /Grace Hopper/ })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: /Ada Lovelace/ })).toHaveCount(1) // the bar's own row is the label, not a switch
  await expect(menu.getByRole('menuitem', { name: 'Add account' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: /^Sign out Ada/ })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Sign out of all accounts' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Your jobs' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Your listings' })).toBeVisible()

  await menu.getByRole('menuitem', { name: /Grace Hopper/ }).click()
  await page.waitForURL((u) => u.pathname === '/experts')
  expect(held.logins).toContain('acme/grace')
})

test('Add account goes to this site’s own form and comes back to the page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mock(page, world())
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await iam(page, [ada, grace], true)
  await page.goto('/experts')
  await page.getByRole('button', { name: /^Account:/ }).click()
  await page.getByRole('menuitem', { name: 'Add account' }).click()
  await expect(page).toHaveURL(/\/login\?from=add$/)
  // The form, asked for: IAM is not asked to sign the same person straight back in.
  await expect(page.getByRole('heading', { name: 'Log in to Hanzo Market' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('market:return'))).toBe('/experts')
})

test('with one account signed in the menu says Log out, which is all of it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mock(page, world())
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await iam(page, [ada], true)
  await page.goto('/experts')
  await page.getByRole('button', { name: /^Account:/ }).click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: 'Log out' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Sign out of all accounts' })).toHaveCount(0)
  await expect(menu.getByRole('menuitem', { name: 'Add account' })).toBeVisible()
})

// ── the fit ──────────────────────────────────────────────────────────────────

for (const screen of [
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`the chooser at ${screen.width} is centred in the page area above the footer, and does not overflow`, async ({ page }) => {
    await page.setViewportSize(screen)
    await mock(page, world())
    await iam(page, [ada, grace])
    await page.goto('/login')
    await expect(rows(page)).toBeVisible()
    const m = await page.evaluate(() => {
      const box = (el: Element | null) => {
        if (!el) throw new Error('not drawn')
        const r = el.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
      }
      return {
        card: box(document.querySelector('section[aria-label="Accounts"]')),
        area: box(document.querySelector('main > *')),
        footer: box(document.querySelector('footer')),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    })
    expect(Math.abs((m.card.left + m.card.right) / 2 - screen.width / 2)).toBeLessThanOrEqual(1)
    expect(m.area.bottom - m.area.top).toBeGreaterThanOrEqual(screen.height - 60 - 1)
    expect(m.card.bottom).toBeLessThanOrEqual(m.footer.top)
    expect(Math.abs(m.card.top - m.area.top - (m.area.bottom - m.card.bottom))).toBeLessThanOrEqual(2)
    expect(m.overflow).toBeLessThanOrEqual(0)
  })
}
