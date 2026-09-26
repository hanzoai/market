// The payer's half of x402 (v2, scheme "exact", EIP-3009): read the terms a 402
// states, build the authorization for exactly those terms, and encode the signed
// payment. The EIP-712 digest is viem's; cloud verifies the same encoding
// (apps/x402/protocol.go eip712Digest), and x402.test.ts checks a payment cloud's
// own Sign produced against it. Signing is the org wallet's, on the platform
// (POST /v1/wallet/{id}/sign): no key is ever in this page, and the page is the
// buyer's own check that the terms it signs are the job it cleared (`vet`).

import { hashTypedData, isAddress, zeroAddress, type Hex } from 'viem'

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

/** The Hanzo L1: the one network cloud's rail settles on (apps/x402 DefaultNetwork). */
export const HANZO = 'eip155:36963'

/** The EIP-712 domain of an EIP-3009 token, and the atomic-unit scale its amounts are in. */
export interface Asset {
  name: string
  version: string
  decimals: number
}

/** No token contract: the zero address, as an EIP-712 domain encodes an unset one (cloud apps/x402 protocol.go addrBytes). */
const NONE = zeroAddress

/**
 * What this page signs for, and nothing else: network → token contract → the
 * token's EIP-712 domain and scale. The network is the Hanzo L1; the contract is
 * the one cloud's operator pins for the rail (CLOUD_X402_ASSET). None is pinned —
 * the Hanzo L1 has no USDC deployment — so cloud states no contract, and its
 * domain names the zero address: an authorization no token contract can execute,
 * which moves money only through the rail's own ledger. Terms on any other chain,
 * or naming any other contract, are not signed: one key signs for every EVM
 * chain, and an authorization for a token the wallet holds would move that
 * token, outside the rail and its hold. A contract the operator pins later is
 * added here, or this page refuses every hire until it is.
 */
export const ASSETS: ReadonlyMap<string, ReadonlyMap<string, Asset>> = new Map([[HANZO, new Map([[NONE, { name: 'USD Coin', version: '2', decimals: 6 }]])]])

/** The token contract a requirement names, lowercase, with none as the zero address — or null for one that is not an address. */
export function contract(a: Requirements): string | null {
  const c = (a.asset ?? '').trim()
  if (!c) return NONE
  return isAddress(c, { strict: false }) ? c.toLowerCase() : null
}

/** The pinned asset a requirement names — its network, contract and EIP-712 domain all as pinned — or null. */
export function asset(a: Requirements): Asset | null {
  const c = contract(a)
  const pinned = c === null ? undefined : ASSETS.get(a.network)?.get(c)
  return pinned && a.extra?.name === pinned.name && a.extra.version === pinned.version ? pinned : null
}

/**
 * Whether a wallet pays on the Hanzo L1: its chain, as cloud stores it, names that
 * chain ("eip155:36963" or "36963"), or none — a chain-agnostic wallet, which cloud
 * runs on the Hanzo L1 (apps/wallet: "the Hanzo L1 (36963) when it is chain-agnostic").
 */
export const onHanzo = (chain?: string): boolean => /^(?:(?:eip155:)?36963)?$/.test((chain ?? '').trim())

/** Refuse a paying wallet for any chain but the Hanzo L1, before anything is asked or signed. */
export function rail(payer: { id?: string; chain?: string }): void {
  if (onHanzo(payer.chain)) return
  const who = payer.id ? `Wallet ${payer.id}` : 'The wallet'
  throw new Error(`${who} is for ${payer.chain}, and this storefront pays only on the Hanzo L1 (${HANZO}). Nothing was signed.`)
}

/** The one requirement this page signs: exact, EIP-3009, in a pinned asset on a pinned network. */
export function payable(r: Required): Requirements | null {
  return r.accepts.find((a) => a.scheme === 'exact' && (a.extra?.assetTransferMethod ?? 'eip3009') === 'eip3009' && asset(a) !== null) ?? null
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
 * a job, in a pinned asset — network, token contract and domain — for exactly the
 * dollars the buyer cleared in that asset's scale, and to a payee that is an
 * address other than the payer's own. The platform cannot ask the wallet for
 * anything else: other terms are refused, and nothing is signed.
 */
export function vet(r: Required, amount: string, payer: string): Vetted {
  const job = /^job:([A-Za-z0-9_-]+)$/.exec(r.resource.url)?.[1]
  if (!job) throw new Error(`The payment terms are for ${r.resource.url}, not a job. Nothing was signed.`)
  const accepted = payable(r)
  if (!accepted) throw new Error('The payment terms name no network and token contract this storefront signs for. Nothing was signed.')
  const scale = asset(accepted)?.decimals ?? 0
  const asked = /^\d{1,78}$/.test(accepted.amount) ? BigInt(accepted.amount) : null
  if (asked === null) throw new Error('The payment terms name no amount. Nothing was signed.')
  if (asked !== atomic(amount, scale)) {
    throw new Error(`The platform asked the wallet to sign ${usd(scaled(asked, scale))} for a job cleared at ${usd(amount)}. Nothing was signed.`)
  }
  const to = accepted.payTo
  if (!isAddress(to, { strict: false }) || ZERO.test(to) || to.toLowerCase() === payer.toLowerCase()) {
    throw new Error(`The payment terms pay ${to || 'no one'}, which is not a seller's address. Nothing was signed.`)
  }
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
  const verifyingContract = contract(req)
  if (verifyingContract === null) throw new Error(`asset ${req.asset} is not a token contract`)
  return hashTypedData({
    domain: { name: req.extra?.name ?? '', version: req.extra?.version ?? '', chainId: BigInt(chainId(req.network)), verifyingContract: hex(verifyingContract) },
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
