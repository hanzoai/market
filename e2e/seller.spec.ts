import { expect, test, type Route } from '@playwright/test'

import { signIn, twoOrgs } from './flow'
import { mock, NOW, wallet, world } from './mock'

const job = (id: string, over: Record<string, unknown>) => ({
  id,
  listing: 'lst_1',
  buyerOrg: 'globex',
  sellerOrg: 'acme',
  currency: 'USD',
  category: 'service',
  review: 259_200,
  clearance: 'clr_1',
  escrow: { rail: 'x402', network: 'eip155:36963', contract: '0xusdc' },
  createdAt: NOW - 600,
  updatedAt: NOW - 300,
  ...over,
})

test('seller onboarding → payout wallet → create listing → deliver a job → earnings', async ({ page }) => {
  const w = world({
    jobs: [
      job('job_7', {
        title: 'Triage the support inbox',
        amount: '40.00',
        status: 'accepted',
        brief: 'Label and route every open ticket.',
        history: [
          { status: 'quoted', at: NOW - 700, by: 'globex' },
          { status: 'open', at: NOW - 600, by: 'globex' },
          { status: 'accepted', at: NOW - 300, by: 'acme' },
        ],
      }),
      job('job_3', { title: 'Earlier triage', buyerOrg: 'initech', amount: '120.00', status: 'released', brief: 'Done before.', history: [] }),
    ],
  })
  await mock(page, w)

  // Onboarding: sign in with hanzo.id; the org is the principal.
  await page.goto('/sell')
  await signIn(page, '/sell')
  await expect(page.getByRole('heading', { name: 'Set up your organization' })).toBeVisible()
  await expect(page.locator('[data-org]')).toHaveText('Acting as acme')

  await expect(page.locator('[data-owed]')).toContainText('No founder has started identity verification.')
  await page.getByRole('button', { name: 'Verify your organization' }).click()
  await expect(page.locator('[data-verify]')).toContainText('ada@acme.test')
  await expect(page.getByRole('link', { name: 'Open verification' })).toHaveAttribute('href', 'https://verify.invalid/ada')
  await expect(page.getByText('Status: pending')).toBeVisible()

  await page.getByRole('textbox', { name: 'Legal name (as on your tax return)' }).fill('Acme Corporation')
  await page.getByRole('textbox', { name: 'Address' }).fill('1 Market St')
  await page.getByRole('textbox', { name: 'City' }).fill('San Francisco')
  await page.getByRole('textbox', { name: 'State (2 letters)' }).fill('CA')
  await page.getByRole('textbox', { name: 'ZIP' }).fill('94105')
  await page.getByLabel('EIN').fill('12-3456789')
  await page.getByRole('button', { name: 'Save tax form' }).click()
  await expect(page.getByText('W-9 · none')).toBeVisible()
  expect(w.tax).toMatchObject({ form: 'w9', address: { state: 'CA', zip: '94105', country: 'US' }, tinType: 'ein' })
  await page.getByRole('button', { name: 'Sign and certify' }).click()
  await expect(page.getByText('W-9 · certified · valid')).toBeVisible()

  // A payout wallet: created, then proved by its own signature over cloud's challenge.
  await page.getByRole('button', { name: 'Create a payout wallet' }).click()
  await expect(page.locator('[data-wallet]')).toContainText('Payouts · eip155:36963')
  await expect(page.getByRole('button', { name: 'Create a payout wallet' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Use Payouts for payouts' }).click()
  await expect(page.getByText('Payouts go here')).toBeVisible()
  await expect(page.getByText('Payout wallet: proved')).toBeVisible()
  expect(w.seller?.payout).toMatchObject({ wallet: 'wal_acme', bound: true })

  // A listing, from the org's own agents, sold per job.
  await page.goto('/sell/listings/new')
  await page.getByRole('combobox', { name: 'Which agent' }).selectOption('triage-bot')
  await page.getByRole('textbox', { name: 'Title' }).fill('Inbox Triage Agent')
  await page.getByRole('textbox', { name: 'Description' }).fill('Labels, routes and drafts replies for every ticket.')
  await page.getByRole('textbox', { name: 'Price per job (USD)' }).fill('40')
  await expect(page.getByRole('combobox', { name: 'Paid into' })).toHaveValue('wal_acme')
  await page.getByRole('button', { name: 'Publish listing' }).click()
  await expect(page.getByRole('heading', { name: 'Listing published' })).toBeVisible()
  await expect(page.getByText('$40.00 per job · triage-bot')).toBeVisible()
  expect(w.listings[0]).toMatchObject({ tool: 'triage-bot', kind: 'agent', price: '40', recipient: 'wal_acme', public: true })
  await page.getByRole('button', { name: 'All listings' }).click()
  await expect(page.getByText('Inbox Triage Agent')).toBeVisible()

  // The jobs inbox: deliver the accepted job.
  await page.getByRole('link', { name: 'Jobs', exact: true }).click()
  await expect(page).toHaveURL(/\/sell\/jobs$/)
  await page.getByText('Triage the support inbox').click()
  await expect(page.locator('[data-stage="current"]')).toHaveText('Accepted')
  await page.getByRole('textbox', { name: 'What you delivered' }).fill('Labelled 412 tickets; routing rules attached.')
  await page.getByRole('button', { name: 'Mark delivered' }).click()
  await expect(page.getByText('Delivered — waiting for the buyer to release')).toBeVisible()
  await expect(page.locator('[data-stage="current"]')).toHaveText('Delivered')
  expect(w.jobs[0]).toMatchObject({ status: 'delivered', delivery: { note: 'Labelled 412 tickets; routing rules attached.' } })

  // Earnings: the year's gross, x402 per call and for jobs, what is set aside, and the 1099s received.
  await page.goto('/sell/earnings')
  await expect(page.getByText(`Earned in ${new Date().getUTCFullYear()}`)).toBeVisible()
  await expect(page.getByText('$120.005', { exact: true })).toBeVisible()
  await expect(page.getByText('$0.005', { exact: true })).toBeVisible()
  await expect(page.getByText('$120.00', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('$40.00', { exact: true }).first()).toBeVisible()
  await expect(page.locator('[data-pending]')).toHaveCount(0)
  await expect(page.getByText('1099-NEC · Orbital Labs')).toBeVisible()
  await expect(page.getByText('$1,250.00')).toBeVisible()
})

// Red market-3: with the sources 404, the tiles read $0.00 — a number the platform never gave.
test('earnings draw no figure a source did not answer', async ({ page }) => {
  const w = world({ seller: null })
  await mock(page, w)
  const none = (route: Route) =>
    route.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({ status: 404, detail: 'not found' }) })
  await page.route(/\/v1\/x402\/settlements/, none)
  await page.route(/\/v1\/marketplace\/jobs/, none)
  await page.goto('/sell/earnings')
  await signIn(page, '/sell/earnings')
  await expect(page.getByText('Settlement history is not live yet')).toBeVisible()
  await expect(page.locator('[data-pending]').filter({ hasText: 'not live yet' })).toHaveCount(6)
  await expect(page.getByText(/^\$/)).toHaveCount(1) // the 1099 received, and nothing else
  await expect(page.getByText('$1,250.00')).toBeVisible()
})

// Red market-2: switching "Acting as" to an org with no principal and no tax form
// still showed the previous org's verified identity and certified W-9.
test('switching org never shows one org’s standing as another’s', async ({ page }) => {
  const w = world({
    principal: {
      org: 'acme',
      identity: { status: 'verified', reason: '' },
      sanctions: { status: 'clear', reason: '' },
      wallets: [],
      compliance: { ready: true, missing: [] },
      sources: [],
      tax: { form: 'w9', usPerson: true, country: 'US', residence: 'US', certified: true, valid: true },
    },
    tax: {
      form: 'w9',
      name: 'Acme Corporation',
      address: { line1: '1 Market St', city: 'SF', state: 'CA', zip: '94105' },
      tin: '**-***6789',
      certification: { status: 'certified' },
      valid: true,
      version: 1,
      updatedAt: 0,
    },
  })
  await mock(page, w)
  await twoOrgs(page)
  // globex has no principal and no tax form: the platform answers 404 for it.
  const perOrg = (route: Route) =>
    route.request().headers()['x-org-id'] === 'globex'
      ? route.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({ status: 404, detail: 'none for globex' }) })
      : route.fallback()
  await page.route(/\/v1\/principal$/, perOrg)
  await page.route(/\/v1\/tax\/profile$/, perOrg)

  await page.goto('/sell')
  await signIn(page, '/sell')
  await expect(page.getByText('Status: verified')).toBeVisible()
  await expect(page.getByText('W-9 · certified · valid')).toBeVisible()

  await page.getByRole('combobox', { name: 'Acting as' }).selectOption('globex')
  await expect(page.getByText('Principal status is not live yet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save tax form' })).toBeVisible()
  await expect(page.getByText('Status: verified')).toHaveCount(0)
  await expect(page.getByText('W-9 · certified · valid')).toHaveCount(0)
  await expect(page.getByText('Identity: verified')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sign and certify' })).toHaveCount(0)
})

// Red market-16: the verification links opened for one org stayed on screen after
// switching to another (and so did a W-9 draft typed for it).
test('switching org leaves nothing opened or typed for the last org on screen', async ({ page }) => {
  await mock(page, world())
  await twoOrgs(page)
  await page.goto('/sell')
  await signIn(page, '/sell')
  await page.getByRole('button', { name: 'Verify your organization' }).click()
  await expect(page.locator('[data-verify]')).toHaveCount(1)
  const name = page.getByRole('textbox', { name: 'Legal name (as on your tax return)' })
  await name.fill('Acme Corporation')
  await page.getByRole('combobox', { name: 'Acting as' }).selectOption('globex')
  await expect(page.getByRole('combobox', { name: 'Acting as' })).toHaveValue('globex')
  await expect(page.locator('[data-verify]')).toHaveCount(0)
  await expect(name).toHaveValue('')
})

// Red market-13: requests acted as the org in shared storage, not the one the tab
// showed — so after a switch in another tab, this one certified globex's W-9 while
// showing acme's.
test('a tab follows an org chosen in another tab, and acts only as the org it shows', async ({ context }) => {
  const w = world({
    tax: {
      form: 'w9',
      name: 'Acme Corporation',
      address: { line1: '1 Market St', city: 'SF', state: 'CA', zip: '94105' },
      tin: '**-***6789',
      certification: { status: 'none' },
      valid: false,
      version: 1,
      updatedAt: 0,
    },
  })
  const one = await context.newPage()
  await mock(one, w)
  await twoOrgs(one)
  const certified: string[] = []
  await one.route(/\/v1\/tax\/profile\/certify$/, (route) => {
    certified.push(route.request().headers()['x-org-id'] ?? '')
    return route.fallback()
  })
  await one.goto('/sell')
  await signIn(one, '/sell')
  const acting = one.getByRole('combobox', { name: 'Acting as' })
  await expect(acting).toHaveValue('acme')

  const two = await context.newPage()
  await mock(two, w)
  await twoOrgs(two)
  await two.goto('/sell')
  await two.getByRole('combobox', { name: 'Acting as' }).selectOption('globex')

  await one.bringToFront()
  await expect(acting).toHaveValue('globex')
  await one.getByRole('button', { name: 'Sign and certify' }).click()
  await expect.poll(() => certified).toEqual(['globex'])
})

// Red market-15: the payout proof signed whatever digest the challenge carried.
test('the payout proof signs only cloud’s challenge for this wallet and org', async ({ page }) => {
  const w = world()
  wallet(w)
  await mock(page, w)
  await page.route(/\/v1\/marketplace\/seller\/payout$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        wallet: 'wal_acme',
        address: w.wallets[0].address,
        message: 'Hanzo marketplace payout wallet\norg: acme',
        digest: `0x${'ab'.repeat(32)}`,
        expires: NOW + 900,
      }),
    }),
  )
  const signed: string[] = []
  page.on('request', (r) => {
    if (/\/v1\/wallet\/[^/]+\/sign$/.test(new URL(r.url()).pathname)) signed.push(r.url())
  })
  await page.goto('/sell')
  await signIn(page, '/sell')
  await page.getByRole('button', { name: 'Use Treasury for payouts' }).click()
  await expect(page.getByText('The challenge’s digest is not the hash of its message. Nothing was signed.')).toBeVisible()
  expect(signed).toEqual([])
  expect(w.seller?.payout).toMatchObject({ bound: false })
})

// Red market-14: cloud answers the newest 1000 receipts with no total; their sum was
// shown as the year's per-call earnings.
test('a sum over the newest 1000 receipts reads as a floor', async ({ page }) => {
  const w = world()
  await mock(page, w)
  await page.route(/\/v1\/x402\/settlements/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        settlements: Array.from({ length: 1000 }, (_, i) => ({
          id: `x402_${i}`,
          resource: i ? 'tool:geocode' : 'job:job_9',
          payer: 'globex',
          payee: '0xacme',
          payeeOrg: 'acme',
          amount: i ? '0.0025' : '40',
          network: 'eip155:36963',
          settledVia: 'ledger',
          settledAt: NOW,
        })),
      }),
    }),
  )
  await page.goto('/sell/earnings')
  await signIn(page, '/sell/earnings')
  await expect(page.getByText('at least $2.4975', { exact: true })).toBeVisible()
  await expect(page.getByText('at least $40.00', { exact: true })).toBeVisible()
  await expect(page.locator('[data-cut]')).toHaveText('The newest 1,000 payments. The platform lists no more than that, so the figures above from them are floors.')
  await expect(page.getByText('$120.005', { exact: true })).toBeVisible()
})

// A hire is paid on the Hanzo L1: an org whose wallets are all on another chain is
// offered one there, or checkout would send it to a page with no way forward.
test('an org with no wallet on the Hanzo L1 is offered one', async ({ page }) => {
  const w = world()
  wallet(w, 'wal_lux', 'Old', 'lux')
  await mock(page, w)
  await page.goto('/sell')
  await signIn(page, '/sell')
  await expect(page.locator('[data-wallet]')).toContainText('Old · lux')
  await expect(page.getByText('None of your organization’s wallets is on the Hanzo L1, where hires are paid.')).toBeVisible()
  await page.getByRole('button', { name: 'Create a payout wallet' }).click()
  await expect(page.locator('[data-wallet]').filter({ hasText: 'Payouts · eip155:36963' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create a payout wallet' })).toHaveCount(0)
})
