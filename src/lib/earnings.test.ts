import { lead, totals } from '~/lib/earnings'
import type { Job, Receipt, Statement } from '~/lib/market'

const at = (y: number) => Date.UTC(y, 5, 1) / 1000
const receipt = (amount: string, y: number): Receipt => ({
  id: amount,
  resource: 'tool:x',
  payer: 'p',
  payee: '0x',
  payeeOrg: 'acme',
  amount,
  network: 'lux',
  settledVia: 'ledger',
  settledAt: at(y),
})
const job = (amount: string, status: Job['status'], y: number): Job => ({
  id: amount + status,
  listing: 'l',
  title: 't',
  buyerOrg: 'b',
  sellerOrg: 'acme',
  amount,
  currency: 'USD',
  status,
  brief: '',
  escrow: { network: 'lux', contract: '0x' },
  history: [],
  createdAt: at(y),
  updatedAt: at(y),
})

describe('earnings', () => {
  it('sums the year: per call, escrow released, escrow held', () => {
    const t = totals(
      [receipt('0.0025', 2026), receipt('0.0025', 2026), receipt('9', 2025)],
      [job('120', 'released', 2026), job('50', 'released', 2025), job('40', 'accepted', 2025), job('10', 'disputed', 2026)],
      2026,
    )
    expect(t).toEqual({ x402: '0.005', escrow: '120', held: '40', all: '120.005' })
  })

  it('leads a 1099 with box 1', () => {
    const s = { boxes: [{ box: '4', label: 'Withheld', cents: 5 }, { box: '1', label: 'Nonemployee compensation', cents: 100 }] } as Statement
    expect(lead(s)).toEqual({ box: '1', label: 'Nonemployee compensation', cents: 100 })
    expect(lead({ boxes: [{ box: '3', label: 'Other income', cents: 7 }] } as Statement)?.cents).toBe(7)
    expect(lead({ boxes: [] as Statement['boxes'] } as Statement)).toBeNull()
  })
})
