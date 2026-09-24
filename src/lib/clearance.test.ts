import { cleared, headline, steps, withholding } from '~/lib/clearance'
import type { Clearance } from '~/lib/market'

const clear: Clearance = { status: 'clear', needs: [], withholding: null }

describe('clearance', () => {
  it('clears only when the platform says clear with nothing needed', () => {
    expect(cleared(clear)).toBe(true)
    expect(headline(clear)).toBe('Cleared to pay')
    expect(cleared({ ...clear, needs: [{ kind: 'kyc', party: 'buyer' }] })).toBe(false)
  })

  it('puts the buyer’s own steps first, in plain words', () => {
    const c: Clearance = {
      status: 'needs',
      needs: [
        { kind: 'payout_wallet', party: 'seller' },
        { kind: 'tax_form', party: 'buyer' },
        { kind: 'billing', party: 'buyer', detail: 'Your balance is $0.' },
      ],
      withholding: null,
    }
    const s = steps(c)
    expect(s.map((x) => x.title)).toEqual(['Add a tax form', 'Add a way to pay', 'Waiting on the seller'])
    expect(s[0].to).toBe('/sell')
    expect(s[1].body).toBe('Your balance is $0.')
    expect(s[2]).toMatchObject({ body: 'The seller has not set a wallet to be paid into.', to: null })
    expect(headline(c)).toBe('3 things to finish before paying')
    expect(headline({ ...c, needs: [c.needs[0]] })).toBe('1 thing to finish before paying')
  })

  it('says why a purchase is blocked', () => {
    expect(headline({ status: 'blocked', needs: [], withholding: null, reason: 'Sanctioned region' })).toBe('Sanctioned region')
    expect(headline({ status: 'blocked', needs: [], withholding: null })).toBe('This purchase is not allowed')
  })

  it('states backup withholding when there is any', () => {
    expect(withholding(clear)).toBeNull()
    expect(withholding({ ...clear, withholding: { rate: 0, reason: 'x' } })).toBeNull()
    expect(withholding({ ...clear, withholding: { rate: 0.24, reason: 'no TIN on file' } })).toBe(
      '24% of this payment is withheld and sent to the IRS as backup withholding: no TIN on file',
    )
  })
})
