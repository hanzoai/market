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
  // One attempt names the hire in both steps, so cloud answers it with one job however often it is sent.
  expect(w.hires[0].attempt).toMatch(/^0x[0-9a-f]{64}$/)
  expect(w.hires[1].attempt).toBe(w.hires[0].attempt)
  // The mock recovered the signer from the terms with viem: it is the buyer's wallet.
  expect(w.jobs[0]).toMatchObject({ status: 'open', payer: payer.address })
  // The job shows whom the signed payment pays, and that no token contract moves it: the rail's ledger does.
  await expect(page.getByText('0x209693Bc6afc0C5328bA36FaF03C514EF312287C')).toBeVisible()
  await expect(page.getByText('none: the rail’s own ledger')).toBeVisible()

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
// Red market-17: as in cloud (principals rules.go), work a foreign seller performs in
// the U.S. is withheld 30% under chapter 3, which a job cannot pay; elsewhere it clears.
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

  const where = page.getByRole('textbox', { name: 'Where the work is performed (2 letters)' })
  await where.fill('us')
  await page.getByRole('button', { name: 'Check clearance' }).click()
  await expect(page.getByText('Cleared only with tax withheld')).toBeVisible()
  await expect(page.locator('[data-withholding]')).toContainText('30% ($75.00) of this payment is withheld')
  await expect(pay).toBeDisabled()
  expect(w.cleared.at(-1)).toEqual({ payee: 'orbital', amount: '250.00', rail: 'x402', category: 'services', performed: 'US' })

  await where.fill('de')
  await page.getByRole('button', { name: 'Check clearance' }).click()
  await expect(page.getByText('Cleared to pay')).toBeVisible()
  expect(w.cleared.at(-1)).toEqual({ payee: 'orbital', amount: '250.00', rail: 'x402', category: 'services', performed: 'DE' })
  await pay.click()
  await expect(page).toHaveURL(/\/jobs\/job_1$/)
  expect(w.hires.map((h) => h.performed)).toEqual(['DE', 'DE'])
  expect(w.jobs[0]).toMatchObject({ performed: 'DE', status: 'open' })
})

/** Fill the brief, clear $250.00, and answer the Pay button. */
async function cleared(page: Page) {
  await page.getByRole('textbox', { name: 'What do you need done?' }).fill('A market map.')
  await page.getByRole('button', { name: 'Check clearance' }).click()
  await expect(page.getByText('Cleared to pay')).toBeVisible()
  return page.getByRole('button', { name: 'Pay $250.00 and open the job' })
}

const opened = (w: World) => w.jobs.filter((j) => j.status === 'open')
const signings = (page: Page) => {
  const signed: string[] = []
  page.on('request', (r) => {
    if (/\/v1\/wallet\/[^/]+\/sign$/.test(new URL(r.url()).pathname)) signed.push(JSON.parse(r.postData() ?? '{}').digest)
  })
  return signed
}

// Red market-12: cloud opened the job and set the amount aside, but the answer was
// lost (a gateway timeout). The retry re-quoted with a new deadline, signed a second
// payment and opened a second job with a second hold.
test('a payment whose answer was lost is sent again as it was, and opens one job', async ({ page }) => {
  const w = world({ lose: { quote: 0, pay: 1 } })
  wallet(w)
  await toCheckout(page, w)
  const signed = signings(page)
  await (await cleared(page)).click()
  await expect(page.getByText('upstream request timeout')).toBeVisible()
  const held = page.locator('[data-unanswered]')
  await expect(held).toContainText('$250.00 for “A market map.”')
  await expect(held).toContainText('Your wallet signed $250.00 to 0x209693Bc6afc0C5328bA36FaF03C514EF312287C for job job_1')
  // Red market-18: a signed payment whose answer is unknown is the only hire offered.
  await expect(page.getByRole('button', { name: 'Start over' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'What do you need done?' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Your jobs' })).toHaveAttribute('href', '/jobs')
  expect(opened(w)).toHaveLength(1)

  await page.getByRole('button', { name: 'Send the same payment again' }).click()
  await expect(page).toHaveURL(/\/jobs\/job_1$/)
  expect(opened(w).map((j) => j.id)).toEqual(['job_1'])
  expect(w.hires.map((h) => (h.payment ? 'pay' : 'quote'))).toEqual(['quote', 'pay', 'pay'])
  expect(w.hires[2].payment).toBe(w.hires[1].payment)
  expect(new Set(w.hires.map((h) => h.attempt)).size).toBe(1)
  expect(signed).toHaveLength(1)
})

test('a quote whose answer was lost is asked again with the same deadline, and gets the same job', async ({ page }) => {
  const w = world({ lose: { quote: 1, pay: 0 } })
  wallet(w)
  await toCheckout(page, w)
  await (await cleared(page)).click()
  await expect(page.getByText('upstream request timeout')).toBeVisible()
  await expect(page.locator('[data-unanswered]')).toContainText('Nothing was signed.')
  // Nothing signed, nothing set aside: starting over is safe.
  await expect(page.getByRole('button', { name: 'Start over' })).toBeVisible()
  await page.getByRole('button', { name: 'Ask again with the same terms' }).click()
  await expect(page).toHaveURL(/\/jobs\/job_1$/)
  const quotes = w.hires.filter((h) => !h.payment)
  expect(quotes).toHaveLength(2)
  expect(quotes[1].deadline).toBe(quotes[0].deadline)
  expect(quotes[1].attempt).toBe(quotes[0].attempt)
  expect(w.jobs.map((j) => [j.id, j.status])).toEqual([['job_1', 'open']])
})

// The wallet may have signed when its answer was lost: asking again signs the same
// authorization, so the two signatures share one nonce and at most one can move money.
test('a signature whose answer was lost is asked for again over the same authorization', async ({ page }) => {
  const w = world()
  wallet(w)
  let lost = 0
  await toCheckout(page, w, () =>
    page.route(/\/v1\/wallet\/[^/]+\/sign$/, (route) =>
      lost++ ? route.fallback() : route.fulfill({ status: 502, contentType: 'application/problem+json', body: JSON.stringify({ status: 502, detail: 'custody ring did not answer' }) }),
    ),
  )
  const signed = signings(page)
  await (await cleared(page)).click()
  await expect(page.getByText('custody ring did not answer')).toBeVisible()
  await expect(page.locator('[data-unanswered]')).toContainText('so it may have signed')
  // The wallet may have signed: dropping this authorization for a new one is not offered.
  await expect(page.getByRole('button', { name: 'Start over' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ask again with the same terms' }).click()
  await expect(page).toHaveURL(/\/jobs\/job_1$/)
  expect(signed).toHaveLength(2)
  expect(signed[1]).toBe(signed[0])
  expect(w.jobs.map((j) => [j.id, j.status])).toEqual([['job_1', 'open']])
})

/** The payment, as the page decoded would send it. */
const decode = (s: string) => JSON.parse(Buffer.from(s, 'base64').toString()) as { resource: { url: string }; payload: { authorization: { nonce: string } } }

/**
 * Cloud answers late: the gateway gives up (504) while cloud is still funding the
 * first payment, so the job stays funding until the test opens it. Only the first
 * payment is late.
 */
const slowFund = (page: Page, w: World) =>
  page.route(/\/v1\/marketplace\/jobs$/, (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { payment?: string }
    if (route.request().method() !== 'POST' || !body.payment || Object.keys(w.paid).length) return route.fallback()
    const id = decode(body.payment).resource.url.replace(/^job:/, '')
    w.hires.push(body)
    w.paid[id] = body.payment
    Object.assign(w.jobs.find((j) => j.id === id)!, { status: 'funding' })
    return route.fulfill({ status: 504, contentType: 'application/problem+json', body: JSON.stringify({ status: 504, detail: 'upstream request timeout' }) })
  })

// Red market-18: a reload threw the signed payment away while cloud was still
// funding it; the next attempt quoted anew and opened a second job. Cloud now
// lists the buyer's quotes and fundings, so the hire in flight is found there —
// by a reload, another tab or another device — and nothing new starts unasked.
test('after a reload, a hire still being funded is found in flight, and no second one starts unasked', async ({ page }) => {
  const w = world()
  wallet(w)
  await toCheckout(page, w, () => slowFund(page, w))
  const signed = signings(page)
  await (await cleared(page)).click()
  await expect(page.getByText('upstream request timeout')).toBeVisible()
  const attempt = w.hires[0].attempt

  await page.reload()
  const pay = await cleared(page)
  const before = w.hires.length
  await pay.click()
  await expect(page.locator('[data-underway]')).toContainText('Your organization already has job job_1 in flight for exactly this: $250.00, funding.')
  await expect(pay).toBeDisabled()
  expect(w.hires).toHaveLength(before)

  // The buyer's jobs list it as a hire in flight, with its attempt.
  await page.getByRole('link', { name: 'Open job_1' }).click()
  await expect(page.getByText(/^Funding — the payment is being set aside/)).toBeVisible()
  await expect(page.getByText(String(attempt))).toBeVisible()
  await page.goto('/jobs')
  const flying = page.locator('[data-inflight]')
  await expect(flying.getByRole('heading', { name: 'In flight' })).toBeVisible()
  await expect(flying).toContainText('Deep Research Agent')
  await expect(flying).toContainText(`attempt ${String(attempt)}`)
  await expect(flying).toContainText('funding')

  // Cloud finishes funding it: it opens once, as the one job.
  Object.assign(w.jobs[0], { status: 'open' })
  await page.reload()
  await expect(page.locator('[data-inflight]')).toHaveCount(0)
  await expect(page.getByText('open', { exact: true })).toBeVisible()
  expect(opened(w).map((j) => j.id)).toEqual(['job_1'])
  expect(signed).toHaveLength(1)
})

// A quote is in flight too: after a reload the page cannot know whether a payment
// for it is on its way to the platform.
test('after a reload, the quote of a hire whose answer was lost is found in flight', async ({ page }) => {
  const w = world({ lose: { quote: 1, pay: 0 } })
  wallet(w)
  await toCheckout(page, w)
  await (await cleared(page)).click()
  await expect(page.locator('[data-unanswered]')).toContainText('Nothing was signed.')
  await page.reload()
  const pay = await cleared(page)
  await pay.click()
  await expect(page.locator('[data-underway]')).toContainText('Your organization already has job job_1 in flight for exactly this: $250.00, quoted.')
  expect(w.hires).toHaveLength(1)
  await page.getByRole('button', { name: 'Hire again anyway' }).click()
  await pay.click()
  await expect(page).toHaveURL(/\/jobs\/job_2$/)
})

// A quote this page asked and never paid — dropped with Start over, or answered with
// a refusal before anything was signed — can never open, so it is not in the way.
test('a quote this page ended unpaid does not stand in the way of the next hire', async ({ page }) => {
  const w = world({ lose: { quote: 1, pay: 0 } })
  wallet(w)
  let refuse = 1
  await toCheckout(page, w, () =>
    page.route(/\/v1\/wallet\/[^/]+\/sign$/, (route) =>
      refuse-- > 0
        ? route.fulfill({ status: 403, contentType: 'application/problem+json', body: JSON.stringify({ status: 403, detail: 'this member may not sign for wal_acme' }) })
        : route.fallback(),
    ),
  )
  const pay = await cleared(page)
  await pay.click()
  await page.getByRole('button', { name: 'Start over' }).click()
  await pay.click()
  await expect(page.getByText('this member may not sign for wal_acme')).toBeVisible()
  await expect(page.locator('[data-unanswered]')).toHaveCount(0)
  await pay.click()
  await expect(page).toHaveURL(/\/jobs\/job_3$/)
  await expect(page.locator('[data-underway]')).toHaveCount(0)
  const attempts = w.hires.map((h) => h.attempt)
  expect(new Set(attempts).size).toBe(3)
  expect(w.jobs.map((j) => [j.id, j.status])).toEqual([
    ['job_1', 'quoted'],
    ['job_2', 'quoted'],
    ['job_3', 'open'],
  ])
})

// CM-R32: the rail gave the payment up ("sign another"), and a kept nonce is never
// held again: the page signs a fresh authorization for the same job, under the same attempt, once.
test('a payment the rail gave up is signed afresh for the same job, and opens it once', async ({ page }) => {
  const w = world({ giveUp: 1 })
  wallet(w)
  await toCheckout(page, w)
  const signed = signings(page)
  await (await cleared(page)).click()
  await expect(page).toHaveURL(/\/jobs\/job_1$/)
  expect(w.hires.map((h) => (h.payment ? 'pay' : 'quote'))).toEqual(['quote', 'pay', 'quote', 'pay'])
  expect(new Set(w.hires.map((h) => h.attempt)).size).toBe(1)
  const [first, second] = w.hires.filter((h) => h.payment).map((h) => decode(String(h.payment)))
  expect(second.resource.url).toBe('job:job_1')
  expect(second.payload.authorization.nonce).not.toBe(first.payload.authorization.nonce)
  expect(signed).toHaveLength(2)
  expect(w.jobs.map((j) => [j.id, j.status])).toEqual([['job_1', 'open']])
})

// CM-R32: a payment whose answer was lost, sent again after the platform lapsed its
// quote and dropped it (404): the attempt asks again, and pays the job quoted anew
// with an authorization of its own.
test('a kept payment whose quote lapsed asks again, and pays the job quoted anew', async ({ page }) => {
  const w = world()
  wallet(w)
  let late = 0
  await toCheckout(page, w, () =>
    page.route(/\/v1\/marketplace\/jobs$/, (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as { payment?: string }
      if (route.request().method() !== 'POST' || !body.payment || late++) return route.fallback()
      w.hires.push(body)
      return route.fulfill({ status: 504, contentType: 'application/problem+json', body: JSON.stringify({ status: 504, detail: 'upstream request timeout' }) })
    }),
  )
  const signed = signings(page)
  await (await cleared(page)).click()
  await expect(page.getByText('upstream request timeout')).toBeVisible()
  // The clock lapses the quote: nothing was held, and the row is gone.
  w.jobs.splice(0, 1)
  await page.getByRole('button', { name: 'Send the same payment again' }).click()
  await expect(page).toHaveURL(/\/jobs\/job_2$/)
  expect(w.hires.map((h) => (h.payment ? 'pay' : 'quote'))).toEqual(['quote', 'pay', 'pay', 'quote', 'pay'])
  expect(new Set(w.hires.map((h) => h.attempt)).size).toBe(1)
  expect(signed).toHaveLength(2)
  expect(signed[1]).not.toBe(signed[0])
  expect(opened(w)).toHaveLength(1)
})

// Another browser keeps nothing of this one's attempt; the job it opened is the platform's.
test('another browser first finds a job already under way for exactly these terms', async ({ browser, page }) => {
  const w = world({ lose: { quote: 0, pay: 1 } })
  wallet(w)
  await toCheckout(page, w)
  await (await cleared(page)).click()
  await expect(page.getByText('upstream request timeout')).toBeVisible()

  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  await toCheckout(other, w)
  await expect(other.locator('[data-unanswered]')).toHaveCount(0)
  const pay = await cleared(other)
  const before = w.hires.length
  await pay.click()
  await expect(other.locator('[data-underway]')).toContainText('Your organization already has job job_1 under way for exactly this: $250.00, open.')
  await expect(pay).toBeDisabled()
  await expect(other.getByRole('link', { name: 'Open job_1' })).toHaveAttribute('href', '/jobs/job_1')
  expect(w.hires).toHaveLength(before)

  // Told, the buyer may still hire again: a second job, knowingly.
  await other.getByRole('button', { name: 'Hire again anyway' }).click()
  await pay.click()
  await expect(other).toHaveURL(/\/jobs\/job_2$/)
  expect(opened(w).map((j) => j.id)).toEqual(['job_1', 'job_2'])
  await elsewhere.close()
})

// Red market-19: the rail settles on the Hanzo L1 only, so a wallet for another chain is not offered.
test('only wallets on the Hanzo L1 are offered to pay from', async ({ page }) => {
  const w = world()
  wallet(w, 'wal_eth', 'Mainnet', 'eip155:1')
  await toCheckout(page, w)
  await expect(page.getByText('Your organization has no wallet on the Hanzo L1 yet.')).toBeVisible()
  wallet(w)
  wallet(w, 'wal_any', 'Ops', '')
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Pay from wallet' }).locator('option')).toHaveText(['Treasury · eip155:36963', 'Ops · any chain'])
})

// Red market-19: terms naming Ethereum mainnet and its USDC for the cleared amount
// were signed — a valid authorization to move mainnet money, outside the rail.
test('the wallet signs nothing on another chain', async ({ page }) => {
  const w = world()
  wallet(w)
  await toCheckout(page, w, () =>
    page.route(/\/v1\/marketplace\/jobs$/, (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      const t = {
        x402Version: 2,
        resource: { url: 'job:job_1' },
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:1',
            amount: '250000000',
            asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
            maxTimeoutSeconds: 300,
            extra: { assetTransferMethod: 'eip3009', name: 'USD Coin', version: '2' },
          },
        ],
      }
      return route.fulfill({
        status: 402,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 402, detail: 'sign the payment', paymentRequired: Buffer.from(JSON.stringify(t)).toString('base64') }),
      })
    }),
  )
  const signed = signings(page)
  await (await cleared(page)).click()
  await expect(page.getByText('The payment terms name no network and token contract this storefront signs for. Nothing was signed.')).toBeVisible()
  await expect(page.locator('[data-unanswered]')).toHaveCount(0)
  expect(signed).toEqual([])
})

// Red market-19: on the Hanzo L1 too, terms naming another token contract under the
// USDC name were signed — an authorization for whatever that contract holds.
test('the wallet signs for no token contract but the pinned one', async ({ page }) => {
  const w = world()
  wallet(w)
  await toCheckout(page, w, () =>
    page.route(/\/v1\/marketplace\/jobs$/, (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      const t = {
        x402Version: 2,
        resource: { url: 'job:job_1' },
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:36963',
            amount: '250000000',
            asset: '0x5425890298aed601595a70AB815c96711a31Bc65',
            payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
            maxTimeoutSeconds: 300,
            extra: { assetTransferMethod: 'eip3009', name: 'USD Coin', version: '2' },
          },
        ],
      }
      return route.fulfill({
        status: 402,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 402, detail: 'sign the payment', paymentRequired: Buffer.from(JSON.stringify(t)).toString('base64') }),
      })
    }),
  )
  const signed = signings(page)
  await (await cleared(page)).click()
  await expect(page.getByText('The payment terms name no network and token contract this storefront signs for. Nothing was signed.')).toBeVisible()
  expect(signed).toEqual([])
})

// Red market-15: the wallet signed whatever the 402 named — here 100 times the
// amount cleared, to an address that is not the seller's.
test('the wallet signs no terms other than the job it cleared', async ({ page }) => {
  const w = world()
  wallet(w)
  await toCheckout(page, w, () =>
    page.route(/\/v1\/marketplace\/jobs$/, (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      const t = {
        x402Version: 2,
        resource: { url: 'job:job_1' },
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:36963',
            amount: '25000000000',
            asset: '',
            payTo: '0x000000000000000000000000000000000000dEaD',
            maxTimeoutSeconds: 300,
            extra: { assetTransferMethod: 'eip3009', name: 'USD Coin', version: '2' },
          },
        ],
      }
      return route.fulfill({
        status: 402,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 402, detail: 'sign the payment', paymentRequired: Buffer.from(JSON.stringify(t)).toString('base64') }),
      })
    }),
  )
  const signed = signings(page)
  await (await cleared(page)).click()
  await expect(page.getByText('The platform asked the wallet to sign $25,000.00 for a job cleared at $250.00. Nothing was signed.')).toBeVisible()
  // An answer, not a lost one: nothing is held for a retry.
  await expect(page.locator('[data-unanswered]')).toHaveCount(0)
  expect(signed).toEqual([])
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
  await expect(page.getByText(/Each call costs \$0\.0025 and settles over x402 to Hanzo/)).toBeVisible()
  expect(w.installed).toEqual(['geocode'])
  expect(w.cleared).toEqual([])
})
