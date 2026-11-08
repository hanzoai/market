// Experts: people, not software. An expert is a shop listing of kind `expert`,
// hired through the same job as an agent. This file is everything about them
// that is not a screen: the closed list of areas, how a profile reads, what the
// form may send, and which listing is a person's own.

import type { Expert, ExpertReq, Listing, ListingPatch, Shop, ShopListing, ShopQuery } from '~/lib/market'
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

/** The products an expert's record is scored in, in the order the shop offers them. */
export const PRODUCTS = [
  { slug: 'dev', label: 'Dev' },
  { slug: 'bot', label: 'Bot' },
  { slug: 'team', label: 'Team' },
  { slug: 'base', label: 'Base' },
  { slug: 'commerce', label: 'Commerce' },
  { slug: 'cloud', label: 'Cloud' },
  { slug: 'agents', label: 'Agents' },
  { slug: 'kai', label: 'Kai' },
  { slug: 'enso', label: 'Enso' },
  { slug: 'zen', label: 'Zen' },
  { slug: 'creative', label: 'Creative AI' },
] as const

export type Product = (typeof PRODUCTS)[number]['slug']

export const isProduct = (v: unknown): v is Product => PRODUCTS.some((p) => p.slug === v)

/** A product's name, or the slug the platform sent if this list has not heard of it. */
export const productLabel = (slug: string): string => PRODUCTS.find((p) => p.slug === slug)?.label ?? slug

/** What the freelance area means, said wherever it is offered or shown. */
export const FREELANCE = 'Freelance work for partners and companies building on Hanzo Cloud and the Hanzo OSS ecosystem'

export const isArea = (v: unknown): v is Area => AREAS.some((a) => a.slug === v)

/** An area's name, or the slug the platform sent if this list has not heard of it. */
export const areaLabel = (slug: string): string => AREAS.find((a) => a.slug === slug)?.label ?? slug

/** What the platform accepts of a profile. */
export const LIMITS = { title: 200, description: 4096, availability: 512, languages: 8, skills: 20, skill: 40, links: 8, link: 200 } as const

/** How much of the week an expert offers, as a chip; the form adds a note to it. */
export const HOURS = [
  { slug: 'part-time', label: 'Part-time' },
  { slug: 'full-time', label: 'Full-time' },
  { slug: 'weekends', label: 'Weekends' },
] as const

export type Hours = (typeof HOURS)[number]['slug']

const SEP = ' · '

/** The availability a profile states: the chip's word, then the note. */
export const availability = (hours: Hours | '', note: string): string =>
  [HOURS.find((h) => h.slug === hours)?.label, note.trim()].filter(Boolean).join(SEP)

/** What `availability` was made of: a profile that begins with a chip's word, and the rest as its note. */
export function hoursOf(text: string): { hours: Hours | ''; note: string } {
  const said = text.trim()
  for (const h of HOURS) {
    const word = h.label.toLowerCase()
    const low = said.toLowerCase()
    if (low === word) return { hours: h.slug, note: '' }
    if (low.startsWith(word + SEP)) return { hours: h.slug, note: said.slice(word.length + SEP.length) }
  }
  return { hours: '', note: said }
}

/** A link a profile may carry: https, a host, no login, at most `LIMITS.link` long. */
export function link(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' && u.hostname !== '' && !u.username && v.length <= LIMITS.link
  } catch {
    return false
  }
}

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
  /** Jobs delivered and released. */
  jobs: number
}

export function profile(l: ShopListing): Profile | undefined {
  if (l.kind !== 'expert' || !l.expert) return undefined
  return { ...l.expert, price: l.price, rating: l.reputation.rating, reviews: l.reputation.reviews, jobs: l.reputation.jobs.completed }
}

// ── the directory: how it is ordered and narrowed, in the address ────────────

/** The orders the shop offers experts in; `newest` is its own when none is asked. */
export const SORTS = [
  { slug: 'newest', label: 'Newest' },
  { slug: 'tokens', label: 'Token tier' },
  { slug: 'level', label: 'Level' },
  { slug: 'points', label: 'Points' },
  { slug: 'rating', label: 'Rating' },
  { slug: 'jobs', label: 'Jobs delivered' },
  { slug: 'rate', label: 'Rate' },
] as const

/** Token milestones, lowest first: the tier is the highest one a member holds, never a count. */
export const TIERS = [
  { slug: '100k', label: '100K+' },
  { slug: '1m', label: '1M+' },
  { slug: '5m', label: '5M+' },
  { slug: '10m', label: '10M+' },
  { slug: '100m', label: '100M+' },
  { slug: '1b', label: '1B+' },
  { slug: '10b', label: '10B+' },
  { slug: '100b', label: '100B+' },
  { slug: '1t', label: '1T+' },
] as const

/** Levels a filter may ask for: the program's first four rungs above the start. */
export const LEVELS = [1, 2, 3, 4] as const

/** Badges an expert earns as an expert or on the models, by the id the program gives them. */
export const BADGES = [
  { slug: 'verified-expert', label: 'Verified Expert' },
  { slug: 'first-engagement-delivered', label: 'First Engagement Delivered' },
  { slug: 'five-jobs-delivered', label: 'Five Jobs Delivered' },
  { slug: 'zen-pioneer', label: 'Zen Pioneer' },
  { slug: 'enso-navigator', label: 'Enso Navigator' },
  { slug: 'kai-strategist', label: 'Kai Strategist' },
] as const

const among = (of: readonly { slug: string }[], v: string | null): string => (v && of.some((o) => o.slug === v) ? v : '')
const dollar = (v: string | null): string => (v && valid(v.trim()) ? v.trim() : '')

/** How the directory is asked: every field is empty when it is not narrowing or ordering anything. */
export interface Shelf {
  q: string
  area: string
  sort: string
  dir: 'asc' | 'desc'
  language: string
  verified: boolean
  minLevel: number
  badge: string
  tokenTier: string
  rateMin: string
  rateMax: string
  product: string
}

/** The directory as an address asks for it. What this list does not know is not asked. */
export function shelf(p: URLSearchParams): Shelf {
  const level = Number(p.get('minLevel'))
  return {
    q: p.get('q') ?? '',
    area: among(AREAS, p.get('area')),
    sort: among(SORTS, p.get('sort')),
    dir: p.get('dir') === 'asc' ? 'asc' : 'desc',
    language: (LANGUAGES as readonly string[]).includes(p.get('language') ?? '') ? (p.get('language') ?? '') : '',
    verified: p.get('verified') === 'true',
    minLevel: (LEVELS as readonly number[]).includes(level) ? level : 0,
    badge: among(BADGES, p.get('badge')),
    tokenTier: among(TIERS, p.get('tokenTier')),
    rateMin: dollar(p.get('rateMin')),
    rateMax: dollar(p.get('rateMax')),
    product: among(PRODUCTS, p.get('product')),
  }
}

/** What the shop is asked for the directory: only what narrows or orders it. `limit` and `offset` are the pager's. */
export function asked(s: Shelf, limit: number, offset: number): ShopQuery {
  return {
    kind: 'expert',
    q: s.q,
    area: s.area,
    sort: s.sort,
    dir: s.sort || s.product ? s.dir : undefined,
    language: s.language,
    verified: s.verified,
    minLevel: s.minLevel || undefined,
    badge: s.badge,
    tokenTier: s.tokenTier,
    rateMin: s.rateMin,
    rateMax: s.rateMax,
    product: s.product,
    limit,
    offset,
  }
}

/** The address with one more thing set, or cleared when it is empty, so a view can be passed along. */
export function keep(p: URLSearchParams, key: keyof Shelf, value: string | number | boolean): URLSearchParams {
  const next = new URLSearchParams(p)
  if (value === '' || value === 0 || value === false || (key === 'dir' && value === 'desc')) next.delete(key)
  else next.set(key, String(value))
  return next
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
  /** The chip: how much of the week, or none chosen. */
  hours: Hours | ''
  /** What the chip does not say. */
  note: string
  /** Which of the two fees the one rate field edits. */
  fee: 'rate' | 'price'
  /** What they know, as they name it. */
  skills: string[]
  /** Https addresses: their profile, their site, what they shipped. */
  links: string[]
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
  if (f.skills.length > LIMITS.skills || f.skills.some((k) => !k.trim() || k.length > LIMITS.skill)) return `A skill is at most ${LIMITS.skill} characters, and there are at most ${LIMITS.skills}.`
  if (f.links.length > LIMITS.links || !f.links.every(link)) return `A link is an https address, and there are at most ${LIMITS.links}.`
  if (!zone(f.timezone)) return 'Pick a time zone.'
  const hours = availability(f.hours, f.note)
  if (!hours) return 'Pick your availability.'
  if (hours.length > LIMITS.availability) return `Availability is at most ${LIMITS.availability} characters.`
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
      availability: availability(f.hours, f.note),
      skills: f.skills.map((k) => k.trim()),
      links: f.links,
    },
  }
}

/** POST /v1/marketplace/listings: no `tool`, which the platform derives. */
export const create = (f: Form): ExpertReq => ({ kind: 'expert', ...fields(f) })

/** PATCH /v1/marketplace/listings/{id}: the same fields, and the whole profile. */
export const change = (f: Form): ListingPatch => fields(f)

/** The form for a person's own listing. */
export function fill(l: Listing): Form {
  const none = (a: string | undefined) => (a && !free(a) ? a : '')
  const rate = none(l.expert?.rate)
  const price = none(l.price)
  return {
    title: l.title,
    description: l.description,
    rate,
    price,
    fee: rate || !price ? 'rate' : 'price',
    areas: l.expert?.areas ?? [],
    languages: l.expert?.languages ?? [],
    skills: l.expert?.skills ?? [],
    links: l.expert?.links ?? [],
    timezone: l.expert?.timezone ?? '',
    ...hoursOf(l.expert?.availability ?? ''),
    recipient: l.recipient,
  }
}

/** What the page knows before anyone types: this browser's zone and languages, and what GitHub's public record proposes, if it was read. */
export interface Known {
  timezone: string
  languages: string[]
  imported?: { name: string; bio: string; skills: string[]; areas: string[]; links: string[]; timezone: string } | null
}

/** A new profile, with what is known filled in and nothing invented: with nothing to read it is the same short card, empty. */
export function start({ timezone, languages, imported }: Known): Form {
  return {
    title: imported?.name ?? '',
    description: imported?.bio ?? '',
    rate: '',
    price: '',
    fee: 'rate',
    areas: AREAS.map((a) => a.slug).filter((s) => imported?.areas.includes(s)),
    languages: languages.length ? languages : ['en'],
    skills: imported?.skills ?? [],
    links: imported?.links ?? [],
    timezone: imported?.timezone || timezone,
    hours: '',
    note: '',
    recipient: '',
  }
}

/** One changed field of a profile, as the refresh shows it before anything is saved. */
export interface Change {
  field: 'title' | 'description' | 'skills' | 'links' | 'areas'
  label: string
  before: string
  after: string
}

/**
 * What a fresh read of GitHub would change in a profile: the name, the bio, the
 * skills and links as read, and the areas it suggests added to the ones held. A
 * field the read leaves empty is not a change; the person's own words are never
 * emptied by it. `next` is the form with those changes applied.
 */
export function refresh(form: Form, imported: NonNullable<Known['imported']>): { changes: Change[]; next: Form } {
  const next: Form = { ...form }
  const changes: Change[] = []
  const note = (field: Change['field'], label: string, before: string, after: string) => changes.push({ field, label, before, after })
  if (imported.name && imported.name !== form.title) {
    note('title', 'Name', form.title, imported.name)
    next.title = imported.name
  }
  if (imported.bio && imported.bio !== form.description) {
    note('description', 'Description', form.description, imported.bio)
    next.description = imported.bio
  }
  if (imported.skills.length && imported.skills.join('\n') !== form.skills.join('\n')) {
    note('skills', 'Skills', form.skills.join(', '), imported.skills.join(', '))
    next.skills = imported.skills
  }
  if (imported.links.length && imported.links.join('\n') !== form.links.join('\n')) {
    note('links', 'Links', form.links.join(', '), imported.links.join(', '))
    next.links = imported.links
  }
  const areas = AREAS.map((a) => a.slug).filter((a) => form.areas.includes(a) || imported.areas.includes(a))
  if (areas.join() !== form.areas.join()) {
    note('areas', 'Areas', form.areas.map(areaLabel).join(', '), areas.map(areaLabel).join(', '))
    next.areas = areas
  }
  return { changes, next }
}

/** The expert listing that is the caller's own: the platform marks it `self`, and an org's other members' listings are not. */
export const mine = (rows: Listing[]): Listing | null => rows.find((r) => r.kind === 'expert' && r.expert?.self) ?? null
