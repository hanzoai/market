import { expect, test, type Page } from '@playwright/test'

import { signIn } from './flow'
import { mock, wallet, world, type World } from './mock'

/** Mock the platform (then any overrides, which Playwright runs first), and sign in at checkout. */
async function toCheckout(page: Page, w: World, override?: () => Promise<unknown>, id = 'lst_research') {
  await mock(page, w)
  await override?.()
  await page.goto(`/checkout/${id}`)
  await signIn(page, `/checkout/${id}`)
}

test('browse → listing → sign in → clearance → the buyer wallet signs and the job opens', async ({ page }) => {
  const w = world()
  const payer = wallet(w)
  await mock(page, w)
  await page.goto('/')

  // One catalog, four sources, faceted by type, counted by the servers.
  await expect(page.getByRole('heading', { name: 'Agents, apps, skills and MCP servers' })).toBeVisible()
  await expect(page.locator('[data-item="listing:lst_research"]')).toBeVisible()
  await expect(page.locator('[data-item="app:hanzo/chat"]')).toBeVisible()
  await expect(page.locator('[data-note="mcp"]')).toContainText('Sign in to include MCP servers')
  await expect(page.getByRole('button', { name: 'All 64' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tools 1' })).toBeVisible()

  // Sixty-odd skills page 48 at a time.
  await expect(page.locator('[data-item]')).toHaveCount(48)
  await page.getByRole('button', { name: 'Show more · 16 left' }).click()
  await expect(page.locator('[data-item]')).toHaveCount(64)
  await expect(page.locator('[data-item="skill:vector-search"]')).toBeVisible()

  await page.getByRole('button', { name: /^Agents/ }).click()
  await expect(page).toHaveURL(/\/agents$/)
  await expect(page.locator('[data-item="app:hanzo/chat"]')).toHaveCount(0)

  await page.getByRole('searchbox', { name: 'Search the marketplace' }).fill('research')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page).toHaveURL(/\/agents\?q=research$/)
  await page.locator('[data-item="listing:lst_research"]').click()

  // The listing page: reputation, and the platform's own command and MCP operation.
  await expect(page).toHaveURL(/\/l\/lst_research$/)
  await expect(page.getByRole('heading', { name: 'Deep Research Agent' })).toBeVisible()
  const rep = page.locator('[data-reputation]')
  await expect(rep).toContainText('4.8')
  await expect(rep).toContainText('23 reviews')
  await expect(rep).toContainText('57')
  await expect(page.locator('[data-code]').first()).toHaveText('hanzo marketplace jobs create --listing lst_research --brief <brief> --amount <usd>')
  await expect(page.locator('[data-code]').nth(1)).toContainText('"op":"post_marketplace_jobs"')
  await expect(page.getByRole('main').getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', 'https://docs.hanzo.ai/docs/agents/deep-research')

  // Checkout asks who you are, through hanzo.id.
  await page.getByRole('button', { name: 'Hire' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await signIn(page, '/checkout/lst_research')

  // The amount decides the clearance, so the buyer states it and asks.
  await page.getByRole('textbox', { name: 'What do you need done?' }).fill('A market map of MCP registries.')
  await expect(page.getByRole('textbox', { name: 'Amount (USD)' })).toHaveValue('250.00')
  const pay = page.getByRole('button', { name: 'Pay $250.00 and open the job' })
  await expect(pay).toBeDisabled()
  await page.getByRole('button', { name: 'Check clearance' }).click()

  await expect(page.getByText('Cleared to pay')).toBeVisible()
  await expect(page.getByText('The seller receives $250.00.')).toBeVisible()
  expect(w.cleared).toEqual([{ payee: 'orbital', amount: '250.00', rail: 'x402', category: 'services' }])

  // The wallet signs the x402 terms cloud named; the job opens with the amount set aside.
  await pay.click()
  await expect(page).toHaveURL(/\/jobs\/job_1$/)
  await expect(page.getByText('Open — the amount is set aside in the buyer’s wallet, waiting for the seller')).toBeVisible()
  await expect(page.locator('[data-stage="current"]')).toHaveText('Open')
  await expect(page.locator('[data-stage="todo"]')).toHaveText(['Accepted', 'Delivered', 'Released'])
  expect(w.hires).toHaveLength(2)
  expect(w.hires[0]).not.toHaveProperty('payment')
  expect(w.hires[1]).toMatchObject({ listing: 'lst_research', amount: '250.00', category: 'service', wallet: 'wal_acme', payment: expect.any(String) })
  // The mock recovered the signer from the terms with viem: it is the buyer's wallet.
  expect(w.jobs[0]).toMatchObject({ status: 'open', payer: payer.address })

  // The buyer may take the job back before the seller accepts it.
  await expect(page.getByRole('button', { name: 'Cancel the job' })).toBeVisible()
})

test('clearance that needs something says what, and holds payment', async ({ page }) => {
  const w = world({ clearance: 'needs' })
  wallet(w)
  await toCheckout(page, w)
  await page.getByRole('textbox', { name: 'What do you need done?' }).fill('A market map.')
  await page.getByRole('button', { name: 'Check clearance' }).click()
  await expect(page.getByText('1 thing to finish before paying')).toBeVisible()
  await expect(page.locator('[data-need]')).toContainText("The payer's founders complete identity verification")
  await expect(page.locator('[data-need]').getByRole('link', { name: 'Do this now' })).toHaveAttribute('href', '/sell')
  await expect(page.getByRole('button', { name: 'Pay $250.00 and open the job' })).toBeDisabled()
  expect(w.hires).toEqual([])
})

test('a payment that clears only net of withholding is not paid as a job', async ({ page }) => {
  const w = world({ clearance: 'withheld' })
  wallet(w)
  await toCheckout(page, w)
  await page.getByRole('textbox', { name: 'What do you need done?' }).fill('A market map.')
  await page.getByRole('button', { name: 'Check clearance' }).click()
  await expect(page.getByText('Cleared only with tax withheld')).toBeVisible()
  await expect(page.locator('[data-withholding]')).toHaveText(
    '24% ($60.00) of this payment is withheld: The payee has not furnished a TIN, so backup withholding applies (IRC §3406).',
  )
  await expect(page.locator('[data-net-only]')).toContainText('a job is paid in full over x402')
  await expect(page.getByRole('button', { name: 'Pay $250.00 and open the job' })).toBeDisabled()
})

// Red market-1: after $250 cleared, the amount was raised to $50,000 and the
// re-check failed — and Pay stayed enabled on the $250 answer.
test('payment waits on a finished clearance of the amount it pays', async ({ page }) => {
  const w = world()
  wallet(w)
  let n = 0
  let release: () => void = () => {}
  const held = new Promise<void>((r) => {
    release = r
  })
  await toCheckout(page, w, () =>
    page.route(/\/v1\/principal\/clearance$/, async (route) => {
      n += 1
      if (n === 1) return route.fallback()
      if (n === 2) {
        await held
        return route.fulfill({ status: 500, contentType: 'application/problem+json', body: JSON.stringify({ status: 500, detail: 'clearance store unavailable' }) })
      }
      return route.fallback()
    }),
  )
  await page.getByRole('textbox', { name: 'What do you need done?' }).fill('A market map.')
  await page.getByRole('button', { name: 'Check clearance' }).click()
  await expect(page.getByText('Cleared to pay')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay $250.00 and open the job' })).toBeEnabled()

  // A new amount: the old answer is not its answer.
  await page.getByRole('textbox', { name: 'Amount (USD)' }).fill('50000')
  const pay = page.getByRole('button', { name: 'Pay $50,000.00 and open the job' })
  await expect(pay).toBeDisabled()
  await expect(page.getByText('The terms changed. Check clearance again.')).toBeVisible()

  // In flight: still no answer for $50,000.
  await page.getByRole('button', { name: 'Check clearance' }).click()
  await expect(page.getByText('Checking clearance…')).toBeVisible()
  await expect(pay).toBeDisabled()

  // Refused: nothing to pay on.
  release()
  await expect(page.getByText('clearance store unavailable')).toBeVisible()
  await expect(pay).toBeDisabled()
  expect(w.hires).toEqual([])

  // Asked again and cleared for $50,000: now it may be paid.
  await page.getByRole('button', { name: 'Check again' }).click()
  await expect(page.getByText('Cleared to pay')).toBeVisible()
  await expect(pay).toBeEnabled()
})

// Red market-4: a foreign seller's clearance asks where the work is performed, and
// the buyer had no way to answer — so no foreign seller could ever be paid.
test('a foreign seller: the buyer says where the work is performed, and the job carries it', async ({ page }) => {
  const w = world({ clearance: 'foreign' })
  wallet(w)
  await toCheckout(page, w)
  await page.getByRole('textbox', { name: 'What do you need done?' }).fill('A market map.')
  await expect(page.getByRole('textbox', { name: 'Where the work is performed (2 letters)' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Check clearance' }).click()
  await expect(page.getByText('1 thing to finish before paying')).toBeVisible()
  await expect(page.locator('[data-fact="performed"]')).toContainText('Where is the service performed')
  const pay = page.getByRole('button', { name: 'Pay $250.00 and open the job' })
  await expect(pay).toBeDisabled()

  await page.getByRole('textbox', { name: 'Where the work is performed (2 letters)' }).fill('us')
  await page.getByRole('button', { name: 'Check clearance' }).click()
  await expect(page.getByText('Cleared to pay')).toBeVisible()
  expect(w.cleared.at(-1)).toEqual({ payee: 'orbital', amount: '250.00', rail: 'x402', category: 'services', performed: 'US' })
  await pay.click()
  await expect(page).toHaveURL(/\/jobs\/job_1$/)
  expect(w.hires.map((h) => h.performed)).toEqual(['US', 'US'])
  expect(w.jobs[0]).toMatchObject({ performed: 'US', status: 'open' })
})

test('clearance not live yet holds payment, and says so', async ({ page }) => {
  const w = world({ clearance: 'absent' })
  wallet(w)
  await toCheckout(page, w)
  await page.getByRole('textbox', { name: 'What do you need done?' }).fill('A market map.')
  await page.getByRole('button', { name: 'Check clearance' }).click()
  await expect(page.getByText('Clearance is not live yet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay $250.00 and open the job' })).toBeDisabled()
})

test('a platform tool is installed and paid per call over x402', async ({ page }) => {
  const w = world()
  await mock(page, w)
  await page.goto('/l/lst_geocode')
  await expect(page.getByText('$0.0025 per call').first()).toBeVisible()
  await expect(page.locator('[data-code]').first()).toHaveText('hanzo marketplace install --tool geocode')
  await page.getByRole('button', { name: 'Buy' }).click()
  await signIn(page, '/checkout/lst_geocode')
  await page.getByRole('button', { name: 'Install and pay per call' }).click()
  await expect(page.getByText('Installed for acme')).toBeVisible()
  await expect(page.getByText(/Each call costs \$0\.0025 and settles over x402 to admin/)).toBeVisible()
  expect(w.installed).toEqual(['geocode'])
  expect(w.cleared).toEqual([])
})
