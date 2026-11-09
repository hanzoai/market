import { expect, test, type Page, type Route } from '@playwright/test'

import { expert, mock, world, type World } from './mock'

// The Experts directory: ordered and narrowed by the shop, in the address; a
// card that shows a person's proven record when they made it public, and only
// their listing when they did not or the program is down.

const cors = { 'access-control-allow-origin': '*' }
const none = { rating: null, reviews: 0, installs: 0, jobs: { completed: 0, disputed: 0 } }

const standing = (over: Record<string, unknown> = {}) => ({
  level: 2,
  levelName: 'Shipper',
  points: 1280,
  tier: { id: 'billionaire', label: '1B+' },
  badges: [
    { id: 'billionaire', name: 'Billionaire', pillar: 'use', rarity: 'rare' },
    { id: 'five-jobs-delivered', name: 'Five Jobs Delivered', pillar: 'expert', rarity: 'uncommon' },
    { id: 'documentarian', name: 'Documentarian', pillar: 'contribute', rarity: 'common' },
  ],
  pillars: { use: 3, share: 0, community: 1, contribute: 12, expert: 2 },
  ...over,
})

/** A public one with a record and strengths; a private one, which the shop says nothing of; and one with no reviews. */
const ada = expert(
  'lst_ada',
  { reputation: { rating: 4.8, reviews: 23, installs: 0, jobs: { completed: 57, disputed: 1 } } },
  {
    reward: standing(),
    products: [
      { product: 'base', score: 184.5, parts: { usage: 40, badges: 20, contributions: 100, jobs: 24.5 } },
      { product: 'kai', score: 20, parts: { badges: 20 } },
    ],
    top: ['base'],
  },
)
const grace = expert('lst_grace', { title: 'Grace Hopper', price: '500', reputation: none }, { rate: '0', areas: ['freelance', 'agents'], languages: ['en'], verified: false })
const lin = expert('lst_lin', { title: 'Lin Wei', reputation: { rating: 3.9, reviews: 4, installs: 0, jobs: { completed: 1, disputed: 0 } } }, { rate: '95.50', areas: ['bot'], languages: ['zh-cn', 'en'], verified: false })

function crowd(): World {
  const w = world()
  w.shop.push(ada, grace, lin)
  return w
}

/** The shop as the platform orders it: the order named by `sort` is the order of rows, across pages. Every request is kept. */
async function ordered(page: Page, by: Record<string, string[]>) {
  const asked: URL[] = []
  await page.route(/\/v1\/marketplace\/shop(\?|$)/, (route: Route) => {
    const url = new URL(route.request().url())
    asked.push(url)
    const rows = [ada, grace, lin]
    const order = by[url.searchParams.get('sort') ?? url.searchParams.get('product') ?? ''] ?? rows.map((r) => String(r.id))
    const listings = order.map((id) => rows.find((r) => r.id === id)!)
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ listings, total: listings.length, facets: { kind: {}, category: {}, price: {}, rating: {} } }) })
  })
  return asked
}

const titles = (page: Page) => page.locator('[data-item^="listing:"] h3')

test('a card shows level, token tier and badges with their rarity for a public profile, and nothing more for the rest', async ({ page }) => {
  await mock(page, crowd())
  await page.goto('/experts')
  const a = page.locator('[data-item="listing:lst_ada"]')
  await expect(a.locator('[data-standing]')).toContainText('L2 Shipper')
  await expect(a.locator('[data-standing]')).toContainText('1B+ tokens')
  await expect(a.locator('[data-standing] [data-mark]')).toContainText(['L2 Shipper', '1B+ tokens', 'Billionaire · rare', 'Five Jobs Delivered · uncommon', 'Documentarian · common'])
  // Never a raw token count.
  await expect(a).not.toContainText(/\d{1,3}(,\d{3})+ tokens/)
  await expect(a.locator('[data-rating]')).toContainText('4.8')
  await expect(a.locator('[data-jobs]')).toHaveText('57 jobs')
  await expect(a.locator('[data-fees]')).toHaveText('$150.00/hr')

  // A private profile is not in the row, and the card draws no empty box for it.
  const g = page.locator('[data-item="listing:lst_grace"]')
  await expect(g.locator('[data-standing]')).toHaveCount(0)
  await expect(g.locator('[data-strengths]')).toHaveCount(0)
  await expect(g.locator('[data-record]')).toHaveCount(0)
  await expect(g.locator('[data-fees]')).toHaveText('$500.00 fixed')
  await expect(g.locator('[data-rating]')).toHaveText('No reviews yet')
})

test('the program down: the shop answers with listings alone, and the directory is whole', async ({ page }) => {
  const w = world()
  w.shop.push(expert('lst_down', { reputation: { rating: 4.8, reviews: 23, installs: 0, jobs: { completed: 57, disputed: 1 } } }))
  await mock(page, w)
  await page.route(/\/v1\/reward\//, (route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{"status":503,"detail":"down"}' }))
  await page.goto('/experts')
  const c = page.locator('[data-item="listing:lst_down"]')
  await expect(c).toBeVisible()
  await expect(c.locator('[data-standing]')).toHaveCount(0)
  await expect(c.locator('[data-strengths]')).toHaveCount(0)
  await expect(c.locator('[data-fees]')).toHaveText('$150.00/hr')
  await expect(c.locator('[data-rating]')).toContainText('4.8')
})

test('an expert page shows the record: level, points and contributions by pillar that are not none, tier, badges, strengths', async ({ page }) => {
  await mock(page, crowd())
  await page.goto('/experts/lst_ada')
  const record = page.locator('[data-record]')
  await expect(record).toContainText('L2 Shipper')
  await expect(record).toContainText('1B+ tokens')
  await expect(record).toContainText('1,280 points · Use 3 · Community 1 · Contribute 12 · Expert 2')
  await expect(record).not.toContainText('Share')
  await expect(page.locator('[data-strengths]')).toContainText('Top in Base')
  // A product's score says what it is made of on hover.
  await expect(page.locator('[data-strengths] [data-mark][title]').first()).toHaveAttribute('title', 'usage 40 · badges 20 · contributions 100 · jobs 24.5')
  await page.goto('/experts/lst_grace')
  await expect(page.getByRole('heading', { name: 'Grace Hopper', level: 1 })).toBeVisible()
  await expect(page.locator('[data-record], [data-strengths]')).toHaveCount(0)
})

test('a product shows its top three as labels and the expert’s strongest as chips with their parts', async ({ page }) => {
  await mock(page, crowd())
  await page.goto('/experts')
  const a = page.locator('[data-item="listing:lst_ada"] [data-strengths]')
  await expect(a.locator('[data-mark]')).toHaveText(['Top in Base', 'Base 185', 'Kai 20'])
  await expect(a.locator('[data-mark]').nth(1)).toHaveAttribute('title', 'usage 40 · badges 20 · contributions 100 · jobs 24.5')
  await expect(a.locator('[data-mark]').nth(2)).toHaveAttribute('title', 'badges 20')
})

test('the sort menu and every filter ask the shop and are kept in the address, so a view can be passed along', async ({ page }) => {
  await mock(page, crowd())
  const asked = await ordered(page, { level: ['lst_ada', 'lst_lin', 'lst_grace'], rate: ['lst_lin', 'lst_ada', 'lst_grace'], base: ['lst_ada', 'lst_lin', 'lst_grace'] })
  const last = () => asked.at(-1)!.searchParams
  await page.goto('/experts')
  await expect(titles(page)).toHaveText(['Ada Lovelace', 'Grace Hopper', 'Lin Wei'])

  await page.getByRole('combobox', { name: 'Sort' }).selectOption('level')
  await expect(titles(page)).toHaveText(['Ada Lovelace', 'Lin Wei', 'Grace Hopper'])
  await expect(page).toHaveURL(/[?&]sort=level/)
  await expect.poll(() => last().get('sort')).toBe('level')
  expect(last().get('dir')).toBe('desc')

  await page.getByRole('button', { name: 'Direction' }).click()
  await expect(page).toHaveURL(/dir=asc/)
  await expect.poll(() => last().get('dir')).toBe('asc')

  await page.getByRole('combobox', { name: 'Language' }).selectOption('es')
  await page.getByRole('combobox', { name: 'Level' }).selectOption('2')
  await page.getByRole('combobox', { name: 'Token tier' }).selectOption('1b')
  await page.getByRole('combobox', { name: 'Badge' }).selectOption('five-jobs-delivered')
  await page.getByRole('textbox', { name: 'Lowest rate (USD/hr)' }).fill('50')
  await page.getByRole('textbox', { name: 'Highest rate (USD/hr)' }).fill('200.5')
  await page.getByRole('button', { name: 'Verified' }).click()
  await page.getByRole('group', { name: 'Area' }).getByRole('button', { name: 'Build with Base', exact: true }).click()
  const all = { kind: 'expert', sort: 'level', dir: 'asc', language: 'es', minLevel: '2', tokenTier: '1b', badge: 'five-jobs-delivered', rateMin: '50', rateMax: '200.5', verified: 'true', area: 'base', limit: '200', offset: '0' }
  await expect.poll(() => Object.fromEntries(last())).toMatchObject(all)
  const q = Object.fromEntries(last())
  const here = new URL(page.url()).searchParams
  for (const k of ['sort', 'dir', 'language', 'minLevel', 'tokenTier', 'badge', 'rateMin', 'rateMax', 'verified', 'area']) expect(here.get(k), k).toBe(q[k])

  // The address alone is the view: another browser opens it and asks the same.
  const shared = page.url()
  const other = await page.context().newPage()
  await mock(other, crowd())
  const askedThere = await ordered(other, {})
  await other.goto(shared)
  await expect.poll(() => askedThere.length).toBeGreaterThan(0)
  expect(Object.fromEntries(askedThere.at(-1)!.searchParams)).toMatchObject({ sort: 'level', dir: 'asc', language: 'es', minLevel: '2', tokenTier: '1b', badge: 'five-jobs-delivered', rateMin: '50', rateMax: '200.5', verified: 'true', area: 'base' })
  await expect(other.getByRole('combobox', { name: 'Sort' })).toHaveValue('level')
  await expect(other.getByRole('combobox', { name: 'Token tier' })).toHaveValue('1b')
  await expect(other.getByRole('button', { name: 'Verified' })).toHaveAttribute('aria-pressed', 'true')
  await other.close()
})

test('a product ranks by its own score: choosing one asks for it and leaves the other orders; clearing every filter empties the address', async ({ page }) => {
  await mock(page, crowd())
  const asked = await ordered(page, { base: ['lst_ada', 'lst_lin', 'lst_grace'] })
  await page.goto('/experts?sort=rate')
  await expect(page.getByRole('combobox', { name: 'Sort' })).toHaveValue('rate')
  const products = page.getByRole('group', { name: 'Product' })
  await expect(products.getByRole('button')).toHaveText(['Any product', 'Dev', 'Bot', 'Team', 'Base', 'Commerce', 'Cloud', 'Agents', 'Kai', 'Enso', 'Zen', 'Creative AI'])
  await products.getByRole('button', { name: 'Base', exact: true }).click()
  await expect(page).toHaveURL(/product=base/)
  await expect(page).not.toHaveURL(/sort=/)
  await expect(titles(page)).toHaveText(['Ada Lovelace', 'Lin Wei', 'Grace Hopper'])
  expect(asked.at(-1)!.searchParams.get('product')).toBe('base')
  expect(asked.at(-1)!.searchParams.get('sort')).toBeNull()
  await products.getByRole('button', { name: 'Any product' }).click()
  await expect(page).toHaveURL(/\/experts$/)
})

test('what the address says that this list does not know is not asked', async ({ page }) => {
  await mock(page, crowd())
  const asked = await ordered(page, {})
  await page.goto('/experts?sort=luck&dir=sideways&language=xx&minLevel=9&tokenTier=2m&rateMin=lots&product=web3&verified=maybe')
  await expect(cards(page)).toHaveCount(3)
  expect(Object.fromEntries(asked.at(-1)!.searchParams)).toEqual({ kind: 'expert', limit: '200', offset: '0' })
})

const cards = (page: Page) => page.locator('[data-item^="listing:"]')

test('with nothing matching it says so', async ({ page }) => {
  await mock(page, crowd())
  await page.route(/\/v1\/marketplace\/shop(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ listings: [], total: 0, facets: { kind: {}, category: {}, price: {}, rating: {} } }) }))
  await page.goto('/experts?minLevel=4')
  await expect(page.getByText('No experts match.')).toBeVisible()
})

for (const width of [375, 768, 1440]) {
  test(`the directory with its controls and rich cards does not overflow at ${width}, and the controls fit the screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mock(page, crowd())
    await page.goto('/experts?sort=level&verified=true&tokenTier=1b&language=es&minLevel=2&product=base')
    await expect(cards(page).first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    const bad = await page.evaluate(() => [...document.querySelectorAll('[data-item] , [role="group"]')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).length)
    expect(bad).toBe(0)
  })
}
