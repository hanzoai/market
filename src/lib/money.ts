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

/** How a listing's price reads: an agent is hired per job, a tool is paid per call. */
export function perCall(amount: string, kind: Kind): string {
  return kind === 'agent' ? `from ${usd(amount)} per job` : `${usd(amount)} per call`
}

/** A withholding rate (0.24) as words. */
export function percent(rate: number): string {
  return `${Math.round(rate * 10000) / 100}%`
}
