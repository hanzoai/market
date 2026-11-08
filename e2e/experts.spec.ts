import { expect, test, type Page } from '@playwright/test'

import { signIn } from './flow'
import { expert, mock, wallet, world, type World } from './mock'

const none = { rating: null, reviews: 0, installs: 0, jobs: { completed: 0, disputed: 0 } }

/** Three people: a verified, reviewed hourly one; a fixed-price freelancer nobody has reviewed; a bot builder. */
const ada = expert('lst_ada', { reputation: { rating: 4.8, reviews: 23, installs: 0, jobs: { completed: 57, disputed: 1 } } })
const grace = expert(
  'lst_grace',
  { title: 'Grace Hopper', description: 'Freelance agents for partners.\nShips weekly.', price: '500', reputation: none },
  { rate: '0', areas: ['freelance', 'agents'], languages: ['en'], timezone: 'America/New_York', availability: 'Evenings ET', verified: false },
)
const lin = expert('lst_lin', { title: 'Lin Wei', reputation: none }, { rate: '95.50', areas: ['bot', 'cloud', 'models', 'creative'], languages: ['zh-cn', 'en'], timezone: 'Asia/Shanghai', availability: '', verified: false })

function crowd(): World {
  const w = world()
  w.shop.push(ada, grace, lin)
  return w
}

const cards = (page: Page) => page.locator('[data-item^="listing:"]')

test('the Experts category lists every expert: verified mark, rating, areas, rate and price, availability', async ({ page }) => {
  const w = crowd()
  await mock(page, w)
  await page.goto('/experts')
  await expect(page.getByRole('heading', { name: 'Experts', level: 1 })).toBeVisible()
  await expect(cards(page)).toHaveCount(3)

  const a = page.locator('[data-item="listing:lst_ada"]')
  await expect(a).toContainText('Ada Lovelace')
  await expect(a.locator('[data-verified]')).toHaveText('Verified')
  await expect(a.locator('[data-rating]')).toContainText('4.8')
  await expect(a.locator('[data-rating]')).toContainText('(23)')
  await expect(a.locator('[data-area]')).toHaveText(['Build with Base', 'Cloud'])
  await expect(a.locator('[data-fees]')).toHaveText('$150.00/hr')
  await expect(a).toContainText('Weekdays 9-17 PT')
  await expect(a).toHaveAttribute('href', '/experts/lst_ada')

  const g = page.locator('[data-item="listing:lst_grace"]')
  await expect(g.locator('[data-verified]')).toHaveCount(0)
  await expect(g.locator('[data-rating]')).toHaveText('No reviews yet')
  await expect(g.locator('[data-fees]')).toHaveText('$500.00 fixed')

  // Four areas read as three and the number left; rate and price together read as both.
  const l = page.locator('[data-item="listing:lst_lin"]')
  await expect(l.locator('[data-area]')).toHaveText(['Bot', 'Cloud', 'Kai, Enso, Zen', '+1'])
  await expect(l.locator('[data-fees]')).toHaveText('$95.50/hr')

  // The category asks the shop for experts only, from the start, 200 at a time.
  expect(w.calls).toContain('GET /v1/marketplace/shop?kind=expert&limit=200&offset=0')
})

test('the area chips are the closed list and filter on the server; search narrows within an area', async ({ page }) => {
  const w = crowd()
  await mock(page, w)
  await page.goto('/experts')
  const chips = page.getByRole('group', { name: 'Area' }).getByRole('button')
  await expect(chips).toHaveText(['All', 'Configure Hanzo', 'Build with Base', 'Commerce', 'Bot', 'Agents', 'Cloud', 'Kai, Enso, Zen', 'Creative AI', 'Freelance'])

  await chips.filter({ hasText: /^Cloud$/ }).click()
  await expect(page).toHaveURL(/\/experts\?area=cloud$/)
  await expect(cards(page)).toHaveCount(2)
  await expect(page.locator('[data-item="listing:lst_grace"]')).toHaveCount(0)
  expect(w.calls).toContain('GET /v1/marketplace/shop?kind=expert&area=cloud&limit=200&offset=0')

  await page.getByRole('searchbox', { name: 'Search experts' }).fill('wei')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page).toHaveURL(/\/experts\?area=cloud&q=wei$/)
  await expect(cards(page)).toHaveCount(1)
  await expect(page.locator('[data-item="listing:lst_lin"]')).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search experts' }).fill('nobody')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByText('No experts match.')).toBeVisible()

  // An area outside the list is not asked of the server.
  await page.goto('/experts?area=web3')
  await expect(cards(page)).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('every expert is listed: the shop is read 200 at a time until its total', async ({ page }) => {
  const w = world()
  for (let i = 0; i < 230; i++) w.shop.push(expert(`lst_p${i}`, { title: `Person ${i}` }))
  await mock(page, w)
  await page.goto('/experts')
  await expect(cards(page)).toHaveCount(230)
  await expect(page.locator('[data-item="listing:lst_p229"]')).toBeVisible()
  // The dev server mounts every effect twice, so a read may be asked twice: each page is asked from where the last left off.
  const asked = w.calls.filter((c) => c.startsWith('GET /v1/marketplace/shop?')).map((c) => new URL(c.slice(4), 'http://x').searchParams.get('offset'))
  expect([...new Set(asked)]).toEqual(['0', '200'])
})

test('Experts is in the shop window and its home mix: the nav, the type chips, and the expert card', async ({ page }) => {
  await mock(page, crowd())
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Hanzo Market navigation' }).getByRole('link', { name: 'Experts' })).toHaveAttribute('href', '/experts')
  await expect(page.getByRole('button', { name: 'Experts 3' })).toBeVisible()
  // In the mixed catalog an expert is the expert card, not a generic one.
  await expect(page.locator('[data-item="listing:lst_ada"] [data-verified]')).toBeVisible()
  await expect(page.locator('[data-item="listing:lst_ada"]')).toHaveAttribute('href', '/experts/lst_ada')
  await page.getByRole('button', { name: 'Experts 3' }).click()
  await expect(page).toHaveURL(/\/experts$/)
  await expect(page.getByRole('heading', { name: 'Experts', level: 1 })).toBeVisible()
})

test('an expert page: name, mark, areas, rate, languages, zone, availability, description, rating; /l/:id is the same page', async ({ page }) => {
  await mock(page, crowd())
  await page.goto('/experts/lst_ada')
  await expect(page.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible()
  await expect(page.locator('[data-verified]')).toHaveText('Verified')
  await expect(page.locator('[data-area]')).toHaveText(['Build with Base', 'Cloud'])
  await expect(page.locator('[data-freelance]')).toHaveCount(0)
  await expect(page.locator('[data-fees]')).toHaveText('$150.00/hr')
  await expect(page.getByText('English, Spanish')).toBeVisible()
  await expect(page.getByText('America/Los_Angeles')).toBeVisible()
  await expect(page.getByText('Weekdays 9-17 PT')).toBeVisible()
  await expect(page.locator('[data-body]')).toHaveText('Builds on Base and ships it to Cloud.')
  const rep = page.locator('[data-reputation]')
  await expect(rep).toContainText('4.8')
  await expect(rep).toContainText('23 reviews')

  await page.goto('/l/lst_ada')
  await expect(page.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible()
  await expect(page.locator('[data-fees]')).toHaveText('$150.00/hr')
  await expect(page.getByRole('button', { name: 'Book' })).toBeVisible()

  // Freelance says what it means; a fixed price and no review read as they are.
  await page.goto('/experts/lst_grace')
  await expect(page.locator('[data-freelance]')).toHaveText('Freelance work for partners and companies building on Hanzo Cloud and the Hanzo OSS ecosystem')
  await expect(page.locator('[data-fees]')).toHaveText('$500.00 fixed')
  await expect(page.locator('[data-verified]')).toHaveCount(0)
  await expect(page.locator('[data-reputation]')).toContainText('0 reviews')
})

test('Book starts the hire at the expert: signed out it asks who you are, then the amount opens at the hourly rate', async ({ page }) => {
  await mock(page, crowd())
  await page.goto('/experts/lst_ada')
  await page.getByRole('button', { name: 'Book' }).click()
  await expect(page).toHaveURL(/\/checkout\/lst_ada$/)
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await signIn(page, '/checkout/lst_ada')
  await expect(page.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible()
  // One hour of the rate, editable.
  const amount = page.getByRole('textbox', { name: 'Amount (USD)' })
  await expect(amount).toHaveValue('150.00')
  await amount.fill('300.00')
  await expect(amount).toHaveValue('300.00')
  await expect(page.getByRole('button', { name: 'Check clearance' })).toBeEnabled()
})

test('a fixed price opens the hire at that price, ahead of the rate', async ({ page }) => {
  const w = crowd()
  w.shop.push(expert('lst_both', { title: 'Both Ways', price: '800' }))
  await mock(page, w)
  await page.goto('/checkout/lst_both')
  await signIn(page, '/checkout/lst_both')
  await expect(page.getByRole('textbox', { name: 'Amount (USD)' })).toHaveValue('800.00')
  await page.goto('/checkout/lst_grace')
  await expect(page.getByRole('textbox', { name: 'Amount (USD)' })).toHaveValue('500.00')
})

test('/experts/join signed out goes through /login and comes back to the form', async ({ page }) => {
  await mock(page, world())
  const visited: string[] = []
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) visited.push(new URL(f.url()).pathname)
  })
  await page.goto('/experts/join')
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await signIn(page, '/experts/join')
  expect(visited).toContain('/login')
  await expect(page.getByRole('heading', { name: 'Become an expert', level: 1 })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name or headline' })).toHaveValue('')
})

/** Fill the form as Ada: Base and Cloud, English and Spanish, Los Angeles, $150 an hour. */
async function describe(page: Page) {
  await page.getByRole('textbox', { name: 'Name or headline' }).fill('Ada Lovelace')
  await page.getByRole('textbox', { name: 'Description' }).fill('Builds on Base.')
  const areas = page.getByRole('group', { name: 'Areas' })
  await areas.getByRole('button', { name: 'Build with Base', exact: true }).click()
  await areas.getByRole('button', { name: 'Cloud', exact: true }).click()
  const languages = page.getByRole('group', { name: 'Languages' })
  await languages.getByRole('button', { name: 'English', exact: true }).click()
  await languages.getByRole('button', { name: 'Spanish', exact: true }).click()
  await page.getByRole('combobox', { name: 'Time zone' }).selectOption('America/Los_Angeles')
  await page.getByRole('textbox', { name: 'Availability' }).fill('Weekdays 9-17 PT')
  await page.getByRole('textbox', { name: 'Hourly rate (USD)' }).fill('150')
}

test('signed in, the form says what is missing, then sends exactly one create and lands on the new expert page', async ({ page }) => {
  const w = world()
  wallet(w)
  await mock(page, w)
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')

  const publish = page.getByRole('button', { name: 'Publish' })
  await expect(publish).toBeDisabled()
  await expect(page.locator('[data-blocked]')).toHaveText('Add your name or a headline.')
  // The freelance area says what it is.
  await expect(page.getByText('Freelance work for partners and companies building on Hanzo Cloud and the Hanzo OSS ecosystem')).toBeVisible()
  await page.getByRole('textbox', { name: 'Name or headline' }).fill('Ada Lovelace')
  await expect(page.locator('[data-blocked]')).toHaveText('Pick at least one area.')

  await describe(page)
  await expect(page.getByRole('combobox', { name: 'Paid into' })).toHaveValue('wal_acme')
  await expect(page.locator('[data-blocked]')).toHaveCount(0)
  await expect(publish).toBeEnabled()

  const sent = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/v1/marketplace/listings')
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/v1/marketplace/listings')
  await publish.click()
  // The platform says the new listing is the caller's own.
  expect(((await (await created).json()) as { expert: { self?: boolean } }).expert.self).toBe(true)
  expect((await sent).postDataJSON()).toEqual({
    kind: 'expert',
    title: 'Ada Lovelace',
    description: 'Builds on Base.',
    price: '0',
    recipient: 'wal_acme',
    public: true,
    expert: { rate: '150', areas: ['base', 'cloud'], languages: ['en', 'es'], timezone: 'America/Los_Angeles', availability: 'Weekdays 9-17 PT' },
  })
  await expect(page).toHaveURL(/\/experts\/lst_1$/)
  await expect(page.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible()
  await expect(page.locator('[data-fees]')).toHaveText('$150.00/hr')
  await expect(page.locator('[data-verified]')).toHaveCount(0)
  expect(w.listings).toHaveLength(1)

  // The category lists them now.
  await page.goto('/experts')
  await expect(page.locator('[data-item="listing:lst_1"]')).toBeVisible()
})

test('a paid listing without a payout wallet says so and is not sent', async ({ page }) => {
  const w = world()
  await mock(page, w)
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await describe(page)
  await expect(page.getByText('A priced listing needs a payout wallet.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/sell')
  await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled()
  await expect(page.locator('[data-blocked]')).toHaveText('A paid listing needs a payout wallet.')
  expect(w.calls.filter((c) => c.startsWith('POST /v1/marketplace/listings'))).toEqual([])
})

test('a member with an expert listing edits it: the whole profile is patched, never created again', async ({ page }) => {
  const w = world()
  wallet(w)
  const mine = {
    id: 'lst_own',
    publisherOrg: 'acme',
    kind: 'expert',
    tool: '',
    ref: '',
    title: 'Ada Lovelace',
    description: 'Builds on Base.',
    category: '',
    price: '500',
    currency: 'USD',
    recipient: 'wal_acme',
    public: true,
    createdAt: 1,
    updatedAt: 1,
    owner: 'acme/ada',
    expert: { rate: '150', areas: ['base'], languages: ['en'], timezone: 'America/Los_Angeles', availability: 'Weekdays 9-17 PT', verified: true },
  }
  w.listings.push(mine)
  w.shop.push(expert('lst_own', { publisherOrg: 'acme', price: '500' }, { areas: ['base'], languages: ['en'] }))
  await mock(page, w)
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')

  await expect(page.getByRole('heading', { name: 'Your expert listing', level: 1 })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name or headline' })).toHaveValue('Ada Lovelace')
  await expect(page.getByRole('textbox', { name: 'Hourly rate (USD)' })).toHaveValue('150')
  await expect(page.getByRole('textbox', { name: 'Fixed price (USD)' })).toHaveValue('500')
  await expect(page.getByRole('group', { name: 'Areas' }).getByRole('button', { name: 'Build with Base', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('group', { name: 'Areas' }).getByRole('button', { name: 'Cloud', exact: true })).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('group', { name: 'Areas' }).getByRole('button', { name: 'Cloud', exact: true }).click()
  await page.getByRole('textbox', { name: 'Availability' }).fill('Mornings PT')
  const sent = page.waitForRequest((r) => r.method() === 'PATCH')
  const patched = page.waitForResponse((r) => r.request().method() === 'PATCH')
  await page.getByRole('button', { name: 'Save' }).click()
  const req = await sent
  expect(((await (await patched).json()) as { expert: { self?: boolean } }).expert.self).toBe(true)
  expect(new URL(req.url()).pathname).toBe('/v1/marketplace/listings/lst_own')
  expect(req.postDataJSON()).toEqual({
    title: 'Ada Lovelace',
    description: 'Builds on Base.',
    price: '500',
    recipient: 'wal_acme',
    public: true,
    expert: { rate: '150', areas: ['base', 'cloud'], languages: ['en'], timezone: 'America/Los_Angeles', availability: 'Mornings PT' },
  })
  await expect(page).toHaveURL(/\/experts\/lst_own$/)
  await expect(page.getByText('Mornings PT')).toBeVisible()
  // Verified is the staff's: saving did not take it.
  expect((w.listings[0].expert as Record<string, unknown>).verified).toBe(true)
  expect(w.calls.filter((c) => c.startsWith('POST /v1/marketplace/listings'))).toEqual([])
})

test('a colleague’s expert listing in the same org does not turn the form into an edit form', async ({ page }) => {
  const w = world()
  wallet(w)
  w.listings.push({
    id: 'lst_grace',
    publisherOrg: 'acme',
    kind: 'expert',
    tool: '',
    ref: '',
    title: 'Grace Hopper',
    description: '',
    category: '',
    price: '500',
    currency: 'USD',
    recipient: 'wal_acme',
    public: true,
    createdAt: 1,
    updatedAt: 1,
    owner: 'acme/grace',
    expert: { rate: '0', areas: ['agents'], languages: ['en'], timezone: 'America/New_York', availability: '', verified: false },
  })
  await mock(page, w)
  const read = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/v1/marketplace/listings')
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  // The org's listings include the colleague's, and the platform does not mark it the caller's.
  const rows = ((await (await read).json()) as { listings: { expert: { self?: boolean } }[] }).listings
  expect(rows).toHaveLength(1)
  expect(rows[0].expert.self).toBeUndefined()

  await expect(page.getByRole('heading', { name: 'Become an expert', level: 1 })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name or headline' })).toHaveValue('')
  await describe(page)
  await page.getByRole('button', { name: 'Publish' }).click()
  // A create, not a patch of the colleague's listing: it is the caller's own now, and the colleague's is untouched.
  await expect(page).toHaveURL(/\/experts\/lst_2$/)
  expect(w.calls.filter((c) => c.startsWith('PATCH'))).toEqual([])
  expect(w.listings.map((l) => l.title)).toEqual(['Ada Lovelace', 'Grace Hopper'])
})

test('a second create is refused with the platform’s words and a way to the listing that exists', async ({ page }) => {
  const w = world()
  wallet(w)
  await mock(page, w)
  // The refusal arrives for a listing this page did not know of: it exists by the time the form asks again.
  await page.route(/\/v1\/marketplace\/listings$/, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    w.listings.push({
      id: 'lst_old',
      publisherOrg: 'acme',
      kind: 'expert',
      tool: '',
      ref: '',
      title: 'Ada Lovelace',
      description: '',
      category: '',
      price: '0',
      currency: 'USD',
      recipient: 'wal_acme',
      public: true,
      createdAt: 1,
      updatedAt: 1,
      owner: 'acme/ada',
      expert: { rate: '150', areas: ['bot'], languages: ['en'], timezone: 'UTC', availability: '', verified: false },
    })
    return route.fulfill({ status: 409, contentType: 'application/problem+json', body: JSON.stringify({ status: 409, detail: 'You already have an expert listing.' }) })
  })
  await page.goto('/experts/join')
  await signIn(page, '/experts/join')
  await describe(page)
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByRole('alert')).toHaveText('You already have an expert listing.')
  await page.getByRole('button', { name: 'Edit your expert listing' }).click()
  await expect(page.getByRole('heading', { name: 'Your expert listing', level: 1 })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Areas' }).getByRole('button', { name: 'Bot', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
