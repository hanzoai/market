import { expect, test } from '@playwright/test'

import { signIn } from './flow'
import { mock, world } from './mock'

const WALLET = { id: 'wal_acme', accountId: 'acct_1', name: 'Treasury', custody: 'mpc', chain: 'lux', address: '0xacme' }

test('browse → listing → sign in → clearance → escrow checkout opens a job', async ({ page }) => {
  const w = world({ wallets: [WALLET] })
  await mock(page, w)
  await page.goto('/')

  // One catalog, four sources, faceted by type.
  await expect(page.getByRole('heading', { name: 'Agents, apps, skills and MCP servers' })).toBeVisible()
  await expect(page.locator('[data-item="listing:lst_research"]')).toBeVisible()
  await expect(page.locator('[data-item="app:hanzo/chat"]')).toBeVisible()
  await expect(page.locator('[data-note="mcp"]')).toContainText('Sign in to include MCP servers')

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

  // The listing page: reputation, and the same action as docs, CLI and MCP.
  await expect(page).toHaveURL(/\/l\/lst_research$/)
  await expect(page.getByRole('heading', { name: 'Deep Research Agent' })).toBeVisible()
  const rep = page.locator('[data-reputation]')
  await expect(rep).toContainText('4.8')
  await expect(rep).toContainText('23 reviews')
  await expect(rep).toContainText('57')
  await expect(page.locator('[data-code]').first()).toHaveText('hanzo marketplace install --tool deep-research')
  await expect(page.locator('[data-code]').nth(1)).toContainText('"op":"post_marketplace_install"')
  await expect(page.getByRole('main').getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', /docs\.hanzo\.ai/)

  // Checkout asks who you are, through hanzo.id.
  await page.getByRole('button', { name: 'Hire' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await signIn(page, '/checkout/lst_research?rail=escrow')

  // Clearance first, in plain words, with the withholding it will apply.
  await expect(page.getByText('Cleared to pay')).toBeVisible()
  await expect(page.locator('[data-withholding]')).toHaveText(
    '24% of this payment is withheld and sent to the IRS as backup withholding: the seller has not certified its TIN',
  )
  expect(w.calls).toContain('GET /v1/principal/clearance?listing=lst_research&rail=escrow')

  // Then escrow: open → accepted → delivered → released.
  await page.getByRole('textbox', { name: 'What do you need done?' }).fill('A market map of MCP registries.')
  await expect(page.getByRole('textbox', { name: 'Amount (USD)' })).toHaveValue('250')
  await page.getByRole('button', { name: 'Fund $250.00 into escrow' }).click()
  await expect(page).toHaveURL(/\/jobs\/job_1$/)
  await expect(page.getByText('Open — funds held in escrow, waiting for the seller')).toBeVisible()
  await expect(page.locator('[data-stage="current"]')).toHaveText('Open')
  await expect(page.locator('[data-stage="todo"]')).toHaveText(['Accepted', 'Delivered', 'Released'])
  expect(w.jobs[0]).toMatchObject({ listing: 'lst_research', amount: '250', status: 'open' })
})

test('clearance that needs something says what, and holds payment', async ({ page }) => {
  await mock(page, world({ clearance: 'needs' }))
  await page.goto('/checkout/lst_geocode?rail=x402')
  await signIn(page, '/checkout/lst_geocode?rail=x402')
  await expect(page.getByText('1 thing to finish before paying')).toBeVisible()
  await expect(page.locator('[data-need]')).toContainText('Add a tax form')
  await expect(page.getByText('Finish clearance first.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Install and pay per call' })).toHaveCount(0)
})

test('clearance not live yet shows pending, and x402 install still works', async ({ page }) => {
  const w = world({ clearance: 'absent' })
  await mock(page, w)
  await page.goto('/l/lst_geocode')
  await expect(page.getByText('$0.0025 per call').first()).toBeVisible()
  await page.getByRole('button', { name: 'Buy' }).click()
  await signIn(page, '/checkout/lst_geocode?rail=x402')
  await expect(page.getByText('Clearance check is not live yet')).toBeVisible()
  await page.getByRole('button', { name: 'Install and pay per call' }).click()
  await expect(page.getByText('Installed for acme')).toBeVisible()
  await expect(page.getByText(/Each call costs \$0\.0025 and settles over x402 to mapworks/)).toBeVisible()
  expect(w.installed).toEqual(['geocode'])
})
