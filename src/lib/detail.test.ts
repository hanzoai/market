import { appDetail, listingDetail, mcpCall, mcpDetail, skillDetail } from '~/lib/detail'
import type { ShopListing } from '~/lib/market'

const base: ShopListing = {
  id: 'lst_1',
  publisherOrg: 'orbital',
  tool: 'deep-research',
  title: 'Deep Research',
  description: 'Writes the brief.',
  category: '',
  price: '250',
  currency: 'USD',
  recipient: 'wal_1',
  public: true,
  createdAt: 1_700_000_000,
  kind: 'agent',
  reputation: { rating: null, reviews: 0, installs: 0, jobs: { completed: 0, disputed: 0 } },
}

describe('listing detail', () => {
  it('hires an agent through escrow, and can pay one per call', () => {
    expect(listingDetail(base).get).toEqual({ how: 'checkout', listing: 'lst_1', rails: ['escrow', 'x402'] })
    expect(listingDetail({ ...base, price: '0' }).get).toEqual({ how: 'checkout', listing: 'lst_1', rails: ['escrow'] })
  })

  it('sells a priced tool per call and installs a free one directly', () => {
    expect(listingDetail({ ...base, kind: 'skill', price: '0.01' }).get).toEqual({ how: 'checkout', listing: 'lst_1', rails: ['x402'] })
    expect(listingDetail({ ...base, kind: 'mcp', price: '0' }).get).toEqual({ how: 'install', tool: 'deep-research' })
  })

  it('points at docs, the CLI and the MCP tool for the same install', () => {
    const d = listingDetail({ ...base, category: 'research', docs: 'https://docs.orbital.dev' })
    expect(d.links).toEqual([{ label: 'Documentation', href: 'https://docs.orbital.dev/' }])
    expect(listingDetail(base).links[0].href).toBe('https://docs.hanzo.ai/docs/api')
    expect(d.cli).toBe('hanzo marketplace install --tool deep-research')
    expect(mcpCall(d)).toBe('{"name":"marketplace","arguments":{"op":"post_marketplace_install","input":{"tool":"deep-research"}}}')
    expect(d.facts).toContainEqual(['Category', 'research'])
    expect(d.facts).toContainEqual(['Listed', '2023-11-14'])
  })

  it('opens an app where it lives', () => {
    const d = appDetail({
      id: 'hanzo/chat',
      org: 'hanzo',
      name: 'chat',
      kind: 'site',
      origin: 'product',
      forkable: true,
      url: 'https://hanzo.chat',
      repo: 'https://github.com/hanzoai/chat',
      stars: 9,
      language: 'TypeScript',
      archetype: 'chat',
      license: 'MIT',
      updated: '2026-09-01T00:00:00Z',
    })
    expect(d.get).toEqual({ how: 'open', href: 'https://hanzo.chat/' })
    expect(d.links.map((l) => l.label)).toEqual(['Open app', 'Source', 'Documentation'])
    expect(d.reputation?.installs).toBe(9)
    expect(d.cli).toBe('hanzo catalog get --q chat --org hanzo')
    expect(d.facts).toContainEqual(['Updated', '2026-09-01'])
    const bare = appDetail({ id: 'a/b', org: 'a', name: 'b', kind: 'repo', origin: 'community', forkable: false })
    expect(bare.get).toEqual({ how: 'open', href: '' })
    expect(appDetail({ id: 'a/b', org: 'a', name: 'b', kind: 'repo', origin: 'community', forkable: false, url: 'javascript:alert(1)' }).links.map((l) => l.label)).toEqual(['Documentation'])
    expect(listingDetail({ ...base, docs: 'javascript:alert(1)' }).links[0].href).toBe('https://docs.hanzo.ai/docs/api')
    expect(bare.reputation).toBeNull()
    expect(bare.facts).toContainEqual(['Forkable', 'No'])
  })

  it('installs a skill and connects an MCP server', () => {
    const s = skillDetail({ name: 'vector-search', service: 'vector', description: 'Search.', path: '/x' }, '', 'https://api.hanzo.ai')
    expect(s.body).toBe('Search.')
    expect(s.get).toEqual({ how: 'install', tool: 'vector-search' })
    expect(s.links[0].href).toBe('https://api.hanzo.ai/.well-known/agent-skills/vector-search/SKILL.md')
    const m = mcpDetail({ id: 'com.stripe_mcp', name: 'stripe', vendor: 'Stripe', description: 'Pay.', version: '1', transports: [], featured: false, official: true, site: 'https://stripe.com', repo: 'https://github.com/stripe/mcp' })
    expect(m.get).toEqual({ how: 'connect', listing: 'com.stripe_mcp' })
    expect(m.cli).toBe('hanzo tool mcp servers create --listing com.stripe_mcp')
    expect(m.facts).toContainEqual(['Transports', '—'])
    expect(m.facts).toContainEqual(['Official', 'Yes'])
    expect(m.links.map((l) => l.label)).toEqual(['Website', 'Source', 'Documentation'])
    expect(mcpCall({ ...m, mcp: null })).toBeNull()
  })
})
