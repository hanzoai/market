// What a person's public GitHub says of them, read by the browser from GitHub's
// own public API and nothing else: no token, no scraping, no guess that is not
// named as one. The account is the one IAM linked (`~/lib/linked`); this file only
// reads it and turns what it reads into the fields of an expert profile.

import { isArea, LANGUAGES, type Area } from '~/lib/expert'
import { Refusal, Silence, why } from '~/lib/http'

const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'

/** The most skills, links and repos read: what a card can carry, and what a person can review. */
export const MOST = { skills: 8, links: 8, shipped: 3, scanned: 10 } as const

export interface Account {
  login: string
  name: string
  bio: string
  company: string
  blog: string
  location: string
  url: string
}

export interface Repo {
  full: string
  fork: boolean
  archived: boolean
  language: string
  topics: string[]
  stars: number
  url: string
  pushed: string
}

/** What the account's public record proposes for an expert profile. */
export interface Imported {
  login: string
  name: string
  bio: string
  /** Top languages of their own repositories, then the repositories' topics. */
  skills: string[]
  /** Areas of the repositories that depend on Hanzo or Lux packages. */
  areas: Area[]
  /** Their profile, their site, and their most-starred repositories. */
  links: string[]
  /** A zone guessed from the location they wrote, or empty when it names none. */
  timezone: string
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

async function read(url: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  } catch (e) {
    throw new Silence(`api.github.com did not answer: ${why(e)}`)
  }
  if (res.status === 403 || res.status === 429) throw new Refusal(res.status, 'GitHub is limiting reads from this network. Try again in a little while.')
  if (!res.ok) throw new Refusal(res.status, res.status === 404 ? 'GitHub has no such account.' : `GitHub answered ${res.status}.`)
  return res.json()
}

/** The account IAM linked: GitHub's own record of it, by the numeric id IAM stores. */
export async function account(subject: string): Promise<Account> {
  const raw = (await read(`${API}/user/${encodeURIComponent(subject)}`)) as Record<string, unknown>
  const login = text(raw.login)
  if (!login) throw new Refusal(502, 'GitHub sent no login for this account.')
  return { login, name: text(raw.name), bio: text(raw.bio), company: text(raw.company), blog: text(raw.blog), location: text(raw.location), url: text(raw.html_url) }
}

/** The repositories the account owns, most recently pushed first. */
export async function repos(login: string): Promise<Repo[]> {
  const rows = (await read(`${API}/users/${encodeURIComponent(login)}/repos?per_page=100&type=owner&sort=pushed`)) as Record<string, unknown>[]
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    full: text(r.full_name),
    fork: r.fork === true,
    archived: r.archived === true,
    language: text(r.language),
    topics: Array.isArray(r.topics) ? r.topics.map(text).filter(Boolean) : [],
    stars: typeof r.stargazers_count === 'number' ? r.stargazers_count : 0,
    url: text(r.html_url),
    pushed: text(r.pushed_at),
  }))
}

/** What they made: their own repositories, not forks of someone else's. */
export const own = (all: Repo[]): Repo[] => all.filter((r) => r.full && !r.fork && !r.archived)

/** The values of `of` most often seen, most often first, ties in the order first seen. */
function top(values: string[], n: number): string[] {
  const count = new Map<string, number>()
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1)
  return [...count].toSorted((a, b) => b[1] - a[1]).slice(0, n).map(([v]) => v)
}

/** Languages of their own repositories, most used first, then the topics they filed them under; each once. */
export function skills(all: Repo[]): string[] {
  const mine = own(all)
  const out: string[] = []
  for (const s of [...top(mine.map((r) => r.language).filter(Boolean), 5), ...top(mine.flatMap((r) => r.topics), MOST.skills)]) {
    if (!out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s)
  }
  return out.slice(0, MOST.skills)
}

/** Their most-starred repositories: GitHub's public API does not say which are pinned. */
export const shipped = (all: Repo[]): Repo[] =>
  own(all)
    .filter((r) => r.stars > 0)
    .toSorted((a, b) => b.stars - a.stars || b.pushed.localeCompare(a.pushed))
    .slice(0, MOST.shipped)

/** An address someone typed in a profile, made https; null when it is not an address. */
export function site(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    u.protocol = 'https:'
    return u.hostname.includes('.') && !u.username ? u.toString() : null
  } catch {
    return null
  }
}

/** The links a profile carries: GitHub, their site, then what they shipped; https, each once. */
export function links(who: Pick<Account, 'url' | 'blog'>, made: Repo[]): string[] {
  const out: string[] = []
  for (const l of [site(who.url), site(who.blog), ...made.map((r) => site(r.url))]) if (l && l.length <= 200 && !out.includes(l)) out.push(l)
  return out.slice(0, MOST.links)
}

// ── the areas their dependencies suggest ─────────────────────────────────────

/** The product a Hanzo package or module is, by the last word of its name; any other Hanzo or Lux dependency is the ecosystem's. */
const PRODUCT: [RegExp, Area][] = [
  [/^base/, 'base'],
  [/^commerce/, 'commerce'],
  [/^bot/, 'bot'],
  [/^agents?/, 'agents'],
  [/^cloud/, 'cloud'],
  [/^(ai|zen|enso|kai|llm|ml|models?)/, 'models'],
  [/^(studio|design|creative|koma|iro|mori|oto|koe|uta)/, 'creative'],
]

/** A package or module of Hanzo or Lux: `@hanzo/x`, `@hanzogui/x`, `github.com/hanzoai/x`, `github.com/luxfi/x`. */
const OURS = /(?:^|["\s])(?:@hanzo(?:gui)?\/|github\.com\/(?:hanzoai|hanzo-inc|luxfi)\/)([a-z0-9][a-z0-9._-]*)/gi

/** The areas the Hanzo and Lux dependencies named in manifests (package.json, go.mod text) suggest. */
export function suggested(manifests: string[]): Area[] {
  const found = new Set<Area>()
  for (const m of manifests) {
    for (const hit of m.matchAll(OURS)) {
      const name = (hit[1] ?? '').toLowerCase()
      const area = PRODUCT.find(([re]) => re.test(name))?.[1] ?? 'freelance'
      if (isArea(area)) found.add(area)
    }
  }
  return [...found]
}

/** A repository's manifests as text, the ones it has. Raw files are not API reads; a missing one is simply absent. */
async function files(full: string): Promise<string[]> {
  const got = await Promise.all(
    ['package.json', 'go.mod'].map(async (file) => {
      try {
        const res = await fetch(`${RAW}/${full}/HEAD/${file}`)
        return res.ok ? await res.text() : ''
      } catch {
        return ''
      }
    }),
  )
  return got.filter(Boolean)
}

// ── where they are ───────────────────────────────────────────────────────────

/** Places a person writes that no IANA city name spells: a state, a country, a region. */
const PLACES: Record<string, string> = {
  ca: 'America/Los_Angeles', california: 'America/Los_Angeles', wa: 'America/Los_Angeles', washington: 'America/Los_Angeles', or: 'America/Los_Angeles', oregon: 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles', 'bay area': 'America/Los_Angeles', 'silicon valley': 'America/Los_Angeles', seattle: 'America/Los_Angeles', 'san diego': 'America/Los_Angeles', portland: 'America/Los_Angeles',
  ny: 'America/New_York', nyc: 'America/New_York', 'new york': 'America/New_York', ma: 'America/New_York', boston: 'America/New_York', fl: 'America/New_York', miami: 'America/New_York', dc: 'America/New_York',
  tx: 'America/Chicago', texas: 'America/Chicago', austin: 'America/Chicago', il: 'America/Chicago', chicago: 'America/Chicago',
  co: 'America/Denver', colorado: 'America/Denver', denver: 'America/Denver', ut: 'America/Denver', az: 'America/Phoenix',
  uk: 'Europe/London', 'united kingdom': 'Europe/London', england: 'Europe/London', germany: 'Europe/Berlin', france: 'Europe/Paris', spain: 'Europe/Madrid', italy: 'Europe/Rome', netherlands: 'Europe/Amsterdam', poland: 'Europe/Warsaw', ukraine: 'Europe/Kyiv',
  india: 'Asia/Kolkata', china: 'Asia/Shanghai', japan: 'Asia/Tokyo', korea: 'Asia/Seoul', 'south korea': 'Asia/Seoul', singapore: 'Asia/Singapore', vietnam: 'Asia/Ho_Chi_Minh', indonesia: 'Asia/Jakarta', turkey: 'Europe/Istanbul', israel: 'Asia/Jerusalem',
  australia: 'Australia/Sydney', canada: 'America/Toronto', brazil: 'America/Sao_Paulo', mexico: 'America/Mexico_City', argentina: 'America/Argentina/Buenos_Aires', nigeria: 'Africa/Lagos', egypt: 'Africa/Cairo', 'south africa': 'Africa/Johannesburg',
}

/** A zone the location names, or empty: first an IANA city of that name ("Berlin"), then a place from `PLACES`. A guess, and the form says so by letting it be changed. */
export function zoneOf(location: string, zones: readonly string[] = Intl.supportedValuesOf('timeZone')): string {
  const parts = location
    .toLowerCase()
    .split(/[,/|]/)
    .map((p) => p.replace(/\./g, '').trim())
    .filter(Boolean)
  for (const part of parts) {
    const city = zones.find((z) => z.split('/').at(-1)?.replace(/_/g, ' ').toLowerCase() === part)
    if (city) return city
    const place = PLACES[part]
    if (place && zones.includes(place)) return place
  }
  return ''
}

// ── the browser's languages ──────────────────────────────────────────────────

/** The languages the browser asks for, as the form's codes ("zh-CN" is "zh-cn", "pt-BR" is "pt"), the first three, each once. */
export function spoken(asked: readonly string[]): string[] {
  const known = LANGUAGES as readonly string[]
  const out: string[] = []
  for (const tag of asked) {
    const full = tag.toLowerCase()
    const code = known.includes(full) ? full : full.split('-')[0]
    if (code && known.includes(code) && !out.includes(code)) out.push(code)
  }
  return out.slice(0, 3)
}

// ── the whole read ───────────────────────────────────────────────────────────

/** What the linked account's public record proposes. `subject` is the id IAM stores for the link. */
export async function pull(subject: string): Promise<Imported> {
  const who = await account(subject)
  const all = await repos(who.login)
  const made = shipped(all)
  const recent = own(all).slice(0, MOST.scanned)
  const areas = suggested((await Promise.all(recent.map((r) => files(r.full)))).flat())
  return { login: who.login, name: who.name, bio: who.bio, skills: skills(all), areas, links: links(who, made), timezone: zoneOf(who.location) }
}
