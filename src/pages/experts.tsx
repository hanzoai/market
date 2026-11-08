// The Experts category: every person who can be booked, filtered by area and
// searched. An expert is read from the shop like any listing and hired through
// the same job; this page only lays them out, a page of 200 at a time until the
// shop's total is read.

import { useEffect, useState, type ReactNode } from 'react'
import { Box, Text, XStack, YStack } from '@hanzo/ui'
import { BadgeCheck, Star } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

import { fromListing, type Item } from '~/lib/catalog'
import { BADGES, AREAS, areaLabel, asked, every, fees, keep, language, LANGUAGES, LEVELS, PRODUCTS, shelf, SORTS, TIERS, type Profile } from '~/lib/expert'
import { notServed } from '~/lib/http'
import { shop } from '~/lib/market'
import { useRead } from '~/lib/read'
import { Level, Strengths } from '~/pages/standing'
import { Act, Choice, Column, Eyebrow, Failed, Field, Go, Nothing, Pending, Find } from '~/ui'

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
        {expert.reward ? <Level standing={expert.reward} /> : null}
        <Strengths products={expert.products} top={expert.top} />
        <XStack gap="$1" flexWrap="wrap">
          {expert.areas.slice(0, SHOWN).map((a) => (
            <Chip key={a}>{areaLabel(a)}</Chip>
          ))}
          {more > 0 ? <Chip>{`+${more}`}</Chip> : null}
        </XStack>
        <Text fontSize="$3" color="$ink" data-fees="" grow={1}>
          {fees(expert).join(' · ')}
        </Text>
        <XStack items="center" gap="$3" flexWrap="wrap">
          <Rating rating={expert.rating} reviews={expert.reviews} />
          {expert.jobs > 0 ? (
            <Text fontSize="$1" color="$quiet" data-jobs="">
              {`${expert.jobs} ${expert.jobs === 1 ? 'job' : 'jobs'}`}
            </Text>
          ) : null}
        </XStack>
      </YStack>
    </Link>
  )
}

/** A dollar amount typed into the address: asked of the shop once the typing rests, never on each key. */
function Dollars({ label, value, commit }: { label: string; value: string; commit: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (draft === value) return undefined
    const rest = window.setTimeout(() => commit(draft), 400)
    return () => window.clearTimeout(rest)
  }, [draft, value, commit])
  return <Field label={label} value={draft} set={setDraft} enter={() => commit(draft)} name={label} />
}

export function Experts() {
  const [params, setParams] = useSearchParams()
  const s = shelf(params)
  const read = useRead(() => every((offset, limit) => shop(asked(s, limit, offset))), [params.toString()])

  // Each change starts from the address as it is this instant, not as this render saw it:
  // a router applies a change a moment after it is made, and two quick ones would lose the first.
  const set = (key: Parameters<typeof keep>[1], value: string | number | boolean) => {
    const next = keep(new URLSearchParams(window.location.search), key, value)
    // A product ranks by its own score, so choosing one leaves the other orders.
    if (key === 'product' && value) next.delete('sort')
    setParams(next)
  }
  const any = (label: string) => ({ value: '', label })

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
        <Find q={s.q} label="Search experts" hint="Search experts" onSearch={(next) => set('q', next)} />
        <XStack gap="$2" flexWrap="wrap" justify="center" role="group" aria-label="Area">
          <Act on={!s.area} onPress={() => set('area', '')}>
            All
          </Act>
          {AREAS.map((a) => (
            <Act key={a.slug} on={s.area === a.slug} onPress={() => set('area', a.slug)}>
              {a.label}
            </Act>
          ))}
        </XStack>
        <XStack gap="$2" flexWrap="wrap" justify="center" role="group" aria-label="Product">
          <Act on={!s.product} onPress={() => set('product', '')}>
            Any product
          </Act>
          {PRODUCTS.map((p) => (
            <Act key={p.slug} on={s.product === p.slug} onPress={() => set('product', p.slug)}>
              {p.label}
            </Act>
          ))}
        </XStack>
        <Go to="/experts/join" loud>
          Become an expert
        </Go>
      </YStack>

      <Column gap="$4" py="$0">
        <XStack gap="$3" flexWrap="wrap" items="flex-end" role="group" aria-label="Sort and filter">
          <Choice label="Sort" value={s.sort} set={(v) => set('sort', v)} of={[{ value: '', label: s.product ? 'Product score' : 'Newest' }, ...SORTS.filter((o) => o.slug !== 'newest').map((o) => ({ value: o.slug, label: o.label }))]} />
          <Act label="Direction" on={s.dir === 'asc'} onPress={() => set('dir', s.dir === 'asc' ? 'desc' : 'asc')}>
            {s.dir === 'asc' ? 'Ascending' : 'Descending'}
          </Act>
          <Choice label="Language" value={s.language} set={(v) => set('language', v)} of={[any('Any'), ...LANGUAGES.map((l) => ({ value: l, label: language(l) }))]} />
          <Choice label="Level" value={String(s.minLevel || '')} set={(v) => set('minLevel', Number(v))} of={[any('Any'), ...LEVELS.map((l) => ({ value: String(l), label: `L${l}+` }))]} />
          <Choice label="Token tier" value={s.tokenTier} set={(v) => set('tokenTier', v)} of={[any('Any'), ...TIERS.map((t) => ({ value: t.slug, label: t.label }))]} />
          <Choice label="Badge" value={s.badge} set={(v) => set('badge', v)} of={[any('Any'), ...BADGES.map((b) => ({ value: b.slug, label: b.label }))]} />
          <Dollars label="Lowest rate (USD/hr)" value={s.rateMin} commit={(v) => set('rateMin', v)} />
          <Dollars label="Highest rate (USD/hr)" value={s.rateMax} commit={(v) => set('rateMax', v)} />
          <Act on={s.verified} onPress={() => set('verified', !s.verified)}>
            Verified
          </Act>
        </XStack>
        {read.failed ? (
          notServed(read.status) ? (
            <Pending what="Experts are not live yet" says={read.failed} />
          ) : (
            <Failed what="load the experts" why={read.failed} />
          )
        ) : null}
        {!read.it && !read.failed ? <Nothing says="Loading experts…" /> : null}
        {read.it && !read.it.length ? <Nothing says={params.size ? 'No experts match.' : 'No experts yet.'} /> : null}
        <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {read.it?.map(fromListing).map((item) => (item.expert ? <ExpertCard key={item.key} item={item} expert={item.expert} /> : null))}
        </Box>
      </Column>
    </YStack>
  )
}
