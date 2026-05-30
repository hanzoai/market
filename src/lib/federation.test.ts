/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest'
import type { MergedBrand } from '../brand/types'
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

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
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
      const url = String(input)
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
      const url = String(input)
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
      const url = String(input)
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
      const url = String(input)
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
      const url = String(input)
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
