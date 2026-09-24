// What clearance asks for, in plain words. The platform decides a payment before
// it moves (POST /v1/principal/clearance) and names each step in its own words;
// this file is the one place a step is attributed to someone the reader knows and
// pointed at the page that satisfies it, so checkout and seller onboarding say
// the same thing about the same requirement.

import type { Clearance, Step } from '~/lib/market'
import { usd } from '~/lib/money'

export interface Todo {
  title: string
  body: string
  /** Where to satisfy it: a storefront path, or null when only someone else can. */
  to: string | null
}

/** The page that satisfies an operation the platform names in `where`. */
function page(where: string | undefined): string | null {
  if (!where) return null
  if (where.includes('/v1/company/kyc') || where.includes('/v1/tax/profile')) return '/sell'
  if (where.includes('/v1/wallet')) return '/sell'
  if (where.includes('/v1/billing')) return 'https://console.hanzo.ai/billing'
  return null
}

/** Who a step falls to, from the reader's side. */
function party(who: string): string {
  if (who === 'payer' || who === 'org') return 'You'
  if (who === 'payee') return 'The seller'
  if (who === 'none') return 'No one can'
  if (who.startsWith('Hanzo')) return 'Hanzo'
  return who
}

const mine = (s: Step) => s.who === 'payer' || s.who === 'org'

/** One to-do per step the platform returned, the reader's own first. */
export function todos(steps: Step[]): Todo[] {
  return [...steps.filter(mine), ...steps.filter((s) => !mine(s))].map((s) => ({
    title: party(s.who),
    body: s.what,
    to: mine(s) ? page(s.where) : null,
  }))
}

/** The questions a decision turned on that the platform could not answer. */
export function facts(c: Clearance): { question: string; blocks: boolean }[] {
  return c.facts_required.map((f) => ({ question: f.question, blocks: f.blocks }))
}

/** The withholding line, or null when nothing is withheld. */
export function withholding(c: Clearance): string | null {
  const w = c.withholding
  const rate = Number(w.rate ?? '0')
  if (!w.rate || !Number.isFinite(rate) || rate <= 0) return null
  const amount = w.amount ? ` (${usd(w.amount)})` : ''
  return `${w.rate}%${amount} of this payment is withheld: ${w.reason}`
}

/** What the seller receives, from the first way the payment may settle. */
export function net(c: Clearance): string | null {
  const m = c.settlement_methods[0]
  if (!m) return null
  return `The seller receives ${usd(m.net)}${Number(m.withheld) > 0 ? ` after ${usd(m.withheld)} is withheld` : ''}.`
}

/** Whether checkout may proceed. */
export function cleared(c: Clearance): boolean {
  return c.allowed && c.required_before_payment.length === 0
}

/** The headline for the clearance step. */
export function headline(c: Clearance): string {
  if (cleared(c)) return 'Cleared to pay'
  const n = c.required_before_payment.length + c.facts_required.filter((f) => f.blocks).length
  if (n === 0) return 'This payment cannot clear now'
  return `${n} thing${n === 1 ? '' : 's'} to finish before paying`
}
