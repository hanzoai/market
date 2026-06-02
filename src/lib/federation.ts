/**
 * Federation aggregator client.
 *
 * Reads the local /.well-known/market.json to discover peers, then fans out
 * one fetch per peer to read each peer's /.well-known/market.json. Returns
 * one entry per peer (including the local market as the first entry) plus
 * the local market itself, so a fresh install shows exactly one card.
 *
 * Per LP-0010 §4.1 the well-known is split:
 *  - /.well-known/market.json holds federation graph + a `brand` URL
 *  - /.well-known/brand.json holds the brand identity
 *
 * The aggregator handles BOTH shapes transparently:
 *  - new shape (split): `brand` is a string URL; follow it to fetch the
 *    `WellKnownBrand` payload. If `brandHash` is present, verify the
 *    sha256 of the brand bytes matches; a mismatch tags the merged result
 *    with `brandVerified=false`.
 *  - legacy shape (mashed): `brand` is an object; use it inline, no second
 *    fetch.
 *
 * Failures don't block other peers: a peer that times out or 404s shows up
 * as a card with status='timeout' | 'error', not as a missing card.
 */
import type {
  AppKind,
  FederationPeer,
  MergedBrand,
  WellKnownBrand,
} from '../brand/types'

export type FederatedStatus = 'ok' | 'timeout' | 'error'

export interface FederatedMarket {
  brandId: string
  appId: AppKind
  title: string
  url: string
  domain: string
  github: string
  chain?: { id: number; name: string }
  capabilities: string[]
  status: FederatedStatus
  error?: string
  /**
   * brandVerified=true  → brandHash was present and matched.
   * brandVerified=false → brandHash was present and DID NOT match.
   * brandVerified absent → no brandHash provided, or legacy inline shape.
   */
  brandVerified?: boolean
}

export interface FetchPeersOptions {
  /** Per-peer timeout in milliseconds. Defaults to 5000. */
  timeoutMs?: number
  /** Override origin used to fetch the local well-known. Tests only. */
  localOrigin?: string
  /** Fetch implementation override. Tests only. */
  fetchImpl?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 5000
const WELL_KNOWN_PATH = '/.well-known/market.json'

/** Stable, derived capability list from a brand's well-known payload. */
export function deriveCapabilities(brand: MergedBrand): string[] {
  const out = ['skills', 'personas']
  if (brand.chain) out.push('chain')
  if (Array.isArray(brand.peers) && brand.peers.length > 0) out.push('federation')
  return out
}

function toFederatedMarket(
  brand: MergedBrand,
  status: FederatedStatus = 'ok',
  brandVerified?: boolean,
): FederatedMarket {
  const result: FederatedMarket = {
    brandId: brand.brandId,
    appId: brand.appId,
    title: brand.title,
    url: brand.url,
    domain: brand.domain,
    github: brand.github,
    chain: brand.chain ? { id: brand.chain.id, name: brand.chain.name } : undefined,
    capabilities: deriveCapabilities(brand),
    status,
  }
  if (brandVerified !== undefined) result.brandVerified = brandVerified
  return result
}

function fallbackPeer(peer: FederationPeer, status: FederatedStatus, error?: string): FederatedMarket {
  let domain = peer.url
  try {
    domain = new URL(peer.url).host
  } catch {
    // peer.url isn't a valid URL — leave raw
  }
  return {
    brandId: peer.id,
    appId: peer.appId ?? 'market',
    title: peer.id,
    url: peer.url,
    domain,
    github: '',
    capabilities: [],
    status,
    error,
  }
}

/**
 * Wire shape: the legacy mashed object OR the new split shape that
 * carries `brand` as a URL string plus optional `brandHash` and a
 * back-compat `brandObject` mirror.
 *
 * `brand` is the discriminator: object → legacy; string → split.
 */
type WellKnownAppPayload =
  | (MergedBrand & { brand: MergedBrand['brand']; brandRef?: never; brandHash?: never })
  | (Omit<MergedBrand, 'brand'> & {
      brand: string
      brandHash?: string
      brandObject?: WellKnownBrand
    })

interface ResolvedWellKnown {
  merged: MergedBrand
  /**
   * undefined → no brandHash was provided (or legacy inline shape)
   * true       → brandHash matched the fetched brand bytes
   * false      → brandHash did NOT match (the merged result is best-effort)
   */
  brandVerified?: boolean
}

/** Convert a Web Crypto digest to base64 (browser + Node 18+). */
async function sha256Base64(bytes: Uint8Array | string): Promise<string> {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource)
  // Convert ArrayBuffer to base64 in a way that works in both runtimes.
  let binary = ''
  const view = new Uint8Array(digest)
  for (let i = 0; i < view.byteLength; i++) {
    binary += String.fromCharCode(view[i]!)
  }
  if (typeof btoa === 'function') return btoa(binary)
  // Node ≥18 has Buffer in scope; cast to keep this file isomorphic.
  const B = (globalThis as { Buffer?: { from: (b: string, enc: string) => { toString(e: string): string } } }).Buffer
  if (B) return B.from(binary, 'binary').toString('base64')
  throw new Error('no base64 encoder available')
}

async function fetchWellKnown(
  origin: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<ResolvedWellKnown> {
  const url = new URL(WELL_KNOWN_PATH, origin).toString()
  const payload = await fetchJsonWithTimeout<WellKnownAppPayload>(url, fetchImpl, timeoutMs)
  if (!payload || typeof payload !== 'object' || !('brandId' in payload)) {
    throw new Error('invalid well-known payload')
  }

  // Legacy mashed: `brand` is an object → trust it as-is.
  if (typeof payload.brand === 'object' && payload.brand !== null) {
    return { merged: payload as MergedBrand }
  }

  // Split shape: `brand` is a URL string → follow it.
  const brandUrl = new URL(payload.brand, url).toString()
  const { json: brandJson, raw: brandRaw } = await fetchJsonAndBytes<WellKnownBrand>(
    brandUrl,
    fetchImpl,
    timeoutMs,
  )
  if (!brandJson || typeof brandJson !== 'object' || !('brandId' in brandJson)) {
    throw new Error('invalid brand payload at ' + brandUrl)
  }

  let brandVerified: boolean | undefined
  if (typeof payload.brandHash === 'string' && payload.brandHash.startsWith('sha256-')) {
    const expected = payload.brandHash.slice('sha256-'.length)
    const actual = await sha256Base64(brandRaw)
    brandVerified = actual === expected
  }

  // Reconstitute a MergedBrand for downstream rendering. The brand link's
  // identity payload becomes the `brand` field; everything else (app,
  // chain, peers, denormalized title/domain/url/github) comes from the
  // app payload. `brandObject`, if present, is preferred over the freshly
  // fetched copy only when the link cannot be followed — but we already
  // followed it, so we use the fetched copy.
  const merged: MergedBrand = {
    brandId: payload.brandId,
    appId: payload.appId,
    brand: brandJsonToBrandConfig(brandJson),
    app: payload.app,
    title: payload.title,
    domain: payload.domain,
    url: payload.url,
    github: payload.github,
    ...(payload.chain ? { chain: payload.chain } : {}),
    peers: Array.isArray(payload.peers) ? payload.peers : [],
  }
  return { merged, brandVerified }
}

async function fetchJsonWithTimeout<T>(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJsonAndBytes<T>(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<{ json: T; raw: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const raw = await res.text()
    return { json: JSON.parse(raw) as T, raw }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Project a WellKnownBrand onto the BrandConfig shape that `MergedBrand`
 * expects. The two overlap on every identity field; this just renames
 * `brandId` (which BrandConfig doesn't carry — it lives one level up).
 */
function brandJsonToBrandConfig(wkb: WellKnownBrand): MergedBrand['brand'] {
  // BrandConfig has no `brandId` field — it sits on the merged envelope.
  const { brandId: _brandId, ...identity } = wkb
  return identity as MergedBrand['brand']
}

/**
 * Fetch the local market and every federated peer.
 *
 * Always returns the local market as the first entry. Peers are appended in
 * declaration order. Failures become entries with `status !== 'ok'` rather
 * than being dropped.
 */
export async function fetchPeers(options: FetchPeersOptions = {}): Promise<FederatedMarket[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const fetchImpl = options.fetchImpl ?? fetch
  const localOrigin =
    options.localOrigin ?? (typeof window !== 'undefined' ? window.location.origin : '')

  if (!localOrigin) {
    throw new Error('fetchPeers: no localOrigin and no window available')
  }

  let local: ResolvedWellKnown
  try {
    local = await fetchWellKnown(localOrigin, fetchImpl, timeoutMs)
  } catch (err) {
    throw new Error(
      `fetchPeers: cannot read local /.well-known/market.json — ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }

  const results: FederatedMarket[] = [toFederatedMarket(local.merged, 'ok', local.brandVerified)]
  const localHost = safeHost(local.merged.url) ?? safeHost(localOrigin)
  const peerList = Array.isArray(local.merged.peers) ? local.merged.peers : []

  const peerResults = await Promise.all(
    peerList
      .filter((p) => safeHost(p.url) !== localHost)
      .map(async (peer): Promise<FederatedMarket> => {
        try {
          const resolved = await fetchWellKnown(peer.url, fetchImpl, timeoutMs)
          return toFederatedMarket(resolved.merged, 'ok', resolved.brandVerified)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          const status: FederatedStatus =
            err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'error'
          return fallbackPeer(peer, status, message)
        }
      }),
  )

  results.push(...peerResults)
  return results
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

/**
 * Returns a URL only if it parses AND uses an allowed scheme (http/https).
 * Returns null for `javascript:`, `data:`, `vbscript:`, malformed URLs, etc.
 * Critical: federated peer well-known payloads come from untrusted origins;
 * rendering peer.url in an <a href> without scheme validation is XSS via
 * `javascript:` URLs (which `rel="noreferrer"` does not mitigate).
 */
export function safeHref(url: string): string | null {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}
