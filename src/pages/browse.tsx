// The one catalog: published listings, apps, skills and MCP servers, searched
// together and faceted by type.

import { useEffect, useState } from 'react'
import { Box, Text, XStack, YStack } from '@hanzo/ui'
import { Search } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { facets, fromApp, fromListing, fromMcp, fromSkill, LABEL, matches, merge, PATH, type Item } from '~/lib/catalog'
import { unbuilt, unsigned, why } from '~/lib/http'
import { apps, KINDS, mcpCatalog, shop, skills, type Kind } from '~/lib/market'
import { useRead } from '~/lib/read'
import { useSession } from '~/session'
import { Act, Column, Eyebrow, Failed, Nothing } from '~/ui'

/** Cards drawn per page. The skills directory alone is hundreds of entries. */
export const PAGE = 48

interface Found {
  items: Item[]
  /** One sentence per source that could not answer, keyed by source. */
  notes: { source: string; says: string; signIn?: boolean }[]
}

async function find(q: string, signedIn: boolean): Promise<Found> {
  const notes: Found['notes'] = []
  const [listed, built, skilled, served] = await Promise.allSettled([
    shop({ q, limit: 60 }),
    apps({ q, limit: 60 }),
    skills(),
    signedIn ? mcpCatalog({ q, limit: 60 }) : Promise.reject(new Error('signed out')),
  ])
  const parts: Item[][] = []
  if (listed.status === 'fulfilled') parts.push(listed.value.listings.map(fromListing))
  else if (unbuilt(listed.reason))
    notes.push({ source: 'listings', says: 'Listings published by sellers appear here once the public shop is live.' })
  else notes.push({ source: 'listings', says: `Seller listings: ${why(listed.reason)}` })

  if (built.status === 'fulfilled') parts.push(built.value.data.map(fromApp))
  else notes.push({ source: 'apps', says: `Apps: ${why(built.reason)}` })

  if (skilled.status === 'fulfilled') parts.push(skilled.value.skills.map(fromSkill).filter((i) => matches(i, q)))
  else notes.push({ source: 'skills', says: `Skills: ${why(skilled.reason)}` })

  if (served.status === 'fulfilled') parts.push(served.value.catalog.map(fromMcp))
  else if (!signedIn || unsigned(served.reason))
    notes.push({ source: 'mcp', says: 'Sign in to include MCP servers from the registry.', signIn: true })
  else notes.push({ source: 'mcp', says: `MCP servers: ${why(served.reason)}` })

  return { items: merge(parts), notes }
}

export function Browse({ kind }: { kind?: Kind }) {
  const session = useSession()
  const go = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const type: Kind | '' = kind ?? ''
  const [draft, setDraft] = useState(q)
  const [pages, setPages] = useState(1)
  useEffect(() => setDraft(q), [q])
  useEffect(() => setPages(1), [q, type])

  const found = useRead(session.loading ? null : () => find(q, session.signedIn), [q, session.loading, session.signedIn])
  const all = found.it?.items ?? []
  const shown = type ? all.filter((i) => i.kind === type) : all
  const counts = facets(all)

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
            All {found.it ? all.length : ''}
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
        {found.it && !shown.length ? (
          <Nothing says={q ? `Nothing matches “${q}”.` : 'Nothing here yet.'} />
        ) : null}
        <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {shown.slice(0, pages * PAGE).map((item) => (
            <Card key={item.key} item={item} />
          ))}
        </Box>
        {shown.length > pages * PAGE ? (
          <XStack justify="center" pt="$4">
            <Act onPress={() => setPages((n) => n + 1)}>
              Show more · {shown.length - pages * PAGE} left
            </Act>
          </XStack>
        ) : null}
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
