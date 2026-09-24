import { cleared, facts, headline, net, todos, withholding } from '~/lib/clearance'
import type { Clearance, Step } from '~/lib/market'

const rule = { code: 'r', reason: '' }
const decided: Clearance = {
  id: 'clr_1',
  payer: 'acme',
  payee: 'orbital',
  amount: '250',
  rail: 'chain',
  allowed: true,
  status: 'us',
  required_before_payment: [],
  reporting_obligations: [],
  settlement_methods: [{ rail: 'ledger', net: '190.00', withheld: '60.00', rule }],
  withholding: { rate: '24', amount: '60.00', reason: 'No TIN on file (IRC §3406).', rule },
  facts_required: [],
  decidedAt: 1,
  notice: '',
}
const step = (who: string, what: string, where?: string): Step => ({ code: who, who, what, where, rule })

describe('clearance', () => {
  it('clears only when the platform allows it with nothing required first', () => {
    expect(cleared(decided)).toBe(true)
    expect(headline(decided)).toBe('Cleared to pay')
    expect(cleared({ ...decided, required_before_payment: [step('payer', 'Verify.')] })).toBe(false)
    expect(cleared({ ...decided, allowed: false })).toBe(false)
  })

  it('attributes each step, the reader’s own first, and points at the page that does it', () => {
    const t = todos([
      step('payee', 'The payee’s founders complete identity verification.'),
      step('Hanzo platform reviewer', 'A possible sanctions match on the payer is decided.'),
      step('payer', 'The payer’s founders verify.', 'POST /v1/company/kyc'),
      step('org', 'Certify a W-9.', 'PUT /v1/tax/profile'),
      step('none', 'No payment may be made.'),
      step('payer', 'Top up.', 'POST /v1/billing/topup'),
      step('payer', 'Something else.', 'POST /v1/other'),
      step('payer', 'Fund a wallet.', 'POST /v1/wallet'),
      step('Stripe', 'An outside party acts.'),
    ])
    expect(t.map((x) => [x.title, x.to])).toEqual([
      ['You', '/sell'],
      ['You', '/sell'],
      ['You', 'https://console.hanzo.ai/billing'],
      ['You', null],
      ['You', '/sell'],
      ['The seller', null],
      ['Hanzo', null],
      ['No one can', null],
      ['Stripe', null],
    ])
    expect(todos([step('payer', 'x')])[0].to).toBeNull()
  })

  it('counts what blocks, and says so when nothing can', () => {
    const held: Clearance = {
      ...decided,
      allowed: false,
      required_before_payment: [step('payer', 'a'), step('payee', 'b')],
      facts_required: [
        { code: 'platform', question: 'Does the payer operate the platform?', blocks: true, rule },
        { code: 'performed', question: 'Where is it performed?', blocks: false, rule },
      ],
    }
    expect(headline(held)).toBe('3 things to finish before paying')
    expect(headline({ ...held, required_before_payment: [step('payer', 'a')], facts_required: [] })).toBe('1 thing to finish before paying')
    expect(headline({ ...held, required_before_payment: [], facts_required: [] })).toBe('This payment cannot clear now')
    expect(facts(held)).toEqual([
      { question: 'Does the payer operate the platform?', blocks: true },
      { question: 'Where is it performed?', blocks: false },
    ])
  })

  it('states what is withheld and what the seller nets', () => {
    expect(withholding(decided)).toBe('24% ($60.00) of this payment is withheld: No TIN on file (IRC §3406).')
    expect(withholding({ ...decided, withholding: { rate: '30', reason: 'Chapter 3.', rule } })).toBe(
      '30% of this payment is withheld: Chapter 3.',
    )
    expect(withholding({ ...decided, withholding: { rate: '0', amount: '0.00', reason: 'Goods.', rule } })).toBeNull()
    expect(withholding({ ...decided, withholding: { reason: 'Undetermined.', rule } })).toBeNull()
    expect(net(decided)).toBe('The seller receives $190.00 after $60.00 is withheld.')
    expect(net({ ...decided, settlement_methods: [{ rail: 'ledger', net: '250.00', withheld: '0.00', rule }] })).toBe(
      'The seller receives $250.00.',
    )
    expect(net({ ...decided, settlement_methods: [] })).toBeNull()
  })
})
