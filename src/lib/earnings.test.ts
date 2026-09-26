import { floor, forJob, JOBS, lead, RECEIPTS, setAside, split } from '~/lib/earnings'
import type { Job, Receipt, Statement } from '~/lib/market'

const receipt = (amount: string, resource: string): Receipt => ({
  id: amount + resource,
  resource,
  payer: 'p',
  payee: '0x',
  payeeOrg: 'acme',
  amount,
  network: 'eip155:36963',
  settledVia: 'ledger',
  settledAt: 0,
})
const job = (amount: string, status: Job['status'], ending?: Job['ending']): Job => ({
  id: amount + status,
  listing: 'l',
  title: 't',
  buyerOrg: 'b',
  sellerOrg: 'acme',
  amount,
  currency: 'USD',
  category: 'service',
  status,
  ending,
  brief: '',
  review: 259_200,
  clearance: 'clr_1',
  escrow: { rail: 'x402', network: 'eip155:36963', contract: '0x' },
  history: [],
  createdAt: 0,
  updatedAt: 0,
})

describe('earnings', () => {
  it('splits receipts into per-call payments and jobs paid at release', () => {
    const paid = [receipt('0.0025', 'tool:geocode'), receipt('0.0025', 'tool:geocode'), receipt('120', 'job:job_3')]
    expect(split(paid)).toEqual({ perCall: '0.005', jobs: '120' })
    expect(split([])).toEqual({ perCall: '0', jobs: '0' })
    expect(forJob({ resource: 'job:job_3' })).toBe(true)
    expect(forJob({ resource: 'tool:job' })).toBe(false)
  })

  it('counts as set aside only work that is still held for the seller', () => {
    const work = [
      job('40', 'accepted'),
      job('10', 'disputed'),
      job('5', 'open'),
      job('7', 'delivered', 'refunded'),
      job('120', 'released'),
      job('9', 'quoted'),
      job('3', 'cancelled'),
    ]
    expect(setAside(work)).toBe('55')
  })

  it('leads a 1099 with box 1', () => {
    const s = { boxes: [{ box: '4', label: 'Withheld', cents: 5 }, { box: '1', label: 'Nonemployee compensation', cents: 100 }] } as Statement
    expect(lead(s)).toEqual({ box: '1', label: 'Nonemployee compensation', cents: 100 })
    expect(lead({ boxes: [{ box: '3', label: 'Other income', cents: 7 }] } as Statement)?.cents).toBe(7)
    expect(lead({ boxes: [] as Statement['boxes'] } as Statement)).toBeNull()
  })

  // Red market-14: cloud answers the newest 1000 receipts (500 jobs) and no total,
  // and a sum of that page was shown as the year's.
  it('reads a sum over a list the platform may have cut as a floor', () => {
    expect([RECEIPTS, JOBS]).toEqual([1000, 500])
    expect(floor(Array.from({ length: 1000 }), RECEIPTS)).toBe('at least ')
    expect(floor(Array.from({ length: 999 }), RECEIPTS)).toBe('')
    expect(floor(Array.from({ length: 500 }), JOBS)).toBe('at least ')
    expect(floor([], JOBS)).toBe('')
  })
})
