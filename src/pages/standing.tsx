// An expert's proven record on Hanzo, drawn from what the program shows of a public
// profile and what the platform scored them in each product. Nothing is drawn for
// a field the platform did not send: no empty box, no placeholder.

import { Text, XStack, YStack } from '@hanzo/ui'

import { productLabel } from '~/lib/expert'
import type { Badge, Mastery, Standing } from '~/lib/market'
import { PILLARS } from '~/lib/reward'
import '~/shine.css'

/** A small outlined mark: a badge, a tier, a product. */
function Mark({ children, shine, title }: { children: string; shine?: boolean; title?: string }) {
  return (
    <XStack render={<span title={title} />} className={shine ? 'shine' : undefined} px="$2" py="$1" rounded="$10" borderWidth={1} borderColor="$borderColor" data-mark="">
      <Text fontSize="$1" color="$soft">
        {children}
      </Text>
    </XStack>
  )
}

/** One badge: its name and the program's word for how rare it is. */
export function Held({ badge }: { badge: Badge }) {
  return (
    <Mark shine title={badge.rarity ? `${badge.name} · ${badge.rarity}` : badge.name}>
      {badge.rarity ? `${badge.name} · ${badge.rarity}` : badge.name}
    </Mark>
  )
}

/** Level, token tier and the rarest badges, on one wrapping line: the card's. */
export function Level({ standing }: { standing: Standing }) {
  return (
    <XStack gap="$1" flexWrap="wrap" items="center" data-standing="">
      <Mark>{`L${standing.level} ${standing.levelName}`}</Mark>
      {standing.tier ? <Mark>{`${standing.tier.label} tokens`}</Mark> : null}
      {standing.badges.map((b) => (
        <Held key={b.id} badge={b} />
      ))}
    </XStack>
  )
}

/** The page's: the level line, the lifetime points and the contributions by pillar that are not none. */
export function Record({ standing }: { standing: Standing }) {
  const by = PILLARS.filter((p) => (standing.pillars[p.id] ?? 0) > 0)
  return (
    <YStack gap="$2" data-record="">
      <Level standing={standing} />
      <Text fontSize="$2" color="$soft">
        {[`${standing.points.toLocaleString('en-US')} points`, ...by.map((p) => `${p.label} ${standing.pillars[p.id]}`)].join(' · ')}
      </Text>
    </YStack>
  )
}

/** A product's score as the platform made it, each recorded part said on hover. */
export function Product({ mastery }: { mastery: Mastery }) {
  const parts = Object.entries(mastery.parts).map(([k, v]) => `${k} ${v}`)
  return (
    <Mark title={parts.join(' · ')}>{`${productLabel(mastery.product)} ${Math.round(mastery.score)}`}</Mark>
  )
}

/** The products they are strongest in, and where they rank in the top three. */
export function Strengths({ products, top }: { products?: Mastery[]; top?: string[] }) {
  if (!products?.length && !top?.length) return null
  return (
    <XStack gap="$1" flexWrap="wrap" items="center" data-strengths="">
      {top?.map((p) => (
        <Mark key={`top-${p}`} shine>{`Top in ${productLabel(p)}`}</Mark>
      ))}
      {products?.map((m) => (
        <Product key={m.product} mastery={m} />
      ))}
    </XStack>
  )
}
