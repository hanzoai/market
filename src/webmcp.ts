// WebMCP (https://webmachinelearning.github.io/webmcp/): two read-only tools over
// the catalog this storefront shows, registered only where the browser exposes
// document.modelContext (or the earlier navigator.modelContext). Nothing here
// buys, installs or signs in.

import { fromApp, fromListing, fromMcp, fromPersona, fromSkill, fromTemplate, isKind, matches, type Item } from '~/lib/catalog'
import { listingDetail, mcpCall, type Detail } from '~/lib/detail'
import { apps, KINDS, mcpCatalog, shop, shopListing, skills, type Kind } from '~/lib/market'
import { SITE, twin } from '~/lib/pages'
import { personas } from '~/lib/personas'
import { findDefaultListing, findDefaultMcp, mergeMcpCatalog, mergeShop } from '~/lib/registry'
import { templates } from '~/lib/templates'
import { loadApp, loadMcp, loadPersona, loadSkill, loadTemplate } from '~/pages/item'

export interface Tool {
  name: string
  title: string
  description: string
  inputSchema: object
  annotations: { readOnlyHint: boolean }
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

interface ModelContext {
  registerTool(tool: Tool): Promise<void> | void
}

/** A search hit: what the catalog card says, where its page is, and a price only where the shop sets one. */
interface Hit {
  id: string
  kind: Kind
  title: string
  summary: string
  by: string
  url: string
  price?: string
  shop: boolean
}

const hit = (item: Item, shopped = false): Hit => ({
  id: item.key,
  kind: item.kind,
  title: item.title,
  summary: item.summary,
  by: item.by,
  url: SITE + item.href,
  ...(shopped ? { price: item.price ?? 'Free' } : {}),
  shop: shopped,
})

/** One source's hits, or the sentence it failed with. */
async function source(name: string, hits: () => Promise<Hit[]>): Promise<{ name: string; hits: Hit[]; failed?: string }> {
  try {
    return { name, hits: await hits() }
  } catch (e) {
    return { name, hits: [], failed: e instanceof Error ? e.message : String(e) }
  }
}

export const search: Tool = {
  name: 'search_market',
  title: 'Search Hanzo Market',
  description:
    'Search the Hanzo Market catalog: seller listings (agents to hire, tools sold per call), personas, apps, skills, MCP servers and templates. ' +
    'Every word must match the title, description or publisher. Returns each hit with its id, type, title, one-line summary, publisher and page URL; ' +
    'a price only for listings the shop sells. Pass an id to get_listing for the whole listing.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Words to match, e.g. "research agent" or "postgres".' },
      kind: { type: 'string', enum: [...KINDS], description: 'Only this type of listing.' },
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Most hits to return.' },
    },
    required: ['query'],
  },
  annotations: { readOnlyHint: true },
  async execute(input) {
    const q = typeof input.query === 'string' ? input.query.trim() : ''
    if (!q) throw new Error('query is empty')
    if (input.kind !== undefined && !isKind(input.kind)) throw new Error(`kind is one of ${KINDS.join(', ')}`)
    const kind: Kind | '' = isKind(input.kind) ? input.kind : ''
    const limit = Math.min(50, Math.max(1, Math.floor(Number(input.limit ?? 10)) || 10))
    const want = (k: Kind) => !kind || kind === k
    const reads = [
      source('shop', async () => {
        const remote = await shop({ q, kind, limit })
        const sold = new Set(remote.listings.map((l) => l.id))
        return mergeShop(remote, q, kind).listings.map((l) => hit(fromListing(l), sold.has(l.id)))
      }),
      ...(want('persona') ? [source('personas', async () => personas({ q, limit }).personas.map((p) => hit(fromPersona(p))))] : []),
      ...(want('app') ? [source('apps', async () => (await apps({ q, limit })).data.map((e) => hit(fromApp(e))))] : []),
      ...(want('skill') ? [source('skills', async () => (await skills()).skills.map(fromSkill).filter((i) => matches(i, q)).map((i) => hit(i)))] : []),
      ...(want('mcp') ? [source('mcp', async () => mergeMcpCatalog((await mcpCatalog({ q, limit })).catalog, q).catalog.map((m) => hit(fromMcp(m))))] : []),
      ...(want('template') ? [source('templates', async () => templates({ q, limit }).templates.map((t) => hit(fromTemplate(t))))] : []),
    ]
    const done = await Promise.all(reads)
    const hits = done.flatMap((s) => s.hits).filter((h) => !kind || h.kind === kind)
    const unavailable = done.filter((s) => s.failed).map((s) => ({ source: s.name, failed: s.failed }))
    return { query: q, kind: kind || 'all', hits: hits.slice(0, limit), more: hits.length > limit, ...(unavailable.length ? { unavailable } : {}) }
  },
}

/** The page's own Markdown twin, for every listing the build writes a page for: all but the MCP registry's mirror. */
const markdown = (d: Detail) => (d.item.key.startsWith('mcp:') && !findDefaultMcp(d.item.key.slice(4)) ? undefined : SITE + twin(d.item.href))

/** A shop listing, else the storefront directory's entry of that id, which the shop does not sell. */
async function listing(id: string): Promise<{ d: Detail; shop: boolean }> {
  try {
    return { d: listingDetail(await shopListing(id)), shop: true }
  } catch (e) {
    const entry = findDefaultListing(id)
    if (!entry) throw e
    return { d: listingDetail(entry), shop: false }
  }
}

async function read(id: string): Promise<{ d: Detail; shop: boolean }> {
  const at = id.indexOf(':')
  const [kind, rest] = at < 0 ? ['', ''] : [id.slice(0, at), id.slice(at + 1)]
  if (!rest) throw new Error(`no listing "${id}": ids look like listing:<id>, app:<org>/<name>, skill:<name>, persona:<slug>, mcp:<id>, template:<slug>, as search_market returns them`)
  const slash = rest.indexOf('/')
  if (kind === 'listing') return listing(rest)
  if (kind === 'app' && slash > 0) return { d: await loadApp(rest.slice(0, slash), rest.slice(slash + 1)), shop: false }
  if (kind === 'skill') return { d: await loadSkill(rest), shop: false }
  if (kind === 'persona') return { d: await loadPersona(rest), shop: false }
  if (kind === 'mcp') return { d: await loadMcp(rest), shop: false }
  if (kind === 'template') return { d: await loadTemplate(rest), shop: false }
  throw new Error(`no listing "${id}": ids look like listing:<id>, app:<org>/<name>, skill:<name>, persona:<slug>, mcp:<id>, template:<slug>`)
}

export const get: Tool = {
  name: 'get_listing',
  title: 'Read a Hanzo Market listing',
  description:
    'Return one listing whole: its type, title, publisher, description, facts, links, the hanzo CLI line and hanzo-mcp call that get it (both need a Hanzo credential: https://hanzo.market/auth.md), ' +
    'its reputation where the platform keeps one, and its page and Markdown URLs. Ids come from search_market.',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'A listing id from search_market, e.g. "listing:lst_659a85bc04eb13da" or "persona:ada".' } },
    required: ['id'],
  },
  annotations: { readOnlyHint: true },
  async execute(input) {
    const { d, shop: shopped } = await read(typeof input.id === 'string' ? input.id.trim() : '')
    return {
      id: d.item.key,
      kind: d.item.kind,
      title: d.item.title,
      by: d.item.by,
      summary: d.item.summary,
      body: d.body,
      ...(shopped ? { price: d.item.price ?? 'Free' } : {}),
      shop: shopped,
      facts: Object.fromEntries(d.facts),
      links: d.links,
      cli: d.cli,
      mcp: mcpCall(d),
      reputation: d.reputation,
      url: SITE + d.item.href,
      markdown: markdown(d),
    }
  },
}

const mc =
  (document as Document & { modelContext?: ModelContext }).modelContext ?? (navigator as Navigator & { modelContext?: ModelContext }).modelContext
if (typeof mc?.registerTool === 'function') {
  for (const tool of [search, get]) {
    try {
      Promise.resolve(mc.registerTool(tool)).catch((e: unknown) => console.warn('WebMCP:', tool.name, e))
    } catch (e) {
      console.warn('WebMCP:', tool.name, e)
    }
  }
}
