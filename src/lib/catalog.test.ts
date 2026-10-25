import { cards, fromApp, fromListing, fromMcp, fromPersona, fromSkill, fromTemplate, held, isKind, LABEL, matches, PATH, sellerName, shown, tally, wanted, type Shelf } from '~/lib/catalog'
import { KINDS, type AppEntry, type McpListing, type ShopListing } from '~/lib/market'
import { findPersona, personas, personaSummary } from '~/lib/personas'
import { findDefaultListing, findDefaultMcp, mergeMcpCatalog, mergeShop } from '~/lib/registry'
import { templates } from '~/lib/templates'

const rep = { rating: 4.5, reviews: 2, installs: 3, jobs: { completed: 1, disputed: 0 } }
const listing: ShopListing = {
  id: 'lst_1',
  publisherOrg: 'orbital',
  kind: 'agent',
  tool: 'deep-research',
  title: 'Deep Research',
  description: 'Writes the brief.',
  category: 'research',
  price: '250',
  currency: 'USD',
  public: true,
  createdAt: 1,
  updatedAt: 1,
  seller: { org: 'orbital', documented: true, reputation: rep },
  reputation: rep,
  links: { cli: 'hanzo marketplace jobs create --listing lst_1 --brief <brief> --amount <usd>', mcp: { tool: 'marketplace', op: 'post_marketplace_jobs' } },
}

const app: AppEntry = { id: 'hanzo/chat', org: 'hanzo', name: 'chat', kind: 'site', origin: 'product', forkable: true }
const mcp: McpListing = { id: 'com.stripe_mcp', name: 'stripe', vendor: 'Stripe', description: 'Payments.', version: '1', transports: ['http'], featured: false, official: true }

const apps = (from: number, n: number) => Array.from({ length: n }, (_, i) => fromApp({ ...app, id: `a/${from + i}`, name: String(from + i) }))
const shelf = (source: Shelf['source'], kind: Shelf['kind'], items: Shelf['items'], total: number): Shelf => ({ source, kind, items, total })

describe('catalog', () => {
  it('maps every source to one item shape', () => {
    expect(fromListing(listing)).toEqual({
      key: 'listing:lst_1',
      kind: 'agent',
      href: '/l/lst_1',
      title: 'Deep Research',
      summary: 'Writes the brief.',
      by: 'orbital',
      price: '$250.00 per job',
    })
    expect(fromListing({ ...listing, price: '0' })).toMatchObject({ price: null })
    expect(fromListing({ ...listing, kind: 'tool', price: '0.0025' })).toMatchObject({ price: '$0.0025 per call' })
    // The platform sells its tools from the reserved admin org; buyers know it as Hanzo.
    expect(fromListing({ ...listing, seller: { ...listing.seller, org: 'admin' } }).by).toBe('Hanzo')
    expect(sellerName('orbital')).toBe('orbital')
    expect(fromApp(app)).toMatchObject({ key: 'app:hanzo/chat', href: '/apps/hanzo/chat', title: 'chat', summary: '', by: 'hanzo' })
    expect(fromApp({ ...app, title: 'Hanzo Chat', description: 'Chat.' })).toMatchObject({ title: 'Hanzo Chat', summary: 'Chat.' })
    expect(fromSkill({ name: 'vector-search', service: 'vector', description: 'Search.', path: '/x' })).toMatchObject({
      href: '/skills/vector-search',
      by: 'Hanzo',
    })
    expect(fromMcp(mcp)).toMatchObject({ href: '/mcp/com.stripe_mcp', title: 'stripe', by: 'Stripe' })
    expect(fromMcp({ ...mcp, title: 'Stripe' }).title).toBe('Stripe')
    expect(fromPersona({ slug: 'ada', name: 'Ada Lovelace', category: 'pioneer', called: 'Ada', about: 'First programmer.' })).toMatchObject({
      key: 'persona:ada',
      kind: 'persona',
      href: '/personas/ada',
      title: 'Ada Lovelace (Ada)',
      summary: 'First programmer.',
      by: 'Hanzo OSS',
    })
    expect(fromPersona({ slug: 'plato', name: 'Plato', category: 'philosopher' })).toMatchObject({
      title: 'Plato',
      summary: personaSummary({ slug: 'plato', name: 'Plato', category: 'philosopher' }),
    })
    expect(fromTemplate({ slug: 'chat', title: 'Chat', category: 'AI', description: 'Chat app.' })).toMatchObject({
      key: 'template:chat',
      kind: 'template',
      href: '/templates/chat',
      title: 'Chat',
    })
  })

  it('names and routes the kinds cloud sells', () => {
    expect(KINDS.every(isKind)).toBe(true)
    expect(isKind('bot')).toBe(false)
    expect(KINDS.map((k) => PATH[k])).toEqual(['/agents', '/personas', '/apps', '/skills', '/mcp', '/tools', '/templates'])
    expect(LABEL.persona.many).toBe('Personas')
    expect(LABEL.template.many).toBe('Templates')
  })

  it('matches every word, case-insensitively', () => {
    const item = fromListing(listing)
    expect(matches(item, '')).toBe(true)
    expect(matches(item, 'deep ORBITAL')).toBe(true)
    expect(matches(item, 'deep nothing')).toBe(false)
  })

  it('stands the shelves in order, and shows a type its listings and its directory', () => {
    const all = [shelf('skills', 'skill', [], 0), shelf('apps', 'app', [], 0), shelf('listings', null, [], 0), shelf('mcp', 'mcp', [], 0)]
    expect(shown(all, '').map((s) => s.source)).toEqual(['listings', 'apps', 'mcp', 'skills'])
    expect(shown(all, 'app').map((s) => s.source)).toEqual(['listings', 'apps'])
    expect(shown(all, 'agent').map((s) => s.source)).toEqual(['listings'])
  })

  // Red market-5: the apps directory holds 453; one page of 60 was all anyone could reach.
  it('counts what the servers hold and pages each shelf from the server', () => {
    const l = shelf('listings', null, [fromListing(listing)], 1)
    const a = shelf('apps', 'app', apps(0, 48), 453)
    const s = shelf('skills', 'skill', [fromSkill({ name: 'x', service: 's', description: '', path: '' })], 1)
    const view = [l, a, s]
    expect(held(view)).toBe(455)
    expect(tally({ agent: 1, tool: 2 }, view)).toEqual({ agent: 1, persona: 0, app: 453, skill: 1, mcp: 0, tool: 2, template: 0 })
    expect(tally(null, view).app).toBe(453)

    // The first 48 cards: the listing, then apps; the skill waits behind all 453 apps.
    expect(cards(view, 48).map((i) => i.key)).toEqual(['listing:lst_1', ...apps(0, 47).map((i) => i.key)])
    expect(wanted(view, 48)).toEqual([])
    // Another page asks the apps server for the next ones, from where it left off.
    expect(wanted(view, 96)).toEqual([{ source: 'apps', offset: 48, limit: 47 }])
    // All the way down, the skill shelf is already whole.
    expect(wanted(view, 455)).toEqual([{ source: 'apps', offset: 48, limit: 405 }])
    const whole = [l, { ...a, items: apps(0, 453) }, s]
    expect(cards(whole, 1000)).toHaveLength(455)
    expect(cards(whole, 1000).at(-1)?.key).toBe('skill:x')
  })

  it('never shows a later shelf past one read only part way', () => {
    const view = [shelf('apps', 'app', apps(0, 2), 5), shelf('skills', 'skill', [fromSkill({ name: 'x', service: 's', description: '', path: '' })], 1)]
    expect(cards(view, 10).map((i) => i.kind)).toEqual(['app', 'app'])
  })

  it('searches and pages personas, templates, and the OSS registry', () => {
    expect(personas({ limit: 10 }).personas).toHaveLength(10)
    expect(personas({ q: 'Lovelace' }).total).toBeGreaterThanOrEqual(1)
    expect(personas({ category: 'pioneer' }).total).toBeGreaterThanOrEqual(1)
    expect(findPersona('ada')?.name).toBe('Ada Lovelace')
    expect(templates({ limit: 5 }).templates).toHaveLength(5)
    expect(templates({ q: 'dashboard', category: 'Dashboard' }).total).toBeGreaterThanOrEqual(1)

    const mergedShop = mergeShop(null, '', '')
    expect(mergedShop.listings.length).toBeGreaterThanOrEqual(20)
    expect(mergedShop.facets.kind.agent).toBeGreaterThanOrEqual(15)
    expect(mergedShop.facets.kind.tool).toBeGreaterThanOrEqual(10)
    expect(mergeShop(null, 'hanzo_dev', 'tool').listings).toHaveLength(1)
    expect(findDefaultListing('dev')?.title).toContain('Dev')
    expect(findDefaultListing('hanzo_dev')?.kind).toBe('tool')

    const mergedMcp = mergeMcpCatalog([mcp], '')
    expect(mergedMcp.total).toBeGreaterThan(20)
    expect(mergeMcpCatalog([], 'slack').total).toBeGreaterThanOrEqual(1)
    expect(findDefaultMcp('hanzo-mcp')?.official).toBe(true)
  })
})
