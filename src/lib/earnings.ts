// What a seller earned, from what the platform answers: the year's gross from
// its economic events (GET /v1/marketplace/seller), the x402 receipts paid to the
// org split by what they bought, and the jobs whose amount is still set aside.
// A figure is drawn only from sources that answered: a source that did not is
// a figure the page does not have, never a zero.

import { held } from '~/lib/job'
import type { Job, Receipt, Statement } from '~/lib/market'
import { sum } from '~/lib/money'

/** A receipt for a job, paid at release; anything else was paid per call. */
export const forJob = (r: Pick<Receipt, 'resource'>) => r.resource.startsWith('job:')

/** The x402 receipts, split: paid per call, and paid for jobs. */
export function split(paid: Receipt[]): { perCall: string; jobs: string } {
  return { perCall: sum(paid.filter((r) => !forJob(r)).map((r) => r.amount)), jobs: sum(paid.filter(forJob).map((r) => r.amount)) }
}

/** What buyers have set aside for this seller's open work: not paid yet, and not the seller's until release. */
export function setAside(work: Job[]): string {
  return sum(work.filter(held).map((j) => j.amount))
}

/** The box a 1099 leads with: box 1 (nonemployee compensation on a 1099-NEC, rents on a 1099-MISC). */
export function lead(s: Statement): { label: string; cents: number } | null {
  return s.boxes.find((b) => b.box === '1') ?? s.boxes[0] ?? null
}
