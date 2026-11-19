import { expect, test, type Page, type Route } from '@playwright/test'

import { signIn } from './flow'
import { expert, mock, wallet, world, type World } from './mock'

// Connecting GitHub through IAM, the card it fills, what publishing sends, the
// refresh that shows its diff, and the fit of all of it at three widths. IAM, the
// rewards program and GitHub are answered at the network layer.

const cors = { 'access-control-allow-origin': '*' }
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })

const ADA = { login: 'ada', name: 'Ada Lovelace', bio: 'Analytical engines and Base apps.', blog: 'ada.dev', location: 'Berlin, Germany', html_url: 'https://github.com/ada' }
const REPOS = [
  { full_name: 'ada/engine', fork: false, language: 'Go', topics: ['base'], stargazers_count: 12, html_url: 'https://github.com/ada/engine', pushed_at: '2026-11-02T00:00:00Z' },
  { full_name: 'ada/site', fork: false, language: 'TypeScript', topics: [], stargazers_count: 0, html_url: 'https://github.com/ada/site', pushed_at: '2026-11-01T00:00:00Z' },
  { full_name: 'x/forked', fork: true, language: 'Rust', topics: [], stargazers_count: 99, html_url: 'https://github.com/x/forked', pushed_at: '2026-10-01T00:00:00Z' },
]

/** GitHub's public API and raw files, as they are for Ada: the account IAM links is id 424242. */
async function github(page: Page, who: Record<string, unknown> = ADA) {
  await page.route(/^https:\/\/api\.github\.com\//, (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/user/424242') return json(route, who)
    if (path === `/users/${String(who.login)}/repos`) return json(route, REPOS)
    return json(route, { message: 'Not Found' }, 404)
  })
  await page.route(/^https:\/\/raw\.githubusercontent\.com\//, (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/ada/engine/HEAD/go.mod') return route.fulfill({ status: 200, headers: cors, body: 'module engine\n\nrequire github.com/hanzoai/base v1.0.0\n' })
    if (path === '/ada/site/HEAD/package.json') return route.fulfill({ status: 200, headers: cors, body: '{"dependencies":{"@hanzo/commerce":"1.0.0","react":"19"}}' })
    return route.fulfill({ status: 404, headers: cors, body: '' })
  })
}

/** IAM lists the identities linked to the account. */
const linked = (page: Page, rows: { provider: string; subject: string }[]) => page.route(/\/v1\/iam\/linked-accounts/, (route) => json(route, { status: 'ok', data: rows }))

interface Program {
  profile: { handle: string; public: boolean; links: Record<string, string> } | null
  puts: unknown[]
}

/** The rewards program: the member's own profile, or not served at all (`null`). Writes are kept. */
async function program(page: Page, profile: Program['profile']): Promise<Program> {
  const state: Program = { profile, puts: [] }
  await page.route(/\/v1\/reward\/me\/profile/, (route) => {
    if (route.request().method() === 'PUT') {
      state.puts.push(route.request().postDataJSON())
      state.profile = route.request().postDataJSON() as Program['profile']
      return json(route, state.profile)
    }
    return state.profile ? json(route, state.profile) : route.fulfill({ status: 404, contentType: 'application/problem+json', headers: cors, body: '{"status":404,"detail":"not found"}' })
  })
  return state
}

/** Signed in on this site (the form's gate does it), then on to `path`. */
async function member(page: Page, path: string) {
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await page.goto(path)
}

const isListing = (r: { method(): string; url(): string }) => r.method() === 'POST' && new URL(r.url()).pathname === '/v1/marketplace/listings'

function paid(): World {
  const w = world()
  wallet(w)
  return w
}

test('a linked GitHub account fills the card, and publishing sends exactly what the card shows, level and badges public by default', async ({ page }) => {
  const w = paid()
  await mock(page, w)
  await github(page)
  await linked(page, [{ provider: 'github', subject: '424242' }])
  const rewards = await program(page, { handle: '', public: false, links: {} })
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')

  // What GitHub's public record really says, as the person's own to change.
  await expect(page.getByRole('textbox', { name: 'Name or headline' })).toHaveValue('Ada Lovelace')
  await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue('Analytical engines and Base apps.')
  await expect(page.getByRole('group', { name: 'Skills' }).getByRole('button')).toHaveText(['Go ×', 'TypeScript ×', 'base ×'])
  const areas = page.getByRole('group', { name: 'Areas' })
  await expect(areas.getByRole('button', { name: 'Build with Base', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(areas.getByRole('button', { name: 'Commerce', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(areas.getByRole('button', { name: 'Bot', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('combobox', { name: 'Time zone' })).toHaveValue('Europe/Berlin')
  await expect(page.getByRole('group', { name: 'Languages' }).getByRole('button')).toHaveText(['English ×'])
  await expect(page.getByRole('group', { name: 'Links' }).getByRole('button')).toHaveText(['github.com/ada ×', 'ada.dev/ ×', 'github.com/ada/engine ×'])
  // Already linked: no connect to press, and GitHub's public record is the one thing read.
  await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Show my Hanzo level and badges' })).toBeChecked()

  // Review: take a skill off, add one, choose the week and one fixed price.
  await page.getByRole('button', { name: 'Remove TypeScript' }).click()
  await page.getByRole('textbox', { name: 'Add skills' }).fill('Kai')
  await page.getByRole('textbox', { name: 'Add skills' }).press('Enter')
  await page.getByRole('group', { name: 'Availability' }).getByRole('button', { name: 'Full-time' }).click()
  await page.getByRole('group', { name: 'Rate' }).getByRole('button', { name: 'Fixed' }).click()
  await expect(page.getByRole('textbox', { name: 'Hourly rate (USD)' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Fixed price (USD)' }).fill('2000')

  const sent = page.waitForRequest(isListing)
  await page.getByRole('button', { name: 'Publish' }).click()
  expect((await sent).postDataJSON()).toEqual({
    kind: 'expert',
    title: 'Ada Lovelace',
    description: 'Analytical engines and Base apps.',
    price: '2000',
    recipient: 'wal_acme',
    public: true,
    expert: {
      rate: '0',
      areas: ['base', 'commerce'],
      languages: ['en'],
      timezone: 'Europe/Berlin',
      availability: 'Full-time',
      skills: ['Go', 'base', 'Kai'],
      links: ['https://github.com/ada', 'https://ada.dev/', 'https://github.com/ada/engine'],
    },
  })
  // The consent was recorded for their handle, from their GitHub login, before the listing.
  expect(rewards.puts).toEqual([{ handle: 'ada', public: true, links: { github: 'https://github.com/ada' } }])
  await expect(page).toHaveURL(/\/experts\/lst_1$/)
})

test('unticked, nothing is made public; a private profile stays private', async ({ page }) => {
  const w = paid()
  await mock(page, w)
  const rewards = await program(page, { handle: 'ada', public: false, links: {} })
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  // A member who chose private once is not turned public by a save.
  await expect(page.getByRole('checkbox', { name: 'Show my Hanzo level and badges' })).not.toBeChecked()
  await fill(page)
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page).toHaveURL(/\/experts\/lst_1$/)
  expect(rewards.puts).toEqual([])

})

test('the rewards program down or not served: the card has no checkbox, and publishing still works with no profile written', async ({ page }) => {
  const w = paid()
  await mock(page, w)
  await program(page, null)
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await expect(page.getByRole('checkbox', { name: 'Show my Hanzo level and badges' })).toHaveCount(0)
  await fill(page)
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page).toHaveURL(/\/experts\/lst_1$/)
  expect(w.listings).toHaveLength(1)
})

/** The minimum a card needs to publish, with nothing prefilled. */
async function fill(page: Page) {
  await page.getByRole('textbox', { name: 'Name or headline' }).fill('Ada Lovelace')
  await page.getByRole('group', { name: 'Areas' }).getByRole('button', { name: 'Cloud', exact: true }).click()
  await page.getByRole('group', { name: 'Availability' }).getByRole('button', { name: 'Weekends' }).click()
  await page.getByRole('textbox', { name: 'Hourly rate (USD)' }).fill('90')
}

test('with nothing to prefill it is the same short card, empty, and connecting is one press away', async ({ page }) => {
  const w = paid()
  await mock(page, w)
  await linked(page, [])
  await program(page, { handle: '', public: false, links: {} })
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await expect(page.getByRole('textbox', { name: 'Name or headline' })).toHaveValue('')
  await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue('')
  await expect(page.getByRole('group', { name: 'Skills' }).getByRole('button')).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Links' }).getByRole('button')).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Areas' }).getByRole('button', { pressed: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled()
  // One rate field, not two.
  await expect(page.getByRole('textbox', { name: /rate|price/i })).toHaveCount(1)
})

test('Continue with GitHub asks IAM to link it on this origin, goes where IAM says, and the return lands back on the card', async ({ page }) => {
  const w = paid()
  await mock(page, w)
  await github(page)
  let rows: { provider: string; subject: string }[] = []
  await page.route(/\/v1\/iam\/linked-accounts/, (route) => json(route, { status: 'ok', data: rows }))
  await program(page, { handle: '', public: false, links: {} })
  const asked: { url: string; body: unknown; auth: string | undefined }[] = []
  await page.route(/\/v1\/iam\/link$/, (route) => {
    const req = route.request()
    asked.push({ url: req.url(), body: req.postDataJSON(), auth: req.headers().authorization })
    // IAM carries the browser to GitHub and back; it returns to the callback saying what it connected.
    rows = [{ provider: 'github', subject: '424242' }]
    return json(route, { status: 'ok', data: `${new URL(page.url()).origin}/auth/callback?linked=provider-github` })
  })
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await page.getByRole('button', { name: 'Continue with GitHub' }).click()

  await expect(page).toHaveURL(/\/experts\/join$/)
  await expect(page.getByRole('textbox', { name: 'Name or headline' })).toHaveValue('Ada Lovelace')
  expect(asked).toHaveLength(1)
  expect(new URL(asked[0].url).origin).toBe(new URL(page.url()).origin)
  expect(asked[0].body).toEqual({ provider: 'provider-github', clientId: 'hanzo-market', returnUri: `${new URL(page.url()).origin}/auth/callback` })
  expect(asked[0].auth).toMatch(/^Bearer /)
})

test('IAM’s refusal to connect is said on the card in its own words', async ({ page }) => {
  const w = paid()
  await mock(page, w)
  await linked(page, [])
  await program(page, { handle: '', public: false, links: {} })
  await page.route(/\/v1\/iam\/link$/, (route) =>
    json(route, { status: 'ok', data: `${new URL(page.url()).origin}/auth/callback?error=access_denied&error_description=${encodeURIComponent('that account is already connected to someone else')}` }),
  )
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await page.getByRole('button', { name: 'Continue with GitHub' }).click()
  await expect(page).toHaveURL(/\/experts\/join$/)
  await expect(page.getByRole('alert')).toHaveText('that account is already connected to someone else')
  await expect(page.getByRole('textbox', { name: 'Name or headline' })).toHaveValue('')
})

test('a link the origin does not answer says so, and the card is unharmed', async ({ page }) => {
  const w = paid()
  await mock(page, w)
  await linked(page, [])
  await program(page, null)
  await page.route(/\/v1\/iam\/link$/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html>' }))
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await page.getByRole('button', { name: 'Continue with GitHub' }).click()
  await expect(page.getByRole('alert')).toHaveText('Connecting is not available here yet.')
  await expect(page.getByRole('textbox', { name: 'Name or headline' })).toBeVisible()
})

test('GitHub limiting reads is said as it is, and the card is empty rather than invented', async ({ page }) => {
  const w = paid()
  await mock(page, w)
  await linked(page, [{ provider: 'github', subject: '424242' }])
  await program(page, null)
  await page.route(/^https:\/\/api\.github\.com\//, (route) => json(route, { message: 'rate limit' }, 403))
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await expect(page.getByRole('alert')).toContainText('GitHub is limiting reads')
  await expect(page.getByRole('textbox', { name: 'Name or headline' })).toHaveValue('')
})

// ── refresh ──────────────────────────────────────────────────────────────────

function own(w: World, over: Record<string, unknown> = {}, profile: Record<string, unknown> = {}) {
  const mine = {
    id: 'lst_own',
    publisherOrg: 'acme',
    kind: 'expert',
    tool: '',
    ref: '',
    title: 'Ada L',
    description: 'Old bio.',
    category: '',
    price: '0',
    currency: 'USD',
    recipient: 'wal_acme',
    public: true,
    createdAt: 1,
    updatedAt: 1,
    owner: 'acme/ada',
    expert: { rate: '150', areas: ['base'], languages: ['en'], timezone: 'America/Los_Angeles', availability: 'Weekends', verified: false, skills: ['Go'], links: ['https://github.com/ada'], ...profile },
    ...over,
  }
  w.listings.push(mine)
  w.shop.push(expert('lst_own', { publisherOrg: 'acme', title: mine.title, description: mine.description }, mine.expert))
}

test('Refresh from GitHub shows the changes against the listing, and writes nothing until Save', async ({ page }) => {
  const w = paid()
  own(w)
  await mock(page, w)
  await github(page)
  await linked(page, [{ provider: 'github', subject: '424242' }])
  await member(page, '/experts/lst_own')
  await expect(page.getByRole('heading', { name: 'Ada L', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Refresh from GitHub' }).click()
  const diff = page.locator('[data-refresh]')
  await expect(diff.locator('[data-change="title"]')).toContainText('Ada L')
  await expect(diff.locator('[data-change="title"]')).toContainText('Ada Lovelace')
  await expect(diff.locator('[data-change="description"]')).toContainText('Analytical engines and Base apps.')
  await expect(diff.locator('[data-change="skills"]')).toContainText('Go, TypeScript, base')
  await expect(diff.locator('[data-change="areas"]')).toContainText('Build with Base, Commerce')
  await expect(diff.locator('[data-change="links"]')).toContainText('https://ada.dev/')
  expect(w.calls.filter((c) => c.startsWith('PATCH'))).toEqual([])

  const patched = page.waitForRequest((r) => r.method() === 'PATCH')
  await diff.getByRole('button', { name: 'Save' }).click()
  const body = (await patched).postDataJSON()
  expect(body).toMatchObject({
    title: 'Ada Lovelace',
    description: 'Analytical engines and Base apps.',
    price: '0',
    recipient: 'wal_acme',
    expert: {
      rate: '150',
      areas: ['base', 'commerce'],
      languages: ['en'],
      // The zone and the week the person chose are theirs: a refresh does not touch them.
      timezone: 'America/Los_Angeles',
      availability: 'Weekends',
      skills: ['Go', 'TypeScript', 'base'],
      links: ['https://github.com/ada', 'https://ada.dev/', 'https://github.com/ada/engine'],
    },
  })
  await expect(page.getByRole('heading', { name: 'Ada Lovelace', level: 1 })).toBeVisible()
})

test('Cancel leaves the listing as it was, and a record with nothing new says so', async ({ page }) => {
  const w = paid()
  own(w, { title: 'Ada Lovelace', description: 'Analytical engines and Base apps.' }, { areas: ['base', 'commerce'], skills: ['Go', 'TypeScript', 'base'], links: ['https://github.com/ada', 'https://ada.dev/', 'https://github.com/ada/engine'] })
  await mock(page, w)
  await github(page)
  await linked(page, [{ provider: 'github', subject: '424242' }])
  await member(page, '/experts/lst_own')
  await page.getByRole('button', { name: 'Refresh from GitHub' }).click()
  await expect(page.getByText('Nothing has changed.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('[data-refresh] [data-change]')).toHaveCount(0)
  expect(w.calls.filter((c) => c.startsWith('PATCH'))).toEqual([])
})

test('Refresh is on the expert’s own page only, and with no GitHub linked it connects one', async ({ page }) => {
  const w = paid()
  own(w)
  w.shop.push(expert('lst_other', { title: 'Grace Hopper' }))
  await mock(page, w)
  await linked(page, [])
  const asked: unknown[] = []
  await page.route(/\/v1\/iam\/link$/, (route) => {
    asked.push(route.request().postDataJSON())
    return json(route, { status: 'ok', data: `${new URL(page.url()).origin}/auth/callback?linked=provider-github` })
  })
  await member(page, '/experts/lst_other')
  await expect(page.getByRole('heading', { name: 'Grace Hopper', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refresh from GitHub' })).toHaveCount(0)

  await page.goto('/experts/lst_own')
  await page.getByRole('button', { name: 'Refresh from GitHub' }).click()
  await expect.poll(() => asked.length).toBe(1)
  await expect(page).toHaveURL(/\/experts\/lst_own$/)
})

// ── the fit ──────────────────────────────────────────────────────────────────

for (const width of [375, 768, 1440]) {
  test(`the card, the directory and an expert page do not overflow at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const w = paid()
    own(w)
    w.shop.push(expert('lst_ada', {}, { reward: { level: 2, levelName: 'Shipper', points: 640, tier: { id: 'billionaire', label: '1B+' }, badges: [{ id: 'a', name: 'Billionaire', pillar: 'use', rarity: 'rare' }, { id: 'b', name: 'Documentarian', pillar: 'contribute', rarity: 'common' }, { id: 'c', name: 'Five Jobs Delivered', pillar: 'expert', rarity: 'uncommon' }], pillars: { use: 3, share: 0, community: 1, contribute: 12, expert: 2 } }, products: [{ product: 'base', score: 184.5, parts: { usage: 40, contributions: 100, jobs: 44.5 } }, { product: 'kai', score: 20, parts: { badges: 20 } }], top: ['base'] }))
    await mock(page, w)
    await github(page)
    await linked(page, [{ provider: 'github', subject: '424242' }])
    await program(page, { handle: 'ada', public: true, links: {} })
    const fits = async (path: string) => {
      await page.goto(path)
      await expect(page.locator('main h1').first()).toBeVisible()
      await page.waitForLoadState('networkidle')
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0)
    }
    await page.goto('/experts/join')
    await signIn(page, '/experts/join')
    await expect(page.getByRole('textbox', { name: 'Name or headline' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    await fits('/experts')
    await fits('/experts/lst_ada')
  })
}
