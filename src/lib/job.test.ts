import type { Job, JobStatus } from '~/lib/market'
import { acts, held, rateable, side, stages, WORDS, words } from '~/lib/job'

const went = (...path: JobStatus[]): Pick<Job, 'status' | 'history'> => ({
  status: path.at(-1)!,
  history: path.map((status, i) => ({ status, at: i, by: 'x' })),
})
const drawn = (j: Pick<Job, 'status' | 'ending' | 'history'>) => stages(j).map((s) => [s.label, s.stage])

describe('job lifecycle', () => {
  it('draws open → accepted → delivered → released', () => {
    expect(stages(went('quoted', 'open')).map((s) => s.stage)).toEqual(['current', 'todo', 'todo', 'todo'])
    expect(stages(went('quoted', 'open', 'accepted')).map((s) => s.stage)).toEqual(['done', 'current', 'todo', 'todo'])
    expect(stages(went('open', 'accepted', 'delivered')).map((s) => s.stage)).toEqual(['done', 'done', 'current', 'todo'])
    expect(drawn(went('open', 'accepted', 'delivered', 'released'))).toEqual([
      ['Open', 'done'],
      ['Accepted', 'done'],
      ['Delivered', 'done'],
      ['Released', 'done'],
    ])
  })

  it('draws a quote as the step before the job opens', () => {
    expect(drawn(went('quoted'))).toEqual([
      ['Quoted', 'current'],
      ['Open', 'todo'],
      ['Accepted', 'todo'],
      ['Delivered', 'todo'],
      ['Released', 'todo'],
    ])
  })

  // Red market-9: a job disputed while it was accepted was drawn as delivered.
  it('draws the steps a job took, so a dispute before delivery shows no delivery', () => {
    expect(drawn(went('open', 'accepted', 'disputed'))).toEqual([
      ['Open', 'done'],
      ['Accepted', 'done'],
      ['Disputed', 'failed'],
    ])
    expect(drawn(went('open', 'accepted', 'delivered', 'disputed'))).toEqual([
      ['Open', 'done'],
      ['Accepted', 'done'],
      ['Delivered', 'done'],
      ['Disputed', 'failed'],
    ])
    expect(drawn(went('open', 'accepted', 'disputed', 'released')).at(-1)).toEqual(['Released', 'done'])
  })

  // Red market-7: the statuses cloud answers besides the four of the plain path.
  it('has words, a step and no next move for every ending', () => {
    for (const s of ['quoted', 'open', 'accepted', 'delivered', 'released', 'disputed', 'declined', 'cancelled', 'refunded'] as JobStatus[])
      expect(WORDS[s]).toBeTruthy()
    expect(drawn(went('open', 'declined'))).toEqual([
      ['Open', 'done'],
      ['Declined', 'failed'],
    ])
    expect(drawn(went('open', 'cancelled')).at(-1)).toEqual(['Cancelled', 'failed'])
    expect(drawn(went('open', 'accepted', 'refunded')).at(-1)).toEqual(['Refunded', 'failed'])
    for (const s of ['quoted', 'released', 'declined', 'cancelled', 'refunded'] as JobStatus[]) {
      expect(acts({ status: s }, 'buyer')).toEqual([])
      expect(acts({ status: s }, 'seller')).toEqual([])
    }
  })

  it('draws an ending still being paid back, and takes no step meanwhile', () => {
    const j = { ...went('open', 'accepted'), ending: 'refunded' as const }
    expect(drawn(j)).toEqual([
      ['Open', 'done'],
      ['Accepted', 'done'],
      ['Refunded', 'failed'],
    ])
    expect(words(j)).toBe('Refunded — waiting for the payment rail to return the amount to the buyer')
    expect(words({ status: 'open' })).toBe(WORDS.open)
    expect(acts(j, 'seller')).toEqual([])
    expect(acts(j, 'buyer')).toEqual([])
    expect(held(j)).toBe(false)
  })

  it('reads a job without its history as the plain way', () => {
    expect(drawn({ status: 'delivered', history: [] }).map(([, st]) => st)).toEqual(['done', 'done', 'current', 'todo'])
  })

  it('offers each side only the moves cloud allows', () => {
    expect(acts({ status: 'open' }, 'seller')).toEqual(['accept', 'decline'])
    expect(acts({ status: 'accepted' }, 'seller')).toEqual(['deliver', 'dispute', 'refund'])
    expect(acts({ status: 'delivered' }, 'seller')).toEqual(['dispute', 'refund'])
    expect(acts({ status: 'disputed' }, 'seller')).toEqual(['refund'])
    expect(acts({ status: 'open' }, 'buyer')).toEqual(['cancel'])
    expect(acts({ status: 'accepted' }, 'buyer')).toEqual(['release', 'dispute'])
    expect(acts({ status: 'delivered' }, 'buyer')).toEqual(['release', 'dispute'])
    expect(acts({ status: 'disputed' }, 'buyer')).toEqual(['release'])
  })

  it('knows which side an org is on, what is held and what may be rated', () => {
    const j = { buyerOrg: 'acme', sellerOrg: 'orbital' }
    expect(side(j, 'acme')).toBe('buyer')
    expect(side(j, 'orbital')).toBe('seller')
    expect(side(j, 'globex')).toBeNull()
    expect(side(j, null)).toBeNull()
    expect((['open', 'accepted', 'delivered', 'disputed'] as JobStatus[]).every((status) => held({ status }))).toBe(true)
    expect((['quoted', 'released', 'refunded'] as JobStatus[]).some((status) => held({ status }))).toBe(false)
    expect(rateable(went('open', 'accepted', 'delivered', 'released'))).toBe(true)
    expect(rateable(went('open', 'accepted', 'refunded'))).toBe(true)
    expect(rateable(went('open', 'cancelled'))).toBe(false)
    expect(rateable({ status: 'refunded', history: [] })).toBe(false)
  })
})
