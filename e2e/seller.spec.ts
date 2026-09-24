import { expect, test } from '@playwright/test'

import { signIn } from './flow'
import { mock, NOW, world } from './mock'

test('seller onboarding → create listing → deliver a job → earnings', async ({ page }) => {
  const w = world({
    jobs: [
      {
        id: 'job_7',
        listing: 'lst_1',
        title: 'Triage the support inbox',
        buyerOrg: 'globex',
        sellerOrg: 'acme',
        amount: '40',
        currency: 'USD',
        status: 'accepted',
        brief: 'Label and route every open ticket.',
        escrow: { network: 'lux', contract: '0xescrow', txHash: '0xfund' },
        history: [
          { status: 'open', at: NOW - 600, by: 'globex' },
          { status: 'accepted', at: NOW - 300, by: 'acme' },
        ],
        createdAt: NOW - 600,
        updatedAt: NOW - 300,
      },
      {
        id: 'job_3',
        listing: 'lst_1',
        title: 'Earlier triage',
        buyerOrg: 'initech',
        sellerOrg: 'acme',
        amount: '120',
        currency: 'USD',
        status: 'released',
        brief: 'Done before.',
        escrow: { network: 'lux', contract: '0xescrow' },
        history: [],
        createdAt: NOW - 7200,
        updatedAt: NOW - 3600,
      },
    ],
  })
  await mock(page, w)

  // Onboarding: sign in with hanzo.id; the org is the principal.
  await page.goto('/sell')
  await signIn(page, '/sell')
  await expect(page.getByRole('heading', { name: 'Set up your organization' })).toBeVisible()
  await expect(page.locator('[data-org]')).toHaveText('Acting as acme')

  await page.getByRole('button', { name: 'Verify your organization' }).click()
  await expect(page.getByText('Status: pending')).toBeVisible()

  await page.getByRole('textbox', { name: 'Legal name (as on your tax return)' }).fill('Acme Corporation')
  await page.getByRole('textbox', { name: 'Address' }).fill('1 Market St')
  await page.getByRole('textbox', { name: 'City' }).fill('San Francisco')
  await page.getByRole('textbox', { name: 'State' }).fill('CA')
  await page.getByRole('textbox', { name: 'ZIP' }).fill('94105')
  await page.getByLabel('Taxpayer ID number').fill('12-3456789')
  await page.getByRole('button', { name: 'Save tax form' }).click()
  await expect(page.getByText('W-9 · none')).toBeVisible()
  await page.getByRole('button', { name: 'Sign and certify' }).click()
  await expect(page.getByText('W-9 · certified')).toBeVisible()

  await page.getByRole('button', { name: 'Create a payout wallet' }).click()
  await page.getByRole('button', { name: 'Pay me here' }).click()
  await expect(page.getByText('Payouts go here')).toBeVisible()
  expect(w.principal).toMatchObject({ payout: { wallet: 'wal_acme' } })

  // A listing, from the org's own agents.
  await page.goto('/sell/listings/new')
  await page.getByRole('combobox', { name: 'Which agent' }).selectOption('triage-bot')
  await page.getByRole('textbox', { name: 'Title' }).fill('Inbox Triage Agent')
  await page.getByRole('textbox', { name: 'Description' }).fill('Labels, routes and drafts replies for every ticket.')
  await page.getByRole('textbox', { name: 'Price per job (USD)' }).fill('40')
  await expect(page.getByRole('combobox', { name: 'Paid into' })).toHaveValue('wal_acme')
  await page.getByRole('button', { name: 'Publish listing' }).click()
  await expect(page.getByRole('heading', { name: 'Listing published' })).toBeVisible()
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

  // Earnings: x402 per call, escrow released, escrow held, and the 1099s received.
  await page.goto('/sell/earnings')
  await expect(page.getByText('Earned in')).toBeVisible()
  await expect(page.getByText('$120.005', { exact: true })).toBeVisible()
  await expect(page.getByText('$0.005', { exact: true })).toBeVisible()
  await expect(page.getByText('$40.00', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('1099-NEC · Orbital Labs')).toBeVisible()
  await expect(page.getByText('$1,250.00')).toBeVisible()
})
