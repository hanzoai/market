// The payer's half of x402 (v2, scheme "exact", EIP-3009): read the terms a 402
// states, build the authorization for exactly those terms, and encode the signed
// payment. The EIP-712 digest is viem's; cloud verifies the same encoding
// (apps/x402/protocol.go eip712Digest), and x402.test.ts checks a payment cloud's
// own Sign produced against it. Signing is the org wallet's, on the platform
// (POST /v1/wallet/{id}/sign): no key is ever in this page, and the page is the
// buyer's own check that the terms it signs are the job it cleared (`vet`).

import { hashTypedData, isAddress, type Hex } from 'viem'

import { atomic, scaled, usd } from '~/lib/money'

export const VERSION = 2

export interface Requirements {
  scheme: string
  /** CAIP-2, e.g. "eip155:36963". */
  network: string
  /** Atomic units of `asset`, a decimal string. */
  amount: string
  /** The EIP-3009 token contract. */
  asset: string
  payTo: string
  maxTimeoutSeconds: number
  extra?: { assetTransferMethod?: string; name: string; version: string }
}

export interface Resource {
  url: string
  description?: string
  mimeType?: string
}

/** What a 402 asks to be signed (PAYMENT-REQUIRED). */
export interface Required {
  x402Version: number
  resource: Resource
  accepts: Requirements[]
}

export interface Authorization {
  from: string
  to: string
  value: string
  /** Unix seconds, as the decimal string the rail marshals. */
  validAfter: string
  validBefore: string
  /** 32 bytes, 0x hex. */
  nonce: string
}

/** Standard base64 of UTF-8 JSON: the encoding of PAYMENT-REQUIRED and PAYMENT-SIGNATURE. */
function encode(v: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(v))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function decode(s: string): unknown {
  const b64 = s.trim().replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
}

/**
 * The terms a 402 refusal carries. Cloud writes them into the problem document as
 * `paymentRequired` (the PAYMENT-REQUIRED value), which a browser can read where
 * it cannot read the header. Null when there are none this page can pay.
 */
export function terms(problem: Record<string, unknown> | undefined): Required | null {
  const raw = problem?.paymentRequired
  if (typeof raw !== 'string' || !raw) return null
  try {
    const got = decode(raw) as Partial<Required>
    if (got.x402Version !== VERSION || !got.resource?.url || !Array.isArray(got.accepts)) return null
    return { x402Version: got.x402Version, resource: got.resource, accepts: got.accepts }
  } catch {
    return null
  }
}

/**
 * The EIP-3009 assets this page signs for, by EIP-712 domain, and the atomic-unit
 * scale of each. USDC ("USD Coin", version "2", 6 places) is what cloud's rail
 * settles in (apps/x402 DefaultAssetName, DefaultAssetVersion, DefaultAssetDecimals).
 * Terms in any other asset are not signed: their value cannot be checked against
 * the dollars the buyer cleared.
 */
const PLACES = new Map([['USD Coin/2', 6]])

/** The atomic-unit scale of the asset a requirement names, or null for an asset this page does not know. */
export const places = (a: Requirements): number | null => PLACES.get(`${a.extra?.name ?? ''}/${a.extra?.version ?? ''}`) ?? null

/** The one requirement this page signs: exact, EIP-3009, on an EVM chain, in an asset it knows. */
export function payable(r: Required): Requirements | null {
  return (
    r.accepts.find(
      (a) => a.scheme === 'exact' && /^eip155:\d+$/.test(a.network) && (a.extra?.assetTransferMethod ?? 'eip3009') === 'eip3009' && places(a) !== null,
    ) ?? null
  )
}

/** What a job's payment signs, once `vet` checked it. */
export interface Vetted {
  /** The job the terms are for (resource job:<id>). */
  job: string
  accepted: Requirements
}

const ZERO = /^0x0{40}$/i

/**
 * The terms a 402 names for a job, checked before anything is signed: they are for
 * a job, in an asset this page knows the scale of, for exactly the dollars the
 * buyer cleared, and to a payee that is an address other than the payer's own. The
 * platform cannot ask the wallet for anything else: other terms are refused, and
 * nothing is signed.
 */
export function vet(r: Required, amount: string, payer: string): Vetted {
  const job = /^job:([A-Za-z0-9_-]+)$/.exec(r.resource.url)?.[1]
  if (!job) throw new Error(`The payment terms are for ${r.resource.url}, not a job. Nothing was signed.`)
  const accepted = payable(r)
  if (!accepted) throw new Error('The payment terms name no chain and asset this storefront can sign for. Nothing was signed.')
  const scale = places(accepted) ?? 0
  const asked = /^\d{1,78}$/.test(accepted.amount) ? BigInt(accepted.amount) : null
  if (asked === null) throw new Error('The payment terms name no amount. Nothing was signed.')
  if (asked !== atomic(amount, scale)) {
    throw new Error(`The platform asked the wallet to sign ${usd(scaled(asked, scale))} for a job cleared at ${usd(amount)}. Nothing was signed.`)
  }
  const to = accepted.payTo
  if (!isAddress(to, { strict: false }) || ZERO.test(to) || to.toLowerCase() === payer.toLowerCase()) {
    throw new Error(`The payment terms pay ${to || 'no one'}, which is not a seller's address. Nothing was signed.`)
  }
  if (!isAddress(accepted.asset, { strict: false })) throw new Error('The payment terms name no token contract. Nothing was signed.')
  return { job, accepted }
}

export function chainId(network: string): number {
  const m = /^eip155:(\d+)$/.exec(network)
  if (!m) throw new Error(`network ${network} is not an EVM chain`)
  return Number(m[1])
}

/** 32 random bytes, 0x hex. */
export function nonce(): string {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`
}

const hex = (a: string) => a.toLowerCase() as Hex

/** The EIP-712 digest the payer's wallet signs: TransferWithAuthorization in the token's domain. */
export function digest(req: Requirements, a: Authorization): Hex {
  return hashTypedData({
    domain: { name: req.extra?.name ?? '', version: req.extra?.version ?? '', chainId: BigInt(chainId(req.network)), verifyingContract: hex(req.asset) },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: hex(a.from),
      to: hex(a.to),
      value: BigInt(a.value),
      validAfter: BigInt(a.validAfter),
      validBefore: BigInt(a.validBefore),
      nonce: hex(a.nonce),
    },
  })
}

/** The PAYMENT-SIGNATURE value: the signed authorization, bound to the terms it answers. */
export function payment(r: Required, accepted: Requirements, a: Authorization, signature: string): string {
  return encode({ x402Version: VERSION, resource: r.resource, accepted, payload: { signature, authorization: a } })
}
