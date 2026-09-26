// One catalog out of four sources. Each source answers its own shape; this file
// is the only place those shapes become an `Item`, so browse, search, facets and
// the listing page all read one thing.
//
// Each source is a shelf, read from the server a page at a time. The catalog is
// the shelves end to end — seller listings first, then the directories in the
// order people shop them — and its counts are the servers' totals, never the
// number of cards loaded so far.

import { KINDS, type AppEntry, type Kind, type McpListing, type ShopListing, type SkillEntry } from '~/lib/market'
import { each, free } from '~/lib/money'

export interface Item {
  /** Unique across sources. */
  key: string
  kind: Kind
  /** Storefront path of this item's page. */
  href: string
  title: string
  summary: string
  /** Who offers it: a seller org, a vendor, or Hanzo. */
  by: string
  /** A price line, or null when free. */
  price: string | null
}

export const LABEL: Record<Kind, { one: string; many: string }> = {
  agent: { one: 'Agent', many: 'Agents' },
  persona: { one: 'Persona', many: 'Personas' },
  app: { one: 'App', many: 'Apps' },
  skill: { one: 'Skill', many: 'Skills' },
  mcp: { one: 'MCP server', many: 'MCP servers' },
  tool: { one: 'Tool', many: 'Tools' },
}

/** Where each type is browsed. */
export const PATH: Record<Kind, string> = {
  agent: '/agents',
  persona: '/personas',
  app: '/apps',
  skill: '/skills',
  mcp: '/mcp',
  tool: '/tools',
}

export function isKind(v: unknown): v is Kind {
  return typeof v === 'string' && (KINDS as readonly string[]).includes(v)
}

/** A seller as buyers know it: the reserved `admin` org is the platform itself, Hanzo. */
export const sellerName = (org: string) => (org === 'admin' ? 'Hanzo' : org)

export function fromListing(l: ShopListing): Item {
  return {
    key: `listing:${l.id}`,
    kind: l.kind,
    href: `/l/${encodeURIComponent(l.id)}`,
    title: l.title,
    summary: l.description,
    by: sellerName(l.seller.org),
    price: free(l.price) ? null : each(l.price, l.kind),
  }
}

export function fromApp(e: AppEntry): Item {
  return {
    key: `app:${e.id}`,
    kind: 'app',
    href: `/apps/${encodeURIComponent(e.org)}/${encodeURIComponent(e.name)}`,
    title: e.title || e.name,
    summary: e.description ?? '',
    by: e.org,
    price: null,
  }
}

export function fromSkill(s: SkillEntry): Item {
  return {
    key: `skill:${s.name}`,
    kind: 'skill',
    href: `/skills/${encodeURIComponent(s.name)}`,
    title: s.name,
    summary: s.description,
    by: 'Hanzo',
    price: null,
  }
}

export function fromMcp(m: McpListing): Item {
  return {
    key: `mcp:${m.id}`,
    kind: 'mcp',
    href: `/mcp/${encodeURIComponent(m.id)}`,
    title: m.title || m.name,
    summary: m.description,
    by: m.vendor,
    price: null,
  }
}

/** Case-insensitive match of every word in `q` against title, summary and seller. */
export function matches(item: Item, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = `${item.title} ${item.summary} ${item.by}`.toLowerCase()
  return words.every((w) => hay.includes(w))
}

export type Source = 'listings' | 'apps' | 'mcp' | 'skills'

/** One source, as far as it has been read. */
export interface Shelf {
  source: Source
  /** The one kind a directory holds; null for seller listings, which hold every kind. */
  kind: Kind | null
  /** What has been read, in the server's order. */
  items: Item[]
  /** How many the source holds for this search. */
  total: number
}

/** The order shelves stand in: what sellers publish, then what people hire and run, then the skills directory. */
const ORDER: Source[] = ['listings', 'apps', 'mcp', 'skills']

/** The shelves a view shows, in order: every shelf for all types, else the listings and that type's directory. */
export function shown(shelves: Shelf[], type: Kind | ''): Shelf[] {
  return shelves.filter((s) => !type || s.kind === null || s.kind === type).toSorted((a, b) => ORDER.indexOf(a.source) - ORDER.indexOf(b.source))
}

/** The first `want` cards of the shelves end to end, stopping where a shelf has not been read that far. */
export function cards(shelves: Shelf[], want: number): Item[] {
  const out: Item[] = []
  for (const s of shelves) {
    out.push(...s.items)
    if (s.items.length < s.total || out.length >= want) break
  }
  return out.slice(0, want)
}

/** How many cards the shelves hold in all. */
export const held = (shelves: Shelf[]) => shelves.reduce((n, s) => n + s.total, 0)

/** The reads that fill the first `want` cards: for each shelf short of its share, where to start and how many. */
export function wanted(shelves: Shelf[], want: number): { source: Source; offset: number; limit: number }[] {
  const out: { source: Source; offset: number; limit: number }[] = []
  let before = 0
  for (const s of shelves) {
    const share = Math.min(s.total, Math.max(0, want - before))
    if (s.items.length < share) out.push({ source: s.source, offset: s.items.length, limit: share - s.items.length })
    before += s.total
  }
  return out
}

/** Cards per type: the shop's own counts for listings, and each directory's total. */
export function tally(listed: Partial<Record<Kind, number>> | null, shelves: Shelf[]): Record<Kind, number> {
  const out = Object.fromEntries(KINDS.map((k) => [k, listed?.[k] ?? 0])) as Record<Kind, number>
  for (const s of shelves) if (s.kind) out[s.kind] += s.total
  return out
}
