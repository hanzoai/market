// The escrow job lifecycle: open → accepted → delivered → released | disputed.
// Funds are locked when the job opens and move only on release (to the seller)
// or by the resolution of a dispute.

import type { Job, JobAct, JobStatus } from '~/lib/market'

export type Stage = 'done' | 'current' | 'todo' | 'failed'

const ORDER: JobStatus[] = ['open', 'accepted', 'delivered', 'released']

export const WORDS: Record<JobStatus, string> = {
  open: 'Open — funds held in escrow, waiting for the seller',
  accepted: 'Accepted — the seller is working',
  delivered: 'Delivered — waiting for the buyer to release',
  released: 'Released — the seller was paid',
  disputed: 'Disputed — funds stay in escrow until resolved',
}

/** The four steps drawn for a job, with where it stands on each. */
export function stages(status: JobStatus): { status: JobStatus; label: string; stage: Stage }[] {
  const last: JobStatus = status === 'disputed' ? 'disputed' : 'released'
  const path: JobStatus[] = [...ORDER.slice(0, 3), last]
  const at = status === 'disputed' ? 3 : ORDER.indexOf(status)
  return path.map((s, i) => ({
    status: s,
    label: s[0].toUpperCase() + s.slice(1),
    stage:
      s === 'disputed' ? 'failed' : i < at ? 'done' : i === at ? (s === 'released' ? 'done' : 'current') : 'todo',
  }))
}

/** What `role` may do next. The platform enforces the same rule; this only hides what it would refuse. */
export function acts(job: Pick<Job, 'status'>, role: 'buyer' | 'seller'): JobAct[] {
  if (role === 'seller') {
    if (job.status === 'open') return ['accept']
    if (job.status === 'accepted') return ['deliver']
    return []
  }
  if (job.status === 'delivered') return ['release', 'dispute']
  if (job.status === 'accepted') return ['dispute']
  return []
}

/** Which side of `job` the acting org is on, or null when neither. */
export function side(job: Pick<Job, 'buyerOrg' | 'sellerOrg'>, org: string | null): 'buyer' | 'seller' | null {
  if (!org) return null
  if (job.sellerOrg === org) return 'seller'
  if (job.buyerOrg === org) return 'buyer'
  return null
}

export function settled(status: JobStatus): boolean {
  return status === 'released' || status === 'disputed'
}
