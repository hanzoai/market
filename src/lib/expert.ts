// Experts: people, not software. An expert is a shop listing of kind `expert`,
// hired through the same job as an agent. This file is everything about them
// that is not a screen: the closed list of areas, how a profile reads, what the
// form may send, and which listing is a person's own.

import type { Expert, ExpertReq, Listing, ListingPatch, Shop, ShopListing } from '~/lib/market'
import { dollars, free, usd, valid } from '~/lib/money'

/** What an expert works on: the platform's closed list, in the order it is shown. */
export const AREAS = [
  { slug: 'configure', label: 'Configure Hanzo' },
  { slug: 'base', label: 'Build with Base' },
  { slug: 'commerce', label: 'Commerce' },
  { slug: 'bot', label: 'Bot' },
  { slug: 'agents', label: 'Agents' },
  { slug: 'cloud', label: 'Cloud' },
  { slug: 'models', label: 'Kai, Enso, Zen' },
  { slug: 'creative', label: 'Creative AI' },
  { slug: 'freelance', label: 'Freelance' },
] as const

export type Area = (typeof AREAS)[number]['slug']

/** What the freelance area means, said wherever it is offered or shown. */
export const FREELANCE = 'Freelance work for partners and companies building on Hanzo Cloud and the Hanzo OSS ecosystem'

export const isArea = (v: unknown): v is Area => AREAS.some((a) => a.slug === v)

/** An area's name, or the slug the platform sent if this list has not heard of it. */
export const areaLabel = (slug: string): string => AREAS.find((a) => a.slug === slug)?.label ?? slug

/** What the platform accepts of a profile. */
export const LIMITS = { title: 200, description: 4096, availability: 512, languages: 8 } as const

/** The languages the form offers, as lowercase BCP 47 codes. */
export const LANGUAGES = ['en', 'es', 'zh-cn', 'zh-tw', 'fr', 'de', 'pt', 'ja', 'ko', 'ru', 'ar', 'hi', 'it', 'nl', 'tr', 'pl', 'vi', 'id', 'uk', 'he'] as const

/** A language in English: "zh-cn" is "Chinese (China)". An unknown code is shown as it is. */
export function language(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

/** An IANA zone id the runtime knows. */
export function zone(id: string): boolean {
  if (!/^[A-Za-z]/.test(id)) return false
  try {
    return new Intl.DateTimeFormat('en', { timeZone: id }).resolvedOptions().timeZone !== ''
  } catch {
    return false
  }
}

/** Every zone to choose from, with `also` kept in the list when the runtime does not name it. */
export function zones(also: string): string[] {
  const all = Intl.supportedValuesOf('timeZone')
  return also && !all.includes(also) ? [also, ...all] : all
}

// ── reading the shop ─────────────────────────────────────────────────────────

/** The most one read of the shop returns. */
export const PAGE = 200

/** Every row of a paged read, asked for `PAGE` at a time until the server's total is read. */
export async function every(ask: (offset: number, limit: number) => Promise<Pick<Shop, 'listings' | 'total'>>): Promise<ShopListing[]> {
  const out: ShopListing[] = []
  for (let total = 1; out.length < total; ) {
    const page = await ask(out.length, PAGE)
    if (!page.listings.length) break
    out.push(...page.listings)
    total = page.total
  }
  return out
}

/** What a card and a page say of an expert: the shop's profile, the fixed price, and what reviewers made of them. */
export interface Profile extends Expert {
  /** The fixed engagement price, "0" when none. */
  price: string
  rating: number | null
  reviews: number
}

export function profile(l: ShopListing): Profile | undefined {
  if (l.kind !== 'expert' || !l.expert) return undefined
  return { ...l.expert, price: l.price, rating: l.reputation.rating, reviews: l.reputation.reviews }
}

/** What an expert asks, as short lines: an hourly rate and/or a fixed price. */
export function fees(p: Pick<Profile, 'rate' | 'price'>): string[] {
  return [...(free(p.rate) ? [] : [`${usd(p.rate)}/hr`]), ...(free(p.price) ? [] : [`${usd(p.price)} fixed`])]
}

/** An expert as the listing page's facts and the Markdown twin state them. */
export function facts(p: Profile): [string, string][] {
  return [
    ['Areas', p.areas.map(areaLabel).join(', ')],
    ...(free(p.rate) ? [] : ([['Rate', `${usd(p.rate)}/hr`]] as [string, string][])),
    ...(free(p.price) ? [] : ([['Fixed price', usd(p.price)]] as [string, string][])),
    ['Languages', p.languages.map(language).join(', ')],
    ['Time zone', p.timezone],
    ...(p.availability ? ([['Availability', p.availability]] as [string, string][]) : []),
    ['Verified', p.verified ? 'Yes' : 'No'],
  ]
}

/** What a hire opens at: an expert's fixed price, else one hour of their rate; any other listing's price. */
export function opening(l: ShopListing): string {
  const fixed = dollars(l.price)
  if (fixed || l.kind !== 'expert') return fixed ?? ''
  return dollars(l.expert?.rate ?? '') ?? ''
}

// ── writing a profile ────────────────────────────────────────────────────────

export interface Form {
  title: string
  description: string
  /** Hourly USD, empty when none. */
  rate: string
  /** Fixed engagement USD, empty when none. */
  price: string
  areas: string[]
  languages: string[]
  timezone: string
  availability: string
  /** Payout wallet id. */
  recipient: string
}

/** A dollar amount the form may send: none ("0"), or positive to the cent. Null when it is neither. */
function amount(raw: string): { value: string; positive: boolean } | null {
  const v = raw.trim()
  if (!v) return { value: '0', positive: false }
  if (!valid(v)) return null
  if (free(v)) return { value: '0', positive: false }
  return dollars(v) ? { value: v, positive: true } : null
}

/** Why the form cannot be saved yet, in a sentence, or null when it can. */
export function check(f: Form): string | null {
  const title = f.title.trim()
  if (!title) return 'Add your name or a headline.'
  if (title.length > LIMITS.title) return `A name or headline is at most ${LIMITS.title} characters.`
  if (f.description.trim().length > LIMITS.description) return `The description is at most ${LIMITS.description} characters.`
  if (!f.areas.length) return 'Pick at least one area.'
  if (!f.areas.every(isArea)) return 'Pick areas from the list.'
  if (!f.languages.length) return 'Pick at least one language.'
  if (f.languages.length > LIMITS.languages) return `Pick at most ${LIMITS.languages} languages.`
  if (!f.languages.every((l) => /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/.test(l))) return 'A language is a lowercase code such as en or zh-cn.'
  if (!zone(f.timezone)) return 'Pick a time zone.'
  if (f.availability.trim().length > LIMITS.availability) return `Availability is at most ${LIMITS.availability} characters.`
  const rate = amount(f.rate)
  const price = amount(f.price)
  if (!rate || !price) return 'A rate or a price is a dollar amount to the cent.'
  if (!rate.positive && !price.positive) return 'Name an hourly rate or a fixed price.'
  if (!f.recipient) return 'A paid listing needs a payout wallet.'
  return null
}

/** The fields a save sends. Call after `check` allows it. */
function fields(f: Form): Omit<ExpertReq, 'kind'> {
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    price: amount(f.price)?.value ?? '0',
    recipient: f.recipient,
    public: true,
    expert: {
      rate: amount(f.rate)?.value ?? '0',
      areas: AREAS.map((a) => a.slug).filter((s) => f.areas.includes(s)),
      languages: f.languages,
      timezone: f.timezone,
      availability: f.availability.trim(),
    },
  }
}

/** POST /v1/marketplace/listings: no `tool`, which the platform derives. */
export const create = (f: Form): ExpertReq => ({ kind: 'expert', ...fields(f) })

/** PATCH /v1/marketplace/listings/{id}: the same fields, and the whole profile. */
export const change = (f: Form): ListingPatch => fields(f)

/** The form for a person's own listing, or a blank one in their zone. */
export function fill(l: Listing | null, timezone: string): Form {
  const none = (a: string | undefined) => (a && !free(a) ? a : '')
  return {
    title: l?.title ?? '',
    description: l?.description ?? '',
    rate: none(l?.expert?.rate),
    price: none(l?.price),
    areas: l?.expert?.areas ?? [],
    languages: l?.expert?.languages ?? [],
    timezone: l?.expert?.timezone ?? timezone,
    availability: l?.expert?.availability ?? '',
    recipient: l?.recipient ?? '',
  }
}

/** The expert listing that is the caller's own: the platform marks it `self`, and an org's other members' listings are not. */
export const mine = (rows: Listing[]): Listing | null => rows.find((r) => r.kind === 'expert' && r.expert?.self) ?? null
