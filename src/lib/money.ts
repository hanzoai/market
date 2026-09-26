// Money is an exact decimal string on the wire ("0.0025"). It is summed and
// shown without ever passing through a float, because a per-call price has more
// places than a double keeps honest.

import type { Kind } from '~/lib/market'

const SCALE = 18
const DECIMAL = /^\d+(\.\d{1,18})?$/

export function valid(amount: string): boolean {
  return DECIMAL.test(amount.trim())
}

function units(amount: string): bigint {
  const [whole = '0', frac = ''] = amount.trim().split('.')
  return BigInt(whole) * 10n ** BigInt(SCALE) + BigInt(frac.padEnd(SCALE, '0') || '0')
}

function decimal(n: bigint): string {
  const neg = n < 0n
  const abs = neg ? -n : n
  const whole = abs / 10n ** BigInt(SCALE)
  const frac = (abs % 10n ** BigInt(SCALE)).toString().padStart(SCALE, '0').replace(/0+$/, '')
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`
}

export function free(amount: string | undefined): boolean {
  return !amount || !valid(amount) || units(amount) === 0n
}

/** Sum exact decimals. */
export function sum(amounts: string[]): string {
  return decimal(amounts.filter(valid).reduce((acc, a) => acc + units(a), 0n))
}

/** `$12.50`, `$0.0025`: at least two places, never rounded away. */
export function usd(amount: string, currency = 'USD'): string {
  const exact = valid(amount) ? decimal(units(amount)) : '0'
  const [whole = '0', frac = ''] = exact.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const shown = `${grouped}.${frac.padEnd(2, '0')}`
  return currency === 'USD' ? `$${shown}` : `${shown} ${currency}`
}

/** Cents (1099 boxes) as dollars. */
export function cents(n: number): string {
  return usd((n / 100).toFixed(2))
}

/** How a listing's price reads: a tool is paid per call; everything else is hired per job. */
export function each(amount: string, kind: Kind): string {
  return `${usd(amount)} per ${kind === 'tool' ? 'call' : 'job'}`
}

/** A positive amount to the cent as "250.00" — what a job and a clearance take — or null. */
export function dollars(amount: string): string | null {
  if (!valid(amount) || free(amount)) return null
  const n = units(amount)
  const cent = 10n ** BigInt(SCALE - 2)
  if (n % cent !== 0n) return null
  const c = n / cent
  return `${c / 100n}.${String(c % 100n).padStart(2, '0')}`
}

/** An amount in an asset's atomic units ("250.00" at 6 places is 250000000n), or null when it is not exact at that scale. */
export function atomic(amount: string, places: number): bigint | null {
  if (!valid(amount) || places < 0 || places > SCALE) return null
  const step = 10n ** BigInt(SCALE - places)
  const n = units(amount)
  return n % step === 0n ? n / step : null
}

/** Atomic units at `places` back to an exact decimal. */
export function scaled(n: bigint, places: number): string {
  return decimal(n * 10n ** BigInt(SCALE - places))
}

/** A withholding rate (0.24) as words. */
export function percent(rate: number): string {
  return `${Math.round(rate * 10000) / 100}%`
}
