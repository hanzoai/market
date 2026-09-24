import { facets, fromApp, fromListing, fromMcp, fromSkill, isKind, matches, merge, PATH } from '~/lib/catalog'
import type { AppEntry, McpListing, ShopListing } from '~/lib/market'

const listing: ShopListing = {
  id: 'lst_1',
  publisherOrg: 'orbital',
  publisherName: 'Orbital Labs',
  tool: 'deep-research',
  title: 'Deep Research',
  description: 'Writes the brief.',
  category: 'research',
  price: '250',
  currency: 'USD',
  recipient: 'wal_1',
  public: true,
  createdAt: 1,
  kind: 'agent',
  reputation: { rating: 4.5, reviews: 2, installs: 3, jobs: { completed: 1, disputed: 0 } },
}

const app: AppEntry = { id: 'hanzo/chat', org: 'hanzo', name: 'chat', kind: 'site', origin: 'product', forkable: true }
const mcp: McpListing = { id: 'com.stripe_mcp', name: 'stripe', vendor: 'Stripe', description: 'Payments.', version: '1', transports: ['http'], featured: false, official: true }

describe('catalog', () => {
  it('maps every source to one item shape', () => {
    expect(fromListing(listing)).toEqual({
      key: 'listing:lst_1',
      kind: 'agent',
      href: '/l/lst_1',
      title: 'Deep Research',
      summary: 'Writes the brief.',
      by: 'Orbital Labs',
      price: 'from $250.00 per job',
      listed: true,
    })
    expect(fromListing({ ...listing, publisherName: undefined, price: '0' })).toMatchObject({ by: 'orbital', price: null })
    expect(fromApp(app)).toMatchObject({ key: 'app:hanzo/chat', href: '/apps/hanzo/chat', title: 'chat', summary: '', by: 'hanzo' })
    expect(fromApp({ ...app, title: 'Hanzo Chat', description: 'Chat.' })).toMatchObject({ title: 'Hanzo Chat', summary: 'Chat.' })
    expect(fromSkill({ name: 'vector-search', service: 'vector', description: 'Search.', path: '/x' })).toMatchObject({
      href: '/skills/vector-search',
      by: 'Hanzo',
    })
    expect(fromMcp(mcp)).toMatchObject({ href: '/mcp/com.stripe_mcp', title: 'stripe', by: 'Stripe' })
    expect(fromMcp({ ...mcp, title: 'Stripe' }).title).toBe('Stripe')
    expect(PATH.mcp).toBe('/mcp')
  })

  it('matches every word, case-insensitively', () => {
    const item = fromListing(listing)
    expect(matches(item, '')).toBe(true)
    expect(matches(item, 'deep ORBITAL')).toBe(true)
    expect(matches(item, 'deep nothing')).toBe(false)
  })

  it('merges listings first, then by kind, then by title, once per key', () => {
    const a = fromApp({ ...app, title: 'Zulu' })
    const b = fromApp({ ...app, id: 'hanzo/b', name: 'b', title: 'Bravo' })
    const s = fromSkill({ name: '3d_3d', service: 's', description: '', path: '' })
    const m = fromMcp(mcp)
    const l = fromListing({ ...listing, kind: 'skill' })
    const out = merge([[s, a], [l, a, m, b]])
    expect(out.map((i) => i.key)).toEqual(['listing:lst_1', 'app:hanzo/b', 'app:hanzo/chat', 'mcp:com.stripe_mcp', 'skill:3d_3d'])
    expect(facets(out)).toEqual({ agent: 0, app: 2, skill: 2, mcp: 1 })
  })

  it('knows the four kinds', () => {
    expect(['agent', 'app', 'skill', 'mcp'].every(isKind)).toBe(true)
    expect(isKind('persona')).toBe(false)
  })
})
