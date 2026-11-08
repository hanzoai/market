// The Experts category: every person who can be booked, filtered by area and
// searched. An expert is read from the shop like any listing and hired through
// the same job; this page only lays them out, a page of 200 at a time until the
// shop's total is read.

import type { ReactNode } from 'react'
import { Box, Text, XStack, YStack } from '@hanzo/ui'
import { BadgeCheck, Star } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

import { fromListing, type Item } from '~/lib/catalog'
import { AREAS, areaLabel, every, fees, isArea, type Profile } from '~/lib/expert'
import { notServed } from '~/lib/http'
import { shop } from '~/lib/market'
import { useRead } from '~/lib/read'
import { Act, Column, Eyebrow, Failed, Go, Nothing, Pending, Find } from '~/ui'

/** Areas a card names before it says how many more. */
const SHOWN = 3

/** The platform's word that this person is who they say: never the expert's own. */
export function Verified() {
  return (
    <XStack items="center" gap="$1" data-verified="">
      <BadgeCheck size={14} aria-hidden />
      <Text fontSize="$1" color="$ink">
        Verified
      </Text>
    </XStack>
  )
}

/** What reviewers made of them; nothing is claimed before the first review. */
export function Rating({ rating, reviews }: { rating: number | null; reviews: number }) {
  if (rating === null) {
    return (
      <Text fontSize="$1" color="$quiet" data-rating="">
        No reviews yet
      </Text>
    )
  }
  return (
    <XStack items="center" gap="$1" data-rating="">
      <Star size={14} aria-hidden />
      <Text fontSize="$2" color="$ink">
        {rating.toFixed(1)}
      </Text>
      <Text fontSize="$1" color="$quiet">
        ({reviews})
      </Text>
    </XStack>
  )
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <XStack px="$2" py="$1" rounded="$10" borderWidth={1} borderColor="$borderColor" data-area="">
      <Text fontSize="$1" color="$soft">
        {children}
      </Text>
    </XStack>
  )
}

export function ExpertCard({ item, expert }: { item: Item; expert: Profile }) {
  const more = expert.areas.length - SHOWN
  return (
    <Link to={item.href} style={{ textDecoration: 'none', display: 'flex' }} data-item={item.key}>
      <YStack flex={1} gap="$2" p="$5" rounded="$4" borderWidth={1} borderColor="$borderColor" hoverStyle={{ bg: '$hover' }}>
        <XStack items="center" justify="space-between" gap="$2">
          <Text fontSize="$1" color="$quiet">
            Expert
          </Text>
          {expert.verified ? <Verified /> : null}
        </XStack>
        <Text render="h3" fontSize="$5" fontWeight="600" color="$ink" numberOfLines={1}>
          {item.title}
        </Text>
        <XStack gap="$1" flexWrap="wrap">
          {expert.areas.slice(0, SHOWN).map((a) => (
            <Chip key={a}>{areaLabel(a)}</Chip>
          ))}
          {more > 0 ? <Chip>{`+${more}`}</Chip> : null}
        </XStack>
        <Text fontSize="$3" color="$ink" data-fees="">
          {fees(expert).join(' · ')}
        </Text>
        <Text fontSize="$2" color="$soft" numberOfLines={1} grow={1}>
          {expert.availability}
        </Text>
        <Rating rating={expert.rating} reviews={expert.reviews} />
      </YStack>
    </Link>
  )
}

export function Experts() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const asked = params.get('area') ?? ''
  const area = isArea(asked) ? asked : ''
  const read = useRead(() => every((offset, limit) => shop({ kind: 'expert', area, q, limit, offset })), [q, area])

  const set = (key: 'q' | 'area', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  return (
    <YStack width="100%" pb="$8">
      <YStack items="center" gap="$4" px={32} pt="$10" pb="$6">
        <Eyebrow>Hanzo Market</Eyebrow>
        <Text render="h1" fontSize="$10" lineHeight="$10" fontWeight="600" color="$ink" text="center" maxW={880}>
          Experts
        </Text>
        <Text fontSize="$4" color="$soft" text="center" maxW={680}>
          People who build on Hanzo. Book one for a job.
        </Text>
        <Find q={q} label="Search experts" hint="Search experts" onSearch={(next) => set('q', next)} />
        <XStack gap="$2" flexWrap="wrap" justify="center" role="group" aria-label="Area">
          <Act on={!area} onPress={() => set('area', '')}>
            All
          </Act>
          {AREAS.map((a) => (
            <Act key={a.slug} on={area === a.slug} onPress={() => set('area', a.slug)}>
              {a.label}
            </Act>
          ))}
        </XStack>
        <Go to="/experts/join" loud>
          Become an expert
        </Go>
      </YStack>

      <Column gap="$4" py="$0">
        {read.failed ? (
          notServed(read.status) ? (
            <Pending what="Experts are not live yet" says={read.failed} />
          ) : (
            <Failed what="load the experts" why={read.failed} />
          )
        ) : null}
        {!read.it && !read.failed ? <Nothing says="Loading experts…" /> : null}
        {read.it && !read.it.length ? <Nothing says={q || area ? 'No experts match.' : 'No experts yet.'} /> : null}
        <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {read.it?.map(fromListing).map((item) => (item.expert ? <ExpertCard key={item.key} item={item} expert={item.expert} /> : null))}
        </Box>
      </Column>
    </YStack>
  )
}
