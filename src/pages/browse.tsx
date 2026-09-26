// The one catalog: published listings, apps, skills and MCP servers, searched
// together and faceted by type. Each source is paged from its server, and every
// count is the server's total, so everything a source holds is reachable.

import { useEffect, useState } from 'react'
import { Box, Text, XStack, YStack } from '@hanzo/ui'
import { Search } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { cards, fromApp, fromListing, fromMcp, fromSkill, held, LABEL, matches, PATH, shown, tally, wanted, type Item, type Shelf, type Source } from '~/lib/catalog'
import { unbuilt, unsigned, why } from '~/lib/http'
import { apps, KINDS, mcpCatalog, shop, skills, type Kind, type Shop } from '~/lib/market'
import { useRead, useRun } from '~/lib/read'
import { useSession } from '~/session'
import { Act, Column, Eyebrow, Failed, Nothing, Refusal } from '~/ui'

/** Cards drawn per page, and asked of a server at a time. */
export const PAGE = 48

interface Found {
  shelves: Shelf[]
  /** The shop's own counts by kind, or null when the shop did not answer. */
  listed: Partial<Record<Kind, number>> | null
  /** One sentence per source that could not answer, keyed by source. */
  notes: { source: string; says: string; signIn?: boolean }[]
}

/** One page of a server-paged source. */
function page(source: Source, q: string, type: Kind | '', offset: number, limit: number): Promise<{ items: Item[]; total: number; listed?: Shop['facets']['kind'] }> {
  if (source === 'listings')
    return shop({ q, kind: type, limit, offset }).then((r) => ({ items: r.listings.map(fromListing), total: r.total, listed: r.facets.kind }))
  if (source === 'apps') return apps({ q, limit, offset }).then((r) => ({ items: r.data.map(fromApp), total: r.total }))
  return mcpCatalog({ q, limit, offset }).then((r) => ({ items: r.catalog.map(fromMcp), total: r.total }))
}

/** The first page of every source: what this view shows, and every type's count. */
async function find(q: string, type: Kind | '', signedIn: boolean): Promise<Found> {
  const notes: Found['notes'] = []
  const [listed, built, skilled, served] = await Promise.allSettled([
    page('listings', q, type, 0, PAGE),
    page('apps', q, type, 0, PAGE),
    skills(),
    signedIn ? page('mcp', q, type, 0, PAGE) : Promise.reject(new Error('signed out')),
  ])
  const shelves: Shelf[] = []
  if (listed.status === 'fulfilled') shelves.push({ source: 'listings', kind: null, items: listed.value.items, total: listed.value.total })
  else if (unbuilt(listed.reason))
    notes.push({ source: 'listings', says: 'Listings published by sellers appear here once the public shop is live.' })
  else notes.push({ source: 'listings', says: `Seller listings: ${why(listed.reason)}` })

  if (built.status === 'fulfilled') shelves.push({ source: 'apps', kind: 'app', items: built.value.items, total: built.value.total })
  else notes.push({ source: 'apps', says: `Apps: ${why(built.reason)}` })

  if (skilled.status === 'fulfilled') {
    // The skills directory is one document: read whole, searched here.
    const hit = skilled.value.skills.map(fromSkill).filter((i) => matches(i, q))
    shelves.push({ source: 'skills', kind: 'skill', items: hit, total: hit.length })
  } else notes.push({ source: 'skills', says: `Skills: ${why(skilled.reason)}` })

  if (served.status === 'fulfilled') shelves.push({ source: 'mcp', kind: 'mcp', items: served.value.items, total: served.value.total })
  else if (!signedIn || unsigned(served.reason))
    notes.push({ source: 'mcp', says: 'Sign in to include MCP servers from the registry.', signIn: true })
  else notes.push({ source: 'mcp', says: `MCP servers: ${why(served.reason)}` })

  return { shelves, listed: listed.status === 'fulfilled' ? (listed.value.listed ?? null) : null, notes }
}

export function Browse({ kind }: { kind?: Kind }) {
  const session = useSession()
  const go = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const type: Kind | '' = kind ?? ''
  const [draft, setDraft] = useState(q)
  useEffect(() => setDraft(q), [q])

  const view = `${q}\n${type}\n${session.signedIn}`
  const found = useRead(session.loading ? null : () => find(q, type, session.signedIn), [view, session.loading])
  // What "Show more" read since, for this view only.
  const [more, setMore] = useState<{ view: string; pages: number; shelves: Shelf[] } | null>(null)
  const mine = more?.view === view ? more : null
  const shelves = mine?.shelves ?? found.it?.shelves ?? []
  const pages = mine?.pages ?? 1
  const visible = shown(shelves, type)
  const drawn = cards(visible, pages * PAGE)
  const left = held(visible) - drawn.length
  const counts = tally(found.it?.listed ?? null, shelves)
  const all = KINDS.reduce((n, k) => n + counts[k], 0)
  const reading = useRun()

  const showMore = () =>
    void reading.run(async () => {
      const next = pages + 1
      const asks = wanted(visible, next * PAGE)
      const got = await Promise.all(asks.map((a) => page(a.source, q, type, a.offset, a.limit).then((r) => [a.source, r.items] as const)))
      const add = new Map(got)
      setMore({ view, pages: next, shelves: shelves.map((s) => ({ ...s, items: [...s.items, ...(add.get(s.source) ?? [])] })) })
    })

  const search = (next: string) => {
    const p = new URLSearchParams(params)
    if (next) p.set('q', next)
    else p.delete('q')
    setParams(p)
  }
  const facet = (k: Kind | '') => go({ pathname: k ? PATH[k] : '/', search: q ? `?q=${encodeURIComponent(q)}` : '' })

  return (
    <YStack width="100%" pb="$8">
      <YStack items="center" gap="$4" px={32} pt="$10" pb="$6">
        <Eyebrow>Hanzo Market</Eyebrow>
        <Text render="h1" fontSize="$10" lineHeight="$10" fontWeight="600" color="$ink" text="center" maxW={880}>
          Agents, apps, skills and MCP servers
        </Text>
        <Text fontSize="$4" color="$soft" text="center" maxW={640}>
          Install what you need, hire an agent for a job, or sell what you build.
        </Text>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            search(draft.trim())
          }}
          style={{ width: '100%', maxWidth: 640 }}
        >
          <XStack gap="$2" items="center" px="$4" py="$2" rounded="$10" borderWidth={1} borderColor="$borderColor">
            <Search size={16} aria-hidden />
            <input
              type="search"
              aria-label="Search the marketplace"
              placeholder="Search agents, apps, skills, MCP servers"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', color: 'inherit', font: 'inherit', fontSize: 'var(--text-base)', minWidth: 0 }}
            />
            <button type="submit" style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}>
              <Text fontSize="$2" color="$soft">
                Search
              </Text>
            </button>
          </XStack>
        </form>
        <XStack gap="$2" flexWrap="wrap" justify="center" role="group" aria-label="Type">
          <Act on={!type} onPress={() => facet('')}>
            All {found.it ? all : ''}
          </Act>
          {KINDS.map((k) => (
            <Act key={k} on={type === k} onPress={() => facet(k)}>
              {LABEL[k].many} {found.it ? counts[k] : ''}
            </Act>
          ))}
        </XStack>
      </YStack>

      <Column gap="$4" py="$0">
        {found.failed ? <Failed what="search the marketplace" why={found.failed} /> : null}
        {found.it?.notes.map((n) => (
          <XStack key={n.source} items="center" gap="$3" flexWrap="wrap" data-note={n.source}>
            <Text fontSize="$2" color="$quiet">
              {n.says}
            </Text>
            {n.signIn && !session.signedIn ? (
              <Act onPress={session.signIn}>Sign in</Act>
            ) : null}
          </XStack>
        ))}
        {!found.it && !found.failed ? <Nothing says="Loading the catalog…" /> : null}
        {found.it && !drawn.length ? (
          <Nothing says={q ? `Nothing matches “${q}”.` : 'Nothing here yet.'} />
        ) : null}
        <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {drawn.map((item) => (
            <Card key={item.key} item={item} />
          ))}
        </Box>
        {left > 0 ? (
          <XStack justify="center" pt="$4">
            <Act disabled={reading.busy} onPress={showMore}>
              Show more · {left} left
            </Act>
          </XStack>
        ) : null}
        <Refusal says={reading.failed} />
      </Column>
    </YStack>
  )
}

export function Card({ item }: { item: Item }) {
  return (
    <Link to={item.href} style={{ textDecoration: 'none', display: 'flex' }} data-item={item.key}>
      <YStack
        flex={1}
        gap="$2"
        p="$5"
        rounded="$4"
        borderWidth={1}
        borderColor="$borderColor"
        hoverStyle={{ bg: '$hover' }}
      >
        <XStack items="center" justify="space-between" gap="$2">
          <Text fontSize="$1" color="$quiet">
            {LABEL[item.kind].one}
          </Text>
          <Text fontSize="$1" color={item.price ? '$ink' : '$quiet'}>
            {item.price ?? 'Free'}
          </Text>
        </XStack>
        <Text render="h3" fontSize="$5" fontWeight="600" color="$ink" numberOfLines={1}>
          {item.title}
        </Text>
        <Text fontSize="$2" color="$soft" numberOfLines={3} grow={1}>
          {item.summary || 'No description.'}
        </Text>
        <Text fontSize="$1" color="$quiet" numberOfLines={1}>
          {item.by}
        </Text>
      </YStack>
    </Link>
  )
}
