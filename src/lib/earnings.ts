// What a seller earned, from what the platform answers: x402 receipts paid to
// the org, and escrow jobs it was hired for.

import type { Job, Receipt, Statement } from '~/lib/market'
import { sum } from '~/lib/money'

const inYear = (at: number, year: number) => new Date(at * 1000).getUTCFullYear() === year

/**
 * Totals for `year`: per-call settlements, escrow released that year, and what
 * is still held in escrow (not yet released, whatever the year).
 */
export function totals(paid: Receipt[], work: Job[], year: number): { x402: string; escrow: string; held: string; all: string } {
  const x402 = sum(paid.filter((r) => inYear(r.settledAt, year)).map((r) => r.amount))
  const escrow = sum(work.filter((j) => j.status === 'released' && inYear(j.updatedAt, year)).map((j) => j.amount))
  const held = sum(work.filter((j) => j.status === 'open' || j.status === 'accepted' || j.status === 'delivered').map((j) => j.amount))
  return { x402, escrow, held, all: sum([x402, escrow]) }
}

/** The box a 1099 leads with: box 1 (nonemployee compensation on a 1099-NEC, rents on a 1099-MISC). */
export function lead(s: Statement): { label: string; cents: number } | null {
  return s.boxes.find((b) => b.box === '1') ?? s.boxes[0] ?? null
}
