/**
 * Federation aggregator client.
 *
 * Reads the local /.well-known/market.json to discover peers, then fans out
 * one fetch per peer to read each peer's /.well-known/market.json. Returns
 * one entry per peer (including the local market as the first entry) plus
 * the local market itself, so a fresh install shows exactly one card.
 *
 * The well-known shape is the same `MergedBrand` schema that brand.json
 * exposes — single source of truth (src/brand/presets/<id>.json).
 *
 * Failures don't block other peers: a peer that times out or 404s shows up
 * as a card with status='timeout' | 'error', not as a missing card.
 */
import type { AppKind, FederationPeer, MergedBrand } from '../brand/types'

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

function toFederatedMarket(brand: MergedBrand, status: FederatedStatus = 'ok'): FederatedMarket {
  return {
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

async function fetchWellKnown(
  origin: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<MergedBrand> {
  const url = new URL(WELL_KNOWN_PATH, origin).toString()
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
    const json = (await res.json()) as MergedBrand
    if (!json || typeof json !== 'object' || !('brandId' in json)) {
      throw new Error('invalid well-known payload')
    }
    return json
  } finally {
    clearTimeout(timer)
  }
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

  let local: MergedBrand
  try {
    local = await fetchWellKnown(localOrigin, fetchImpl, timeoutMs)
  } catch (err) {
    throw new Error(
      `fetchPeers: cannot read local /.well-known/market.json — ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }

  const results: FederatedMarket[] = [toFederatedMarket(local, 'ok')]
  const localHost = safeHost(local.url) ?? safeHost(localOrigin)
  const peerList = Array.isArray(local.peers) ? local.peers : []

  const peerResults = await Promise.all(
    peerList
      .filter((p) => safeHost(p.url) !== localHost)
      .map(async (peer): Promise<FederatedMarket> => {
        try {
          const brand = await fetchWellKnown(peer.url, fetchImpl, timeoutMs)
          return toFederatedMarket(brand, 'ok')
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
