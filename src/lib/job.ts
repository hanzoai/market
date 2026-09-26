// A job's lifecycle, as cloud runs it (apps/marketplace/jobs.go):
//
//   quoted ─pay─▶ open ─accept─▶ accepted ─deliver─▶ delivered ─release─▶ released
//                  │ cancel, decline   │ refund, dispute   │ refund, dispute
//                  ▼                   ▼                   ▼
//        cancelled / declined      refunded ◀─refund── disputed ─release─▶ released
//
// The amount is set aside in the buyer's wallet when the job opens and paid to
// the seller once, at release; every other ending returns it. What was drawn and
// what can be done next come from the job itself — its history for the path it
// took, its status and ending for where it stands.

import type { Job, JobAct, JobStatus } from '~/lib/market'

export type Stage = 'done' | 'current' | 'todo' | 'failed'

/** The way a job goes when nothing goes wrong. */
const PATH: JobStatus[] = ['open', 'accepted', 'delivered', 'released']

/** Where a job ends unpaid. */
const UNPAID = new Set<JobStatus>(['declined', 'cancelled', 'refunded'])

export const WORDS: Record<JobStatus, string> = {
  quoted: 'Quoted — not paid yet; the quote lapses after an hour',
  open: 'Open — the amount is set aside in the buyer’s wallet, waiting for the seller',
  accepted: 'Accepted — the seller is working',
  delivered: 'Delivered — waiting for the buyer to release',
  released: 'Released — the seller was paid',
  disputed: 'Disputed — nothing is paid until a party gives way or the arbiter rules',
  declined: 'Declined — the seller turned it down, and the amount went back to the buyer',
  cancelled: 'Cancelled — the amount went back to the buyer',
  refunded: 'Refunded — the seller was not paid, and the amount went back to the buyer',
}

/** The sentence for where a job stands, including an ending still being paid back. */
export function words(job: Pick<Job, 'status' | 'ending'>): string {
  if (job.ending) return `${label(job.ending)} — waiting for the payment rail to return the amount to the buyer`
  return WORDS[job.status]
}

const label = (s: JobStatus) => s[0].toUpperCase() + s.slice(1)

/** The steps drawn for a job: the ones it took, then the ones still ahead of it. */
export function stages(job: Pick<Job, 'status' | 'ending' | 'history'>): { status: JobStatus; label: string; stage: Stage }[] {
  const took: JobStatus[] = []
  for (const h of job.history ?? []) if (h.status !== 'quoted' && !took.includes(h.status)) took.push(h.status)
  // A job read without its history went the plain way to where it stands.
  if (!took.length && PATH.includes(job.status)) took.push(...PATH.slice(0, PATH.indexOf(job.status)))
  if (job.status !== 'quoted' && !took.includes(job.status)) took.push(job.status)
  const now = job.ending ?? job.status
  const over = now === 'released' || UNPAID.has(now)
  const ahead = over || now === 'disputed' ? [] : PATH.filter((s) => !took.includes(s) && s !== job.ending)
  const drawn = job.status === 'quoted' ? (['quoted', ...PATH] as JobStatus[]) : [...took, ...(job.ending ? [job.ending] : []), ...ahead]
  return drawn.map((s) => ({
    status: s,
    label: label(s),
    stage:
      s === now
        ? now === 'released'
          ? 'done'
          : UNPAID.has(now) || now === 'disputed'
            ? 'failed'
            : 'current'
        : took.includes(s)
          ? 'done'
          : 'todo',
  }))
}

/**
 * What `role` may do next. Cloud enforces the same rule (and the deadline and
 * review window besides); this only hides what it would refuse. A job with an
 * ending takes no step until the money is back.
 */
export function acts(job: Pick<Job, 'status' | 'ending'>, role: 'buyer' | 'seller'): JobAct[] {
  if (job.ending) return []
  if (role === 'seller') {
    switch (job.status) {
      case 'open':
        return ['accept', 'decline']
      case 'accepted':
        return ['deliver', 'dispute', 'refund']
      case 'delivered':
        return ['dispute', 'refund']
      case 'disputed':
        return ['refund']
      default:
        return []
    }
  }
  switch (job.status) {
    case 'open':
      return ['cancel']
    case 'accepted':
    case 'delivered':
      return ['release', 'dispute']
    case 'disputed':
      return ['release']
    default:
      return []
  }
}

/** Which side of `job` the acting org is on, or null when neither. */
export function side(job: Pick<Job, 'buyerOrg' | 'sellerOrg'>, org: string | null): 'buyer' | 'seller' | null {
  if (!org) return null
  if (job.sellerOrg === org) return 'seller'
  if (job.buyerOrg === org) return 'buyer'
  return null
}

/** The amount is still set aside for the seller: open, being worked, delivered or disputed, and not ending. */
export function held(job: Pick<Job, 'status' | 'ending'>): boolean {
  return !job.ending && (job.status === 'open' || job.status === 'accepted' || job.status === 'delivered' || job.status === 'disputed')
}

/** A party may rate the other: the job was released, or refunded after the seller took it on. */
export function rateable(job: Pick<Job, 'status' | 'history'>): boolean {
  if (job.status === 'released') return true
  return job.status === 'refunded' && (job.history ?? []).some((h) => h.status === 'accepted')
}
