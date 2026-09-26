import { cents, dollars, each, free, percent, sum, usd, valid } from '~/lib/money'

describe('money', () => {
  it('accepts exact decimals only', () => {
    expect(valid('0.0025')).toBe(true)
    expect(valid('12')).toBe(true)
    expect(valid(' 3.50 ')).toBe(true)
    expect(valid('-1')).toBe(false)
    expect(valid('1e3')).toBe(false)
    expect(valid('0.0000000000000000001')).toBe(false)
  })

  it('treats zero, empty and garbage as free', () => {
    expect(free('0')).toBe(true)
    expect(free('0.000')).toBe(true)
    expect(free('')).toBe(true)
    expect(free(undefined)).toBe(true)
    expect(free('abc')).toBe(true)
    expect(free('0.0001')).toBe(false)
  })

  it('sums without floating point error', () => {
    expect(sum(['0.1', '0.2'])).toBe('0.3')
    expect(sum(['0.0025', '0.0025', '120'])).toBe('120.005')
    expect(sum([])).toBe('0')
    expect(sum(['1', 'nope'])).toBe('1')
  })

  it('formats USD with at least two places and never rounds a price away', () => {
    expect(usd('250')).toBe('$250.00')
    expect(usd('0.0025')).toBe('$0.0025')
    expect(usd('1234567.5')).toBe('$1,234,567.50')
    expect(usd('bad')).toBe('$0.00')
    expect(usd('3', 'EUR')).toBe('3.00 EUR')
    expect(cents(125_000)).toBe('$1,250.00')
  })

  it('reads a price the way the listing is sold', () => {
    expect(each('250', 'agent')).toBe('$250.00 per job')
    expect(each('40', 'skill')).toBe('$40.00 per job')
    expect(each('0.0025', 'tool')).toBe('$0.0025 per call')
    expect(percent(0.24)).toBe('24%')
    expect(percent(0.305)).toBe('30.5%')
  })

  it('states a job amount to the cent, or not at all', () => {
    expect(dollars('250')).toBe('250.00')
    expect(dollars(' 50000 ')).toBe('50000.00')
    expect(dollars('12.5')).toBe('12.50')
    expect(dollars('0.07')).toBe('0.07')
    expect(dollars('0.0025')).toBeNull()
    expect(dollars('0')).toBeNull()
    expect(dollars('')).toBeNull()
    expect(dollars('-3')).toBeNull()
  })
})
