/* @vitest-environment node */

import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { MergedBrand, WellKnownBrand } from '../brand/types'
import { deriveCapabilities, fetchPeers, safeHref } from './federation'

function brand(overrides: Partial<MergedBrand> = {}): MergedBrand {
  return {
    brandId: 'hanzo',
    appId: 'market',
    brand: {
      name: 'hanzo',
      title: 'Hanzo Market',
      shortName: 'Hanzo Market',
      description: 'Hanzo Market — skills, personas, and agents in one place.',
      appDomain: 'hanzo.market',
    },
    app: {
      id: 'market',
      name: 'Hanzo Market',
      tagline: 'The registry for sharp agents.',
      description: 'Hanzo Market — skills, personas, and agents in one place.',
      defaultSubdomain: '',
    },
    title: 'Hanzo Market',
    domain: 'hanzo.market',
    url: 'https://hanzo.market',
    github: 'https://github.com/hanzoai/market',
    peers: [],
    ...overrides,
  }
}

/** The URL a fetch was called with, whichever of the three shapes it arrived as.
 *  `String()` on a Request yields "[object Request]", so a Request would silently
 *  match no route and the test would assert against a fallback. */
function requestedUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

/**
 * Helper to build the split-shape WellKnown app payload alongside the
 * matching brand payload + computed hash. Uses Node `crypto` to derive
 * the exact same digest that the aggregator (Web Crypto) will compute.
 */
function splitPayloads(
  app: Omit<MergedBrand, 'brand'> & { brand?: never },
  brand: WellKnownBrand,
  brandUrl = '/.well-known/brand.json',
): {
  app: Record<string, unknown>
  appWithoutHash: Record<string, unknown>
  brand: WellKnownBrand
  brandJsonBytes: string
  brandHash: string
} {
  const brandJsonBytes = JSON.stringify(brand)
  const brandHash =
    'sha256-' + createHash('sha256').update(brandJsonBytes, 'utf8').digest('base64')
  return {
    app: { ...app, brand: brandUrl, brandHash } as Record<string, unknown>,
    appWithoutHash: { ...app, brand: brandUrl } as Record<string, unknown>,
    brand,
    brandJsonBytes,
    brandHash,
  }
}

describe('deriveCapabilities', () => {
  it('always includes skills and personas', () => {
    expect(deriveCapabilities(brand())).toEqual(['skills', 'personas'])
  })

  it('adds chain when chain binding is present', () => {
    const b = brand({
      chain: { id: 1, name: 'Lux Mainnet', rpcUrl: 'x', explorerUrl: 'y' },
    })
    expect(deriveCapabilities(b)).toContain('chain')
  })

  it('adds federation when peers is non-empty', () => {
    const b = brand({ peers: [{ id: 'zoo', url: 'https://zoo.market', appId: 'market' }] })
    expect(deriveCapabilities(b)).toContain('federation')
  })
})

describe('fetchPeers', () => {
  it('returns the local market as the first entry on a fresh install', async () => {
    const local = brand({ peers: [] })
    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestedUrl(input)
      if (url === 'https://hanzo.market/.well-known/market.json') {
        return jsonResponse(local)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await fetchPeers({
      localOrigin: 'https://hanzo.market',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.brandId).toBe('hanzo')
    expect(result[0]?.status).toBe('ok')
  })

  it('fans out to each declared peer and collects successful payloads', async () => {
    const local = brand({
      peers: [
        { id: 'zoo', url: 'https://zoo.market', appId: 'market' },
        { id: 'lux', url: 'https://lux.market', appId: 'market' },
      ],
    })
    const zoo = brand({
      brandId: 'zoo',
      title: 'Zoo Market',
      url: 'https://zoo.market',
      domain: 'zoo.market',
      github: 'https://github.com/zooai/market',
      chain: { id: 200200, name: 'Zoo Mainnet', rpcUrl: 'x', explorerUrl: 'y' },
    })
    const lux = brand({
      brandId: 'lux',
      title: 'Lux Market',
      url: 'https://lux.market',
      domain: 'lux.market',
      github: 'https://github.com/luxfi/market',
    })

    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestedUrl(input)
      if (url === 'https://hanzo.market/.well-known/market.json') return jsonResponse(local)
      if (url === 'https://zoo.market/.well-known/market.json') return jsonResponse(zoo)
      if (url === 'https://lux.market/.well-known/market.json') return jsonResponse(lux)
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await fetchPeers({
      localOrigin: 'https://hanzo.market',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toHaveLength(3)
    expect(result.map((r) => r.brandId)).toEqual(['hanzo', 'zoo', 'lux'])
    expect(result[1]?.capabilities).toContain('chain')
    expect(result[2]?.capabilities).not.toContain('chain')
  })

  it('marks failing peers with status error and keeps successful peers', async () => {
    const local = brand({
      peers: [
        { id: 'zoo', url: 'https://zoo.market', appId: 'market' },
        { id: 'broken', url: 'https://broken.example', appId: 'market' },
      ],
    })
    const zoo = brand({ brandId: 'zoo', title: 'Zoo', url: 'https://zoo.market', domain: 'zoo.market' })

    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestedUrl(input)
      if (url === 'https://hanzo.market/.well-known/market.json') return jsonResponse(local)
      if (url === 'https://zoo.market/.well-known/market.json') return jsonResponse(zoo)
      if (url === 'https://broken.example/.well-known/market.json') {
        return jsonResponse({ error: 'not found' }, { status: 404 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await fetchPeers({
      localOrigin: 'https://hanzo.market',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toHaveLength(3)
    expect(result[0]?.status).toBe('ok')
    expect(result[1]?.status).toBe('ok')
    expect(result[2]?.status).toBe('error')
    expect(result[2]?.error).toMatch(/HTTP 404/)
  })

  it('marks timeouts as status timeout', async () => {
    const local = brand({
      peers: [{ id: 'slow', url: 'https://slow.example', appId: 'market' }],
    })

    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestedUrl(input)
      if (url === 'https://hanzo.market/.well-known/market.json') return jsonResponse(local)
      if (url === 'https://slow.example/.well-known/market.json') {
        // Abort path: simulate AbortController signal triggering before response.
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (signal) {
            signal.addEventListener('abort', () => {
              const err = new Error('aborted')
              err.name = 'AbortError'
              reject(err)
            })
          }
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await fetchPeers({
      localOrigin: 'https://hanzo.market',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 20,
    })

    expect(result).toHaveLength(2)
    expect(result[1]?.status).toBe('timeout')
  })

  it('throws when the local well-known cannot be loaded', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'no' }, { status: 500 }))
    await expect(
      fetchPeers({
        localOrigin: 'https://hanzo.market',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/cannot read local/)
  })

  it('does not double-count the local market when it is also in peers', async () => {
    const local = brand({
      peers: [
        { id: 'self', url: 'https://hanzo.market', appId: 'market' },
        { id: 'zoo', url: 'https://zoo.market', appId: 'market' },
      ],
    })
    const zoo = brand({ brandId: 'zoo', title: 'Zoo', url: 'https://zoo.market', domain: 'zoo.market' })

    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestedUrl(input)
      if (url === 'https://hanzo.market/.well-known/market.json') return jsonResponse(local)
      if (url === 'https://zoo.market/.well-known/market.json') return jsonResponse(zoo)
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await fetchPeers({
      localOrigin: 'https://hanzo.market',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.map((r) => r.brandId)).toEqual(['hanzo', 'zoo'])
  })
})

describe('fetchPeers — split shape (LP-0010 §4.1)', () => {
  it('follows the brand link when payload uses the new split shape', async () => {
    const split = splitPayloads(
      {
        brandId: 'hanzo',
        appId: 'market',
        app: {
          id: 'market',
          name: 'Hanzo Market',
          tagline: 'The registry for sharp agents.',
          description: 'Hanzo Market.',
          defaultSubdomain: '',
        },
        title: 'Hanzo Market',
        domain: 'hanzo.market',
        url: 'https://hanzo.market',
        github: 'https://github.com/hanzoai/market',
        peers: [],
      },
      {
        brandId: 'hanzo',
        name: 'hanzo',
        title: 'Hanzo Market',
        shortName: 'Hanzo Market',
        description: 'Hanzo Market — split-shape test.',
        appDomain: 'hanzo.market',
      },
    )

    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestedUrl(input)
      if (url === 'https://hanzo.market/.well-known/market.json') {
        // serialize EXACTLY the same way splitPayloads computed the hash
        // — using JSON.stringify with no spacing.
        return jsonResponse(split.app)
      }
      if (url === 'https://hanzo.market/.well-known/brand.json') {
        // CRITICAL: return the raw bytes that splitPayloads hashed, NOT
        // a re-serialized object. Use new Response(string, ...) directly.
        return new Response(split.brandJsonBytes, {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await fetchPeers({
      localOrigin: 'https://hanzo.market',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.brandId).toBe('hanzo')
    expect(result[0]?.title).toBe('Hanzo Market')
    expect(result[0]?.status).toBe('ok')
    expect(result[0]?.brandVerified).toBe(true)
    // Two fetches: the app, then the brand link.
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('marks brandVerified=false when the brandHash does not match', async () => {
    const split = splitPayloads(
      {
        brandId: 'hanzo',
        appId: 'market',
        app: {
          id: 'market',
          name: 'Hanzo Market',
          tagline: 't',
          description: 'd',
          defaultSubdomain: '',
        },
        title: 'Hanzo Market',
        domain: 'hanzo.market',
        url: 'https://hanzo.market',
        github: 'https://github.com/hanzoai/market',
        peers: [],
      },
      {
        brandId: 'hanzo',
        name: 'hanzo',
        title: 'Hanzo Market',
        shortName: 'HM',
        description: 'integrity test',
        appDomain: 'hanzo.market',
      },
    )

    // Tamper: change the brand bytes the server returns AFTER the hash was
    // computed, so the hash in the app payload no longer matches.
    const tamperedBytes = JSON.stringify({ ...split.brand, name: 'tampered' })

    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestedUrl(input)
      if (url === 'https://hanzo.market/.well-known/market.json') return jsonResponse(split.app)
      if (url === 'https://hanzo.market/.well-known/brand.json') {
        return new Response(tamperedBytes, {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await fetchPeers({
      localOrigin: 'https://hanzo.market',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.status).toBe('ok')
    expect(result[0]?.brandVerified).toBe(false)
    // Even with mismatch, the brand body is still used for rendering — the
    // mismatch is a warning, not a hard refusal.
    expect(result[0]?.title).toBe('Hanzo Market')
  })

  it('omits brandVerified when no brandHash is provided (split shape, unsigned)', async () => {
    const split = splitPayloads(
      {
        brandId: 'hanzo',
        appId: 'market',
        app: {
          id: 'market',
          name: 'Hanzo Market',
          tagline: 't',
          description: 'd',
          defaultSubdomain: '',
        },
        title: 'Hanzo Market',
        domain: 'hanzo.market',
        url: 'https://hanzo.market',
        github: 'https://github.com/hanzoai/market',
        peers: [],
      },
      {
        brandId: 'hanzo',
        name: 'hanzo',
        title: 'Hanzo Market',
        shortName: 'HM',
        description: 'unsigned',
        appDomain: 'hanzo.market',
      },
    )

    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestedUrl(input)
      if (url === 'https://hanzo.market/.well-known/market.json') {
        return jsonResponse(split.appWithoutHash)
      }
      if (url === 'https://hanzo.market/.well-known/brand.json') {
        return new Response(split.brandJsonBytes, {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await fetchPeers({
      localOrigin: 'https://hanzo.market',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result[0]?.status).toBe('ok')
    // No hash provided → brandVerified is absent from the result.
    expect(result[0]?.brandVerified).toBeUndefined()
  })

  it('resolves an absolute brand URL against the served origin', async () => {
    const split = splitPayloads(
      {
        brandId: 'hanzo',
        appId: 'market',
        app: {
          id: 'market',
          name: 'Hanzo Market',
          tagline: 't',
          description: 'd',
          defaultSubdomain: '',
        },
        title: 'Hanzo Market',
        domain: 'hanzo.market',
        url: 'https://hanzo.market',
        github: 'https://github.com/hanzoai/market',
        peers: [],
      },
      {
        brandId: 'hanzo',
        name: 'hanzo',
        title: 'Hanzo Market',
        shortName: 'HM',
        description: 'absolute-url test',
        appDomain: 'hanzo.market',
      },
      'https://brand.hanzo.ai/.well-known/brand.json',
    )

    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestedUrl(input)
      if (url === 'https://hanzo.market/.well-known/market.json') return jsonResponse(split.app)
      if (url === 'https://brand.hanzo.ai/.well-known/brand.json') {
        return new Response(split.brandJsonBytes, {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await fetchPeers({
      localOrigin: 'https://hanzo.market',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result[0]?.brandVerified).toBe(true)
    // Ensure both fetches happened.
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://brand.hanzo.ai/.well-known/brand.json',
      expect.any(Object),
    )
  })
})

describe('safeHref XSS guard', () => {
  it('accepts http: and https: URLs', () => {
    expect(safeHref('https://hanzo.market')).toBe('https://hanzo.market/')
    expect(safeHref('http://localhost:3000')).toBe('http://localhost:3000/')
  })

  it('rejects javascript: URLs (the C-1 XSS attack vector)', () => {
    expect(safeHref('javascript:alert(1)')).toBe(null)
    expect(safeHref('JaVaScRiPt:alert(document.cookie)')).toBe(null)
  })

  it('rejects data:, vbscript:, file: URLs', () => {
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBe(null)
    expect(safeHref('vbscript:msgbox(1)')).toBe(null)
    expect(safeHref('file:///etc/passwd')).toBe(null)
  })

  it('rejects malformed input', () => {
    expect(safeHref('')).toBe(null)
    expect(safeHref('not a url')).toBe(null)
    expect(safeHref(null as unknown as string)).toBe(null)
    expect(safeHref(undefined as unknown as string)).toBe(null)
  })
})
