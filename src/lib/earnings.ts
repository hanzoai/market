// What a seller earned, from what the platform answers: the year's gross from
// its economic events (GET /v1/marketplace/seller), the x402 receipts paid to the
// org split by what they bought, and the jobs whose amount is still set aside.
// A figure is drawn only from sources that answered: a source that did not is
// a figure the page does not have, never a zero.

import { held } from '~/lib/job'
import type { Job, Receipt, Statement } from '~/lib/market'
import { sum } from '~/lib/money'

/**
 * The most rows one read answers: GET /v1/x402/settlements the newest 1000
 * receipts (apps/x402 maxReceipts), GET /v1/marketplace/jobs 500 jobs
 * (apps/marketplace maxJobs), with no total. A list that long may have been cut.
 */
export const RECEIPTS = 1000
export const JOBS = 500

/** How a sum over a list the platform may have cut reads: a floor, never the total. */
export const floor = (list: unknown[], most: number): string => (list.length >= most ? 'at least ' : '')

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
