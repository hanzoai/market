// What clearance asks for, in plain words. The platform answers a list of needs;
// this file is the one place each need becomes a sentence and a next step, so
// checkout and seller onboarding say the same thing about the same requirement.

import type { Clearance, Need } from '~/lib/market'
import { percent } from '~/lib/money'

export interface Step {
  title: string
  body: string
  /** Where to go to satisfy it: a storefront path, or null when only the other party can. */
  to: string | null
}

const BUYER: Record<Need['kind'], Omit<Step, 'body'> & { body: string }> = {
  sign_in: {
    title: 'Sign in',
    body: 'Purchases are made by your organization, so sign in with your Hanzo account first.',
    to: null,
  },
  kyc: {
    title: 'Verify your organization',
    body: 'This payment is large enough that the platform needs to know who your organization is. Verification takes a few minutes.',
    to: '/sell',
  },
  tax_form: {
    title: 'Add a tax form',
    body: 'Your organization needs a W-9 (US) or W-8 (outside the US) on file before it can pay this seller.',
    to: '/sell',
  },
  payout_wallet: {
    title: 'Set a payout wallet',
    body: 'Your organization needs a wallet on file for this payment.',
    to: '/sell',
  },
  billing: {
    title: 'Add a way to pay',
    body: 'Your organization has no payment method or balance. Add one in the console, then come back.',
    to: 'https://console.hanzo.ai/billing',
  },
  payer_wallet: {
    title: 'Create a wallet to fund escrow',
    body: 'Escrow is funded from one of your organization’s wallets. Create one, then choose it below.',
    to: '/sell',
  },
}

const SELLER: Record<Need['kind'], string> = {
  sign_in: 'The seller’s account is not active.',
  kyc: 'The seller has not finished identity verification, so they cannot be paid yet.',
  tax_form: 'The seller has no tax form on file, so they cannot be paid yet.',
  payout_wallet: 'The seller has not set a wallet to be paid into.',
  billing: 'The seller’s account is not in good standing.',
  payer_wallet: 'The seller cannot receive escrow payments yet.',
}

/** One step per need, buyer's own first (those are the ones the reader can fix). */
export function steps(c: Clearance): Step[] {
  const mine = c.needs.filter((n) => n.party === 'buyer')
  const theirs = c.needs.filter((n) => n.party === 'seller')
  return [
    ...mine.map((n) => ({ ...BUYER[n.kind], body: n.detail || BUYER[n.kind].body })),
    ...theirs.map((n) => ({ title: 'Waiting on the seller', body: n.detail || SELLER[n.kind], to: null })),
  ]
}

/** The withholding line, or null when nothing is withheld. */
export function withholding(c: Clearance): string | null {
  if (!c.withholding || c.withholding.rate <= 0) return null
  return `${percent(c.withholding.rate)} of this payment is withheld and sent to the IRS as backup withholding: ${c.withholding.reason}`
}

/** Whether checkout may proceed. */
export function cleared(c: Clearance): boolean {
  return c.status === 'clear' && c.needs.length === 0
}

/** The headline for the clearance step. */
export function headline(c: Clearance): string {
  if (cleared(c)) return 'Cleared to pay'
  if (c.status === 'blocked') return c.reason || 'This purchase is not allowed'
  const n = c.needs.length
  return `${n} thing${n === 1 ? '' : 's'} to finish before paying`
}
