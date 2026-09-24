// One catalog out of four sources. Each source answers its own shape; this file
// is the only place those shapes become an `Item`, so browse, search, facets and
// the listing page all read one thing.

import type { AppEntry, Kind, McpListing, ShopListing, SkillEntry } from '~/lib/market'
import { free, perCall } from '~/lib/money'

export interface Item {
  /** Unique across sources. */
  key: string
  kind: Kind
  /** Storefront path of this item's page. */
  href: string
  title: string
  summary: string
  /** Who offers it: a publisher org, a vendor, or Hanzo. */
  by: string
  /** A price line, or null when free. */
  price: string | null
  /** A published marketplace listing (sold by an org) or a directory entry. */
  listed: boolean
}

export const LABEL: Record<Kind, { one: string; many: string }> = {
  agent: { one: 'Agent', many: 'Agents' },
  app: { one: 'App', many: 'Apps' },
  skill: { one: 'Skill', many: 'Skills' },
  mcp: { one: 'MCP server', many: 'MCP servers' },
}

/** Where each type is browsed. */
export const PATH: Record<Kind, string> = { agent: '/agents', app: '/apps', skill: '/skills', mcp: '/mcp' }

export function fromListing(l: ShopListing): Item {
  return {
    key: `listing:${l.id}`,
    kind: l.kind,
    href: `/l/${encodeURIComponent(l.id)}`,
    title: l.title,
    summary: l.description,
    by: l.publisherName || l.publisherOrg,
    price: free(l.price) ? null : perCall(l.price, l.kind),
    listed: true,
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
    listed: false,
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
    listed: false,
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
    listed: false,
  }
}

/** Case-insensitive match of every word in `q` against title, summary and seller. */
export function matches(item: Item, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = `${item.title} ${item.summary} ${item.by}`.toLowerCase()
  return words.every((w) => hay.includes(w))
}

/**
 * The order kinds are shown in when nothing narrows them: what people hire and
 * run first, then the skills directory, which is hundreds of per-operation
 * entries and would otherwise fill every page ahead of them.
 */
const RANK: Record<Kind, number> = { agent: 0, app: 1, mcp: 2, skill: 3 }

/** Listings first (they are what sellers publish), then by kind, then by title; one entry per key. */
export function merge(parts: Item[][]): Item[] {
  const seen = new Set<string>()
  const out: Item[] = []
  for (const item of parts.flat()) {
    if (seen.has(item.key)) continue
    seen.add(item.key)
    out.push(item)
  }
  return out.toSorted(
    (a, b) => Number(b.listed) - Number(a.listed) || RANK[a.kind] - RANK[b.kind] || a.title.localeCompare(b.title),
  )
}

export function facets(items: Item[]): Record<Kind, number> {
  const out: Record<Kind, number> = { agent: 0, app: 0, skill: 0, mcp: 0 }
  for (const item of items) out[item.kind] += 1
  return out
}

export function isKind(v: unknown): v is Kind {
  return v === 'agent' || v === 'app' || v === 'skill' || v === 'mcp'
}
