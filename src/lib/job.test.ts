import { acts, settled, side, stages, WORDS } from '~/lib/job'

describe('job lifecycle', () => {
  it('draws open → accepted → delivered → released', () => {
    expect(stages('open').map((s) => s.stage)).toEqual(['current', 'todo', 'todo', 'todo'])
    expect(stages('accepted').map((s) => s.stage)).toEqual(['done', 'current', 'todo', 'todo'])
    expect(stages('delivered').map((s) => s.stage)).toEqual(['done', 'done', 'current', 'todo'])
    expect(stages('released').map((s) => [s.label, s.stage])).toEqual([
      ['Open', 'done'],
      ['Accepted', 'done'],
      ['Delivered', 'done'],
      ['Released', 'done'],
    ])
  })

  it('ends a dispute on its own step', () => {
    expect(stages('disputed').map((s) => [s.label, s.stage])).toEqual([
      ['Open', 'done'],
      ['Accepted', 'done'],
      ['Delivered', 'done'],
      ['Disputed', 'failed'],
    ])
    expect(WORDS.disputed).toMatch(/stay in escrow until resolved/)
  })

  it('offers each side only its next move', () => {
    expect(acts({ status: 'open' }, 'seller')).toEqual(['accept'])
    expect(acts({ status: 'accepted' }, 'seller')).toEqual(['deliver'])
    expect(acts({ status: 'delivered' }, 'seller')).toEqual([])
    expect(acts({ status: 'open' }, 'buyer')).toEqual([])
    expect(acts({ status: 'accepted' }, 'buyer')).toEqual(['dispute'])
    expect(acts({ status: 'delivered' }, 'buyer')).toEqual(['release', 'dispute'])
    expect(acts({ status: 'released' }, 'buyer')).toEqual([])
  })

  it('knows which side an org is on', () => {
    const j = { buyerOrg: 'acme', sellerOrg: 'orbital' }
    expect(side(j, 'acme')).toBe('buyer')
    expect(side(j, 'orbital')).toBe('seller')
    expect(side(j, 'globex')).toBeNull()
    expect(side(j, null)).toBeNull()
    expect(settled('released')).toBe(true)
    expect(settled('disputed')).toBe(true)
    expect(settled('delivered')).toBe(false)
  })
})
