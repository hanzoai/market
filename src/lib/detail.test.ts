import { appDetail, docs, listingDetail, mcpCall, mcpDetail, skillDetail } from '~/lib/detail'
import type { ShopListing } from '~/lib/market'

const rep = { rating: null, reviews: 0, installs: 0, jobs: { completed: 0, disputed: 0 } }
const base: ShopListing = {
  id: 'lst_1',
  publisherOrg: 'orbital',
  kind: 'agent',
  tool: 'deep-research',
  title: 'Deep Research',
  description: 'Writes the brief.',
  category: '',
  price: '250',
  currency: 'USD',
  public: true,
  createdAt: 1_700_000_000,
  updatedAt: 1_700_000_000,
  seller: { org: 'orbital', documented: false, reputation: rep },
  reputation: rep,
  links: { cli: 'hanzo marketplace jobs create --listing lst_1 --brief <brief> --amount <usd>', mcp: { tool: 'marketplace', op: 'post_marketplace_jobs' } },
}
const tool: ShopListing = {
  ...base,
  kind: 'tool',
  tool: 'geocode',
  price: '0.0025',
  links: { cli: 'hanzo marketplace install --tool geocode', mcp: { tool: 'marketplace', op: 'post_marketplace_install' } },
}

describe('listing detail', () => {
  it('hires everything a seller lists, priced or free, through checkout', () => {
    for (const kind of ['agent', 'persona', 'app', 'skill', 'mcp'] as const) {
      expect(listingDetail({ ...base, kind }).get).toEqual({ how: 'checkout', listing: 'lst_1', hire: true })
      expect(listingDetail({ ...base, kind, price: '0' }).get).toEqual({ how: 'checkout', listing: 'lst_1', hire: true })
    }
  })

  it('sells a priced platform tool per call and installs a free one directly', () => {
    expect(listingDetail(tool).get).toEqual({ how: 'checkout', listing: 'lst_1', hire: false })
    expect(listingDetail({ ...tool, price: '0' }).get).toEqual({ how: 'install', tool: 'geocode' })
  })

  it('points at docs, and at the command and MCP operation the platform names', () => {
    const d = listingDetail({ ...base, category: 'research', docs: 'https://docs.orbital.dev' })
    expect(d.links).toEqual([{ label: 'Documentation', href: 'https://docs.orbital.dev/' }])
    expect(listingDetail(base).links[0].href).toBe('https://docs.hanzo.ai/docs/api')
    expect(listingDetail({ ...base, links: { ...base.links, docs: '/docs/agents/research' } }).links[0].href).toBe('https://docs.hanzo.ai/docs/agents/research')
    expect(d.cli).toBe('hanzo marketplace jobs create --listing lst_1 --brief <brief> --amount <usd>')
    expect(mcpCall(d)).toBe('{"name":"marketplace","arguments":{"op":"post_marketplace_jobs","input":{"listing":"lst_1","brief":"<brief>","amount":"<usd>"}}}')
    expect(mcpCall(listingDetail(tool))).toBe('{"name":"marketplace","arguments":{"op":"post_marketplace_install","input":{"tool":"geocode"}}}')
    expect(d.facts).toContainEqual(['Category', 'research'])
    expect(d.facts).toContainEqual(['Listed', '2023-11-14'])
    expect(d.facts).toContainEqual(['Tax form', 'Not on file'])
    expect(listingDetail({ ...base, seller: { ...base.seller, documented: true } }).facts).toContainEqual(['Tax form', 'Certified'])
    expect(docs('//evil.example/x')).toBeNull()
    expect(docs(undefined)).toBeNull()
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
