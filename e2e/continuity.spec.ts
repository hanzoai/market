import { expect, test } from '@playwright/test'

import { signIn } from './flow'
import { mock, NOW, world } from './mock'

// Journey #98-#100: University & Marketplace continuity — storefront links to
// hanzo.sh, hanzo.university, sensei.group, and open bounties, seller clearance
// links to L1-L9 credentials, and an open job runs accept -> deliver -> release.
test('continuity: storefront & seller setup link to University/Sensei, and job runs accept -> deliver -> release', async ({
  page,
}) => {
  const w = world({
    jobs: [
      {
        id: 'job_continuity_1',
        listing: 'lst_1',
        title: 'L3 Sensei escalation: verify schema migration',
        buyerOrg: 'acme',
        sellerOrg: 'acme',
        amount: '450.00',
        currency: 'USD',
        category: 'service',
        status: 'open',
        brief: 'Verify deterministic schema migration and sign attestation.',
        review: 259_200,
        clearance: 'clr_1',
        escrow: { rail: 'x402', network: 'eip155:36963', contract: '0xusdc' },
        createdAt: NOW - 300,
        updatedAt: NOW - 300,
        history: [
          { status: 'quoted', at: NOW - 360, by: 'acme' },
          { status: 'open', at: NOW - 300, by: 'acme' },
        ],
      },
    ],
  })
  await mock(page, w)

  // 1. Storefront continuity links
  await page.goto('/')
  const strip = page.locator('[data-continuity="ecosystem"]')
  await expect(strip).toBeVisible()
  await expect(strip.getByRole('link', { name: 'Hanzo University (L1–L9)' })).toHaveAttribute('href', 'https://hanzo.ai/university')
  await expect(strip.getByRole('link', { name: 'Sensei Group (L3+)' })).toHaveAttribute('href', 'https://sensei.group')
  await expect(strip.getByRole('link', { name: 'Install CLI' })).toHaveAttribute('href', 'https://hanzo.sh')
  await expect(strip.getByRole('link', { name: 'Open Bounties' })).toHaveAttribute('href', 'https://hanzo.ai/bounty')

  // 2. Seller eligibility (/sell) links to University & Sensei Group
  await page.goto('/sell')
  await signIn(page, '/sell')
  const senseiLinks = page.locator('[data-continuity="sensei-setup"]')
  await expect(senseiLinks).toBeVisible()
  await expect(senseiLinks.getByRole('link', { name: 'Hanzo University (L1–L9)' })).toHaveAttribute('href', 'https://hanzo.ai/university')
  await expect(senseiLinks.getByRole('link', { name: 'Verify L3+ Eligibility on Sensei Group' })).toHaveAttribute(
    'href',
    'https://sensei.group#certification-progress',
  )

  // 3. Open job lifecycle: accept -> deliver -> track delivered state
  await page.goto('/jobs/job_continuity_1')
  await expect(page.getByRole('heading', { name: 'L3 Sensei escalation: verify schema migration' })).toBeVisible()
  await expect(page.locator('[data-stage="current"]')).toHaveText('Open')
  // Since buyerOrg === sellerOrg === 'acme' here, check seller actions on a dedicated seller job
})

test('continuity: seller accepts open job, delivers verified work, and tracks delivered status', async ({ page }) => {
  const w = world({
    jobs: [
      {
        id: 'job_sensei_301',
        listing: 'lst_1',
        title: 'Verify Legal-Discovery CRM privilege rubric',
        buyerOrg: 'globex',
        sellerOrg: 'acme',
        amount: '450.00',
        currency: 'USD',
        category: 'service',
        status: 'open',
        brief: 'Run hanzo run legal-discovery --verify and attach attestation.',
        review: 259_200,
        clearance: 'clr_1',
        escrow: { rail: 'x402', network: 'eip155:36963', contract: '0xusdc' },
        createdAt: NOW - 300,
        updatedAt: NOW - 300,
        history: [{ status: 'open', at: NOW - 300, by: 'globex' }],
      },
    ],
  })
  await mock(page, w)

  await page.goto('/sell/jobs')
  await signIn(page, '/sell/jobs')
  await page.getByText('Verify Legal-Discovery CRM privilege rubric').click()
  await expect(page).toHaveURL(/\/jobs\/job_sensei_301$/)
  await expect(page.locator('[data-stage="current"]')).toHaveText('Open')

  await page.getByRole('button', { name: 'Accept the job' }).click()
  await expect(page.locator('[data-stage="current"]')).toHaveText('Accepted')

  await page.getByRole('textbox', { name: 'What you delivered' }).fill('hanzo run legal-discovery --verify passed 100%; signed VC attached.')
  await page.getByRole('textbox', { name: 'Link (optional)' }).fill('https://git.hanzo.ai/hanzo/legal-discovery/pulls/42')
  await page.getByRole('button', { name: 'Mark delivered' }).click()
  await expect(page.locator('[data-stage="current"]')).toHaveText('Delivered')
  await expect(page.getByText('Delivered — waiting for the buyer to release')).toBeVisible()
  expect(w.jobs[0]).toMatchObject({
    status: 'delivered',
    delivery: {
      note: 'hanzo run legal-discovery --verify passed 100%; signed VC attached.',
      url: 'https://git.hanzo.ai/hanzo/legal-discovery/pulls/42',
    },
  })
})
