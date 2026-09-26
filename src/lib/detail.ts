// A listing page, whatever the item came from. Each source maps to one `Detail`,
// which carries everything the page shows: what it is, who offers it, its
// reputation, how to get it, and how to reach it from docs, the CLI and MCP.

import { web } from '~/lib/api'
import { fromApp, fromListing, fromMcp, fromSkill, sellerName, type Item } from '~/lib/catalog'
import type { AppEntry, McpListing, Reputation, ShopListing, SkillEntry } from '~/lib/market'
import { free } from '~/lib/money'

export const DOCS = 'https://docs.hanzo.ai'

/** How an item is obtained. */
export type Get =
  /** Free: activate it for the org in one call. */
  | { how: 'install'; tool: string }
  /** Connect a server from the MCP registry. */
  | { how: 'connect'; listing: string }
  /** Through checkout: a priced platform tool is paid per call; everything else a seller lists is hired for a job, clearance first. */
  | { how: 'checkout'; listing: string; hire: boolean }
  /** Nothing to install: open it where it lives. */
  | { how: 'open'; href: string }

export interface Detail {
  item: Item
  body: string
  facts: [string, string][]
  reputation: Reputation | null
  links: { label: string; href: string }[]
  get: Get
  /** The CLI line that does what the primary action does. */
  cli: string | null
  /** The MCP tool call that does the same, as hanzo-mcp exposes it. */
  mcp: { tool: string; op: string; input: Record<string, string> } | null
}

/** A listing's docs: an https URL, or a path on docs.hanzo.ai (cloud admits nothing else). */
export function docs(at: string | undefined): string | null {
  if (at?.startsWith('/') && !at.startsWith('//')) return `${DOCS}${at}`
  return web(at)
}

export function listingDetail(l: ShopListing): Detail {
  const tool = l.kind === 'tool'
  const get: Get = tool && free(l.price) ? { how: 'install', tool: l.tool } : { how: 'checkout', listing: l.id, hire: !tool }
  return {
    item: fromListing(l),
    body: l.description,
    facts: [
      ['Seller', sellerName(l.seller.org)],
      ['Tax form', l.seller.documented ? 'Certified' : 'Not on file'],
      [tool ? 'Tool' : 'Sells', l.tool],
      ...(l.category ? ([['Category', l.category]] as [string, string][]) : []),
      ['Listed', new Date(l.createdAt * 1000).toISOString().slice(0, 10)],
    ],
    reputation: l.reputation,
    links: [{ label: 'Documentation', href: docs(l.links.docs ?? l.docs) ?? `${DOCS}/docs/api` }],
    get,
    // The command and the MCP operation are the platform's own words for this listing.
    cli: l.links.cli,
    mcp: { tool: l.links.mcp.tool, op: l.links.mcp.op, input: tool ? { tool: l.tool } : { listing: l.id, brief: '<brief>', amount: '<usd>' } },
  }
}

export function appDetail(e: AppEntry): Detail {
  const url = web(e.url)
  const repo = web(e.repo)
  const links: { label: string; href: string }[] = []
  if (url) links.push({ label: 'Open app', href: url })
  if (repo) links.push({ label: 'Source', href: repo })
  links.push({ label: 'Documentation', href: `${DOCS}/docs/projects` })
  const facts: [string, string][] = [['Built by', e.org]]
  if (e.language) facts.push(['Language', e.language])
  if (e.archetype) facts.push(['Kind', e.archetype])
  if (e.license) facts.push(['License', e.license])
  if (e.updated) facts.push(['Updated', e.updated.slice(0, 10)])
  facts.push(['Forkable', e.forkable ? 'Yes' : 'No'])
  return {
    item: fromApp(e),
    body: e.description ?? '',
    facts,
    reputation: typeof e.stars === 'number' ? { rating: null, reviews: 0, installs: e.stars, jobs: { completed: 0, disputed: 0 } } : null,
    links,
    get: { how: 'open', href: url ?? repo ?? '' },
    cli: `hanzo catalog get --q ${e.name} --org ${e.org}`,
    mcp: { tool: 'catalog', op: 'get_catalog', input: { q: e.name, org: e.org } },
  }
}

export function skillDetail(s: SkillEntry, doc: string, base: string): Detail {
  return {
    item: fromSkill(s),
    body: doc || s.description,
    facts: [
      ['Service', s.service],
      ['Offered by', 'Hanzo'],
    ],
    reputation: null,
    links: [
      { label: 'SKILL.md', href: `${base}/.well-known/agent-skills/${encodeURIComponent(s.name)}/SKILL.md` },
      { label: 'Documentation', href: `${DOCS}/docs/api` },
    ],
    get: { how: 'install', tool: s.name },
    cli: `hanzo marketplace install --tool ${s.name}`,
    mcp: { tool: 'marketplace', op: 'post_marketplace_install', input: { tool: s.name } },
  }
}

export function mcpDetail(m: McpListing): Detail {
  const site = web(m.site)
  const repo = web(m.repo)
  const links: { label: string; href: string }[] = []
  if (site) links.push({ label: 'Website', href: site })
  if (repo) links.push({ label: 'Source', href: repo })
  links.push({ label: 'Documentation', href: `${DOCS}/docs/mcp` })
  return {
    item: fromMcp(m),
    body: m.description,
    facts: [
      ['Vendor', m.vendor],
      ['Version', m.version],
      ['Transports', m.transports.join(', ') || '—'],
      ...(m.official ? ([['Official', 'Yes']] as [string, string][]) : []),
    ],
    reputation: null,
    links,
    get: { how: 'connect', listing: m.id },
    cli: `hanzo tool mcp servers create --listing ${m.id}`,
    mcp: { tool: 'tool', op: 'post_tool_mcp_servers', input: { listing: m.id } },
  }
}

/** The MCP call as the JSON a client sends to hanzo-mcp. */
export function mcpCall(d: Detail): string | null {
  if (!d.mcp) return null
  return JSON.stringify({ name: d.mcp.tool, arguments: { op: d.mcp.op, input: d.mcp.input } })
}
