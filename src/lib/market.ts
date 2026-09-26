// Every api.hanzo.ai operation this storefront calls, named once, with the shapes
// cloud answers (hanzo-inc/cloud 725e61052: apps/marketplace, apps/principals,
// apps/x402, apps/wallet, apps/tax). Money is an exact decimal string (USD);
// times are unix seconds.
//
// An operation api.hanzo.ai does not route yet answers 404, and the page that
// asked says "not live yet" rather than inventing an answer.

import { hashMessage } from 'viem'

import { blob, Refusal, request, text } from '~/lib/http'
import { held } from '~/lib/job'
import { dollars } from '~/lib/money'
import { store, subject } from '~/lib/token'
import { digest, nonce, payment, rail, terms, vet, type Authorization } from '~/lib/x402'

/** What a listing sells. A tool is the platform's, sold per call; everything else is hired for a job. */
export type Kind = 'agent' | 'persona' | 'app' | 'skill' | 'mcp' | 'tool'
/** In the order the shop facets them. */
export const KINDS: readonly Kind[] = ['agent', 'persona', 'app', 'skill', 'mcp', 'tool']

// ── /v1/marketplace: the shop and an org's listings ─────────────────────────

export interface Reputation {
  /** 1–5 to one decimal, null until the first review. */
  rating: number | null
  reviews: number
  installs: number
  jobs: { completed: number; disputed: number }
}

/** One of the caller org's own listings. */
export interface Listing {
  id: string
  publisherOrg: string
  kind: Kind
  /** The thing sold, as the seller named it. */
  tool: string
  /** The id the owning app knows the thing by. */
  ref: string
  title: string
  description: string
  category: string
  /** Per call for a tool, per job otherwise; "0" is free. */
  price: string
  currency: string
  /** Payout wallet id in publisherOrg. */
  recipient: string
  public: boolean
  docs?: string
  createdAt: number
  updatedAt: number
}

/** A public listing as anyone may read it. */
export interface ShopListing {
  id: string
  publisherOrg: string
  kind: Kind
  tool: string
  title: string
  description: string
  category: string
  price: string
  currency: string
  public: boolean
  docs?: string
  createdAt: number
  updatedAt: number
  /** What anyone may know about the seller: documented is a certified, valid tax form. */
  seller: { org: string; documented: boolean; reputation: Reputation }
  reputation: Reputation
  /** The ways to act on it: its docs, the hanzo command and the MCP operation that buy it. */
  links: { docs?: string; cli: string; mcp: { tool: string; op: string } }
}

export interface Shop {
  listings: ShopListing[]
  /** How many listings the search matched, past this page. */
  total: number
  /** Counts by kind, category, price and rating, each as if its own filter were not applied. */
  facets: { kind: Partial<Record<Kind, number>>; category: Record<string, number>; price: Record<string, number>; rating: Record<string, number> }
}

export interface PublishReq {
  kind: Kind
  tool: string
  title: string
  description?: string
  category?: string
  price?: string
  currency?: string
  recipient?: string
  public?: boolean
  docs?: string
}

export type ListingPatch = Partial<Omit<PublishReq, 'tool' | 'kind'>>

/** GET /v1/marketplace/shop — every public listing, any org, no sign-in. 48 a page by default, 200 at most. */
export const shop = (q: { q?: string; kind?: Kind | ''; limit?: number; offset?: number }) =>
  request<Shop>({ path: '/v1/marketplace/shop', query: q, anonymous: true })

/** GET /v1/marketplace/shop/{id}. */
export const shopListing = (id: string) =>
  request<ShopListing>({ path: `/v1/marketplace/shop/${encodeURIComponent(id)}`, anonymous: true })

/** GET /v1/marketplace/listings — the caller org's own listings. */
export const ownListings = () => request<{ listings: Listing[] }>({ path: '/v1/marketplace/listings' })

/** POST /v1/marketplace/listings → 201. An org admin publishes. */
export const publish = (req: PublishReq) =>
  request<Listing>({ method: 'POST', path: '/v1/marketplace/listings', body: req })

/** PATCH /v1/marketplace/listings/{id}. */
export const updateListing = (id: string, patch: ListingPatch) =>
  request<Listing>({ method: 'PATCH', path: `/v1/marketplace/listings/${encodeURIComponent(id)}`, body: patch })

/** DELETE /v1/marketplace/listings/{id} → 204. */
export const unpublish = (id: string) =>
  request<void>({ method: 'DELETE', path: `/v1/marketplace/listings/${encodeURIComponent(id)}` })

/** POST /v1/marketplace/install — activates one tool for the caller's org and project. */
export const install = (tool: string) =>
  request<{ tool: string; installed: boolean }>({ method: 'POST', path: '/v1/marketplace/install', body: { tool } })

/** POST /v1/marketplace/uninstall. */
export const uninstall = (tool: string) =>
  request<{ tool: string; installed: boolean }>({ method: 'POST', path: '/v1/marketplace/uninstall', body: { tool } })

// ── jobs: one org hires another, paid once over x402 at release ─────────────

export type JobStatus = 'quoted' | 'open' | 'accepted' | 'delivered' | 'released' | 'disputed' | 'declined' | 'cancelled' | 'refunded'

/** What a payment is for, as the economic event says it. */
export type Category = 'service' | 'goods' | 'transfer' | 'royalty'

export interface Job {
  id: string
  /** Empty for a direct offer. */
  listing: string
  title: string
  buyerOrg: string
  sellerOrg: string
  amount: string
  currency: string
  category: Category
  status: JobStatus
  /** An unpaid ending (declined, cancelled, refunded) waiting on the rail to return the money; the job takes no other step. */
  ending?: 'declined' | 'cancelled' | 'refunded'
  brief: string
  /** ISO 3166-1 alpha-2, where the work is performed. */
  performed?: string
  /** When delivery must land by. */
  deadline?: number
  /** Seconds the buyer has after delivery to release or dispute. */
  review: number
  /** The latest clearance: GET /v1/principal/clearance/{id}. */
  clearance: string
  delivery?: { note: string; url?: string; hash: string; at: number }
  /** contested: the clock's own dispute, raised when the payment stopped clearing. */
  dispute?: { reason: string; by: string; at: number; contested?: boolean }
  escrow: { rail: 'x402' | 'chain'; network: string; contract: string; payTo?: string; txHash?: string }
  history: { status: JobStatus; at: number; by: string }[]
  createdAt: number
  updatedAt: number
}

export interface HireReq {
  listing: string
  brief: string
  /** U.S. dollars to the cent. */
  amount: string
  category?: Category
  /** ISO 3166-1 alpha-2; it decides whether a foreign seller's pay is U.S.-source. */
  performed?: string
  /** When delivery must land by, unix seconds. */
  deadline: number
  /** The buyer org's wallet the payment is signed from. */
  wallet: string
}

/** What the buyer's wallet is: its id, to sign with, its address, which signs, and the chain it is for. */
export interface Payer {
  id: string
  address: string
  /** As cloud stores it: "eip155:<n>", a bare chain id, or empty for none. */
  chain?: string
}

/** What a hire needs of the authorization past its deadline: 3 days' review, 14 for a ruling, 1 for the clock (jobs.go). */
export const TAIL = (3 + 14 + 1) * 86_400

/**
 * One hire, from its first ask to the job it opens. It keeps what it sent, so
 * asking again after an answer that never came back is the same request: the same
 * terms and deadline, which cloud answers with the quote it already made (within
 * the hour), and once signed the same payment, which cloud answers with the job it
 * opened (jobs.go fund: "send the same payment again"). Only a new attempt quotes,
 * signs and opens anew.
 *
 * The authorization is drawn once per attempt, before the wallet is asked to sign
 * it: a signature whose answer was lost is asked for again over the same nonce,
 * even for a quote that names another job, so however many signatures one attempt
 * leaves, EIP-3009 lets at most one of them move money.
 */
export interface Attempt {
  /** Which attempt this is, drawn when it starts. */
  id: string
  req: HireReq
  from: Payer
  /** The authorization's validity and nonce, drawn once, before anything is signed. */
  auth?: { validAfter: string; validBefore: string; nonce: string }
  /** The payment the wallet signed for the quoted job, and what it pays. */
  signed?: { job: string; payment: string; amount: string; payTo: string }
}

/**
 * POST /v1/marketplace/jobs, both steps. Sent without a payment, cloud clears the
 * terms and answers 402 with the x402 terms to sign for the job; this page checks
 * them against the job the buyer cleared (x402 `vet`), the buyer's wallet signs
 * them on the platform, and the same request goes again with the signed payment,
 * which opens the job (201) with the amount set aside in that wallet. The
 * authorization stays valid through the deadline, the review window, a ruling on
 * a dispute and a day for the clock, as cloud requires.
 *
 * The authorization, then the signed payment, are kept on `a`, and handed to the
 * keeper, before each is used, so a retry of an attempt whose answer was lost —
 * even from a page loaded since, or another tab — signs the same authorization,
 * or re-sends the same payment, rather than another. Before each step the attempt
 * is read back from the keeper, taking up what another tab did with it meanwhile;
 * one no longer kept was answered or dropped there, and nothing more is sent.
 */
export async function hire(a: Attempt, keeper?: Keeper): Promise<Job> {
  const { req, from } = a
  rail(from)
  const sync = () => {
    if (!keeper) return
    const now = keeper.get()
    if (now?.id !== a.id) throw new Taken()
    a.auth ??= now.auth
    a.signed ??= now.signed
  }
  const put = () => {
    if (keeper && !keeper.put(a)) throw new Taken()
  }
  sync()
  const body = { listing: req.listing, brief: req.brief, amount: req.amount, category: req.category, performed: req.performed, deadline: req.deadline, wallet: req.wallet }
  if (!a.signed) {
    let required
    try {
      return await request<Job>({ method: 'POST', path: '/v1/marketplace/jobs', body })
    } catch (e) {
      if (!(e instanceof Refusal) || e.status !== 402) throw e
      required = terms(e.problem)
      if (!required) throw e
    }
    const { job, accepted } = vet(required, req.amount, from.address)
    sync()
    if (!a.auth) {
      a.auth = { validAfter: String(Math.floor(Date.now() / 1000) - 600), validBefore: String(req.deadline + TAIL + 3600), nonce: nonce() }
      put()
    }
    if (!a.signed) {
      const { validAfter, validBefore, nonce: once } = a.auth
      const auth: Authorization = { from: from.address, to: accepted.payTo, value: accepted.amount, validAfter, validBefore, nonce: once }
      const signed = await sign(from.id, digest(accepted, auth))
      if (signed.address.toLowerCase() !== from.address.toLowerCase()) throw new Error(`Wallet ${from.id} signed as ${signed.address}, not ${from.address}.`)
      // Another tab may have signed the same authorization meanwhile: its payment is the one kept and sent.
      sync()
      if (!a.signed) {
        a.signed = { job, payment: payment(required, accepted, auth, signed.signature), amount: req.amount, payTo: accepted.payTo }
        put()
      }
    }
  }
  return request<Job>({ method: 'POST', path: '/v1/marketplace/jobs', body: { ...body, payment: a.signed.payment } })
}

/** Where an attempt is kept while it is sent, shared with every tab. */
export interface Keeper {
  /** The attempt kept now, by this tab or another, or null. */
  get(): Attempt | null
  /** Keep this version of the attempt; false when another is kept in its place. */
  put(a: Attempt): boolean
}

/** The attempt was answered, dropped or replaced in another tab while this one sent it. */
export class Taken extends Error {
  constructor() {
    super('Another tab answered or dropped this hire while it was being sent here. Nothing more was sent.')
    this.name = 'Taken'
  }
}

/**
 * A job the buyer's org already has under way for exactly these terms — this
 * listing, brief and amount, its money still set aside — or null. Asked before a
 * new quote: an earlier attempt whose answer never came back may have opened it.
 */
export async function underway(req: Pick<HireReq, 'listing' | 'brief' | 'amount'>): Promise<Job | null> {
  const { jobs: mine } = await jobs('buyer')
  return mine.find((j) => j.listing === req.listing && j.brief === req.brief && dollars(j.amount) === req.amount && held(j)) ?? null
}

/**
 * Where this browser keeps a hire until the platform answers it: one per person,
 * org and listing, shared by every tab. It is under the session's `hanzo` prefix,
 * so a sign-out or another person's sign-in clears it with the rest (token `own`).
 */
const place = (org: string, listing: string) => `hanzo:hire:${subject() ?? ''}:${org}:${listing}`

const str = (v: unknown): v is string => typeof v === 'string'

const maybe = (v: unknown) => v === undefined || str(v)

/** The attempt stored as JSON, or null for anything that is not one. */
function attempt(v: unknown): Attempt | null {
  const a = v as Partial<Attempt> | null
  const r = a?.req
  const t = a?.auth
  const s = a?.signed
  const ok =
    str(a?.id) &&
    r &&
    str(r.listing) &&
    str(r.brief) &&
    str(r.amount) &&
    str(r.wallet) &&
    maybe(r.category) &&
    maybe(r.performed) &&
    Number.isSafeInteger(r.deadline) &&
    a.from &&
    str(a.from.id) &&
    str(a.from.address) &&
    maybe(a.from.chain) &&
    (t === undefined || (str(t.validAfter) && str(t.validBefore) && str(t.nonce))) &&
    (s === undefined || (str(s.job) && str(s.payment) && str(s.amount) && str(s.payTo)))
  return ok ? (a as Attempt) : null
}

/** Whether a storage change can be to a kept hire (null: storage was cleared). */
export const hires = (key: string | null): boolean => key === null || key.startsWith('hanzo:hire:')

/**
 * Keep a new version of an attempt that is kept — never over another tab's, and
 * never losing what another tab added to it: an authorization or a payment already
 * kept stays, and is taken into `a`. A reload, another tab, or a page left and come
 * back to then finds the payment it signed and sends that again, instead of signing
 * a second one that could open a second job while the first may still be funding.
 * False when it was not kept.
 */
export function save(org: string, listing: string, a: Attempt): boolean {
  const had = saved(org, listing)
  if (had?.id !== a.id) return false
  a.auth = had.auth ?? a.auth
  a.signed = had.signed ?? a.signed
  return write(org, listing, a)
}

/** Whether the kept copy carries an authorization or a payment that `a` does not. */
const beyond = (had: Attempt, a: Attempt): boolean =>
  (had.auth !== undefined && had.auth.nonce !== a.auth?.nonce) || (had.signed !== undefined && had.signed.payment !== a.signed?.payment)

function write(org: string, listing: string, a: Attempt): boolean {
  try {
    const s = store()
    s?.setItem(place(org, listing), JSON.stringify(a))
    return s !== null
  } catch {
    return false
  }
}

/**
 * Start keeping a new attempt — unless another is already kept for this listing,
 * by this tab or any other, which is returned instead: it is the one to answer.
 * Asked at the last moment before the first request, so a tab whose screen is
 * older than another tab's lost hire never starts a second one. `kept` says
 * whether this browser keeps anything at all (storage can be refused).
 */
export function claim(org: string, listing: string, a: Attempt): { had: Attempt | null; kept: boolean } {
  const had = saved(org, listing)
  if (had && had.id !== a.id) return { had, kept: true }
  return { had: null, kept: write(org, listing, a) }
}

/** The keeper of one org's attempt at one listing, in this browser's storage. */
export const keep = (org: string, listing: string): Keeper => ({ get: () => saved(org, listing), put: (a) => save(org, listing, a) })

/**
 * Forget an attempt the platform answered — only that one, never another tab's,
 * and, unless it `opened` its job, never while the kept copy carries an
 * authorization or a payment another tab drew with it that this answer was not
 * to: that payment may still open a job. False when something else is kept.
 */
export function forget(org: string, listing: string, a: Attempt, opened = false): boolean {
  const had = saved(org, listing)
  if (had && (had.id !== a.id || (!opened && beyond(had, a)))) return false
  try {
    store()?.removeItem(place(org, listing))
  } catch {
    /* nothing was kept */
  }
  return true
}

/**
 * The attempt kept for this org and listing, or null. One whose authorization has
 * lapsed can fund nothing any more, so it is forgotten.
 */
export function saved(org: string, listing: string, now = Math.floor(Date.now() / 1000)): Attempt | null {
  try {
    const raw = store()?.getItem(place(org, listing))
    const a = raw ? attempt(JSON.parse(raw)) : null
    if (!a || a.req.listing !== listing) return null
    if (a.auth && Number(a.auth.validBefore) <= now) {
      store()?.removeItem(place(org, listing))
      return null
    }
    return a
  } catch {
    return null
  }
}

export const jobs = (role: 'buyer' | 'seller') =>
  request<{ jobs: Job[] }>({ path: '/v1/marketplace/jobs', query: { role } })

export const job = (id: string) => request<Job>({ path: `/v1/marketplace/jobs/${encodeURIComponent(id)}` })

export type JobAct = 'accept' | 'decline' | 'cancel' | 'deliver' | 'release' | 'dispute' | 'refund'

export const actOnJob = (id: string, act: JobAct, body?: { note?: string; url?: string; reason?: string }) =>
  request<Job>({ method: 'POST', path: `/v1/marketplace/jobs/${encodeURIComponent(id)}/${act}`, body: body ?? {} })

/** POST /v1/marketplace/jobs/{id}/feedback → 201: rate the other party of a settled job, once. */
export const rate = (id: string, rating: number, comment: string) =>
  request<{ id: string; rating: number }>({ method: 'POST', path: `/v1/marketplace/jobs/${encodeURIComponent(id)}/feedback`, body: { rating, comment } })

// ── the seller: onboarding, payout wallet, earnings ─────────────────────────

/** GET /v1/marketplace/seller — where the caller's org stands as a seller, in one read. An org admin reads it. */
export interface Onboarding {
  org: string
  ready: boolean
  /** identity, sanctions, tax_form, tax_invalid, payout. */
  missing: string[]
  identity: string
  entity?: string
  tax?: { form: string; certified: boolean; valid: boolean; expires?: number }
  sanctions: string
  sanctionsReason: string
  payout: { wallet?: string; address?: string; bound: boolean; boundAt?: number }
  earnings: {
    year: number
    currency: string
    /** Every settled payment to the org that year, from the economic events. */
    gross: string
    payments: number
    byRail: Record<string, string>
    /** True when the events were too many to read in one answer: gross is a floor. */
    partial?: boolean
  }
  received: { id: string; payer: string; kind: string; year: number; corrected?: boolean; superseded?: boolean; furnished: number }[]
  sources: { app: string; status: string }[]
}

export const seller = (year?: number) => request<Onboarding>({ path: '/v1/marketplace/seller', query: { year } })

/** What cloud asks a payout wallet to sign (apps/marketplace seller.go challengePayout). */
export interface Challenge {
  wallet: string
  address: string
  message: string
  digest: string
  expires: number
}

const PROOF = 'Hanzo marketplace payout wallet'

/**
 * Why a payout challenge is not one for `org`'s `wallet` to sign, or null when it
 * is. Its digest must be the EIP-191 hash of its message — which no transfer
 * authorization or transaction hash can be — and the message must be cloud's
 * proof naming exactly this org, this wallet and its address.
 */
export function unfit(c: Challenge, org: string, wallet: { id: string; address: string }): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(c.digest) || hashMessage(c.message) !== c.digest.toLowerCase()) return 'The challenge’s digest is not the hash of its message.'
  const lines = c.message.split('\n')
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const fits =
    lines.length === 6 &&
    lines[0] === PROOF &&
    lines[1] === `org: ${org}` &&
    lines[2] === `wallet: ${wallet.id}` &&
    eq(lines[3], `address: ${wallet.address}`) &&
    /^nonce: \S+$/.test(lines[4]) &&
    /^expires: \d+$/.test(lines[5])
  if (!fits) return `The challenge is not a proof of ${wallet.id} for ${org}.`
  if (c.wallet !== wallet.id || !eq(c.address, wallet.address)) return `The challenge names ${c.wallet} at ${c.address}, not ${wallet.id} at ${wallet.address}.`
  return null
}

/**
 * Bind the org's payout wallet: cloud issues a challenge naming the org, the
 * wallet and its address; this page checks it (`unfit`), the wallet signs its
 * digest on the platform, and cloud checks the signature is that address's
 * (POST /v1/marketplace/seller/payout[/verify]).
 */
export async function bindPayout(org: string, wallet: { id: string; address: string }): Promise<Onboarding['payout']> {
  const c = await request<Challenge>({ method: 'POST', path: '/v1/marketplace/seller/payout', body: { wallet: wallet.id } })
  const why = unfit(c, org, wallet)
  if (why) throw new Error(`${why} Nothing was signed.`)
  const signed = await sign(wallet.id, c.digest)
  if (signed.address.toLowerCase() !== wallet.address.toLowerCase()) throw new Error(`Wallet ${wallet.id} signed as ${signed.address}, not ${wallet.address}.`)
  return request<Onboarding['payout']>({ method: 'POST', path: '/v1/marketplace/seller/payout/verify', body: { signature: signed.signature } })
}

// ── catalogs ─────────────────────────────────────────────────────────────────

/** GET /v1/catalog — projects, apps and sites built on the platform. Public. */
export interface AppEntry {
  id: string
  org: string
  name: string
  title?: string
  kind: 'repo' | 'site'
  origin: 'template' | 'community' | 'third-party' | 'product'
  archetype?: string
  language?: string
  description?: string
  url?: string
  repo?: string
  forkable: boolean
  stars?: number
  updated?: string
  license?: string
}

export const apps = (q: { q?: string; org?: string; limit?: number; offset?: number }) =>
  request<{ data: AppEntry[]; total: number }>({ path: '/v1/catalog', query: q, anonymous: true })

/** GET /.well-known/agent-skills/index.json — the platform's skills directory. Public. */
export interface SkillEntry {
  name: string
  service: string
  description: string
  path: string
  sha256?: string
}

export interface SkillIndex {
  base_url?: string
  skill_count: number
  skills: SkillEntry[]
}

export const skills = () => request<SkillIndex>({ path: '/.well-known/agent-skills/index.json', anonymous: true })

export const skillDoc = (name: string) =>
  text({ path: `/.well-known/agent-skills/${encodeURIComponent(name)}/SKILL.md`, anonymous: true })

/** GET /v1/tool/catalog — the MCP server registry. Needs a session today. */
export interface McpListing {
  id: string
  name: string
  vendor: string
  title?: string
  description: string
  repo?: string
  site?: string
  version: string
  transports: string[]
  remotes?: { transport: string; url: string }[]
  featured: boolean
  official: boolean
  logo?: string
}

export const mcpCatalog = (q: { q?: string; limit?: number; offset?: number }) =>
  request<{ catalog: McpListing[]; total: number }>({ path: '/v1/tool/catalog', query: q })

export const mcpListing = (id: string) => request<McpListing>({ path: `/v1/tool/catalog/${encodeURIComponent(id)}` })

// ── what a seller can list ───────────────────────────────────────────────────

export interface McpServer {
  id: string
  name: string
  url: string
  listing?: string
  source: 'catalog' | 'org'
}

/** POST /v1/tool/mcp/servers — connect a registry server (`listing`) or register one (`url`). */
export const connectMcp = (req: { listing: string } | { name: string; url: string }) =>
  request<McpServer>({ method: 'POST', path: '/v1/tool/mcp/servers', body: req })

export const mcpServers = () => request<{ servers: McpServer[] }>({ path: '/v1/tool/mcp/servers' })

export interface Skill {
  id: string
  name: string
  description: string
  content: string
}

export const authoredSkills = () => request<{ skills: Skill[] }>({ path: '/v1/tool/skills/authored' })

export const authorSkill = (req: { name: string; description?: string; content: string }) =>
  request<{ skill: Skill }>({ method: 'POST', path: '/v1/tool/skills', body: req })

export interface Agent {
  id: string
  name: string
  description?: string
  status: string
}

export const agents = () => request<{ agents: Agent[] }>({ path: '/v1/agent' })

// ── the org as economic principal (cloud apps/principals) ───────────────────

/** A rule the platform cites for a decision. */
export interface Rule {
  code: string
  reason: string
}

/** Something that must happen before a payment (or that the org still lacks). */
export interface Step {
  code: string
  /** In words, from the platform. */
  what: string
  /** payer, payee, org, none, or "Hanzo platform reviewer". */
  who: string
  /** The operation that satisfies it, e.g. "PUT /v1/tax/profile". */
  where?: string
  rule: Rule
}

export interface WalletBrief {
  id: string
  name: string
  chain?: string
  address: string
  custody: string
}

/** GET /v1/principal — the caller's org as an economic principal. */
export interface Principal {
  org: string
  identity: { status: string; reason: string }
  entity?: { name: string; structure: string; jurisdiction: string; stage: string }
  tax?: { form: TaxForm; usPerson: boolean; country: string; residence: string; certified: boolean; valid: boolean; expires?: number }
  sanctions: { status: string; reason: string }
  wallets: WalletBrief[]
  compliance: { ready: boolean; missing: Step[] }
  sources: { app: string; status: string }[]
}

export const principal = () => request<Principal>({ path: '/v1/principal' })

/** POST /v1/company/kyc — open an identity-verification session per founder. */
export const startKyc = () =>
  request<{ provider: string; sessions: { email: string; ref: string; verifyUrl: string; status: string }[] }>({
    method: 'POST',
    path: '/v1/company/kyc',
    body: {},
  })

/** POST /v1/principal/clearance — a payment the caller means to make. */
export interface ClearIn {
  /** The org to be paid. */
  payee: string
  /** Gross USD in whole cents, "1250.00". */
  amount: string
  category?: 'services' | 'attorney' | 'rents' | 'royalties' | 'other' | 'merchandise'
  /** ledger (the default), x402 or chain. */
  rail?: string
  /** ISO 3166-1 alpha-2 where the service is performed. */
  performed?: string
}

/** The platform's decision on one payment, made before it and recorded. */
export interface Clearance {
  id: string
  payer: string
  payee: string
  amount: string
  category: string
  rail: string
  performed?: string
  allowed: boolean
  /** What the payer may treat the payee as: us, foreign or unknown. */
  status: string
  required_before_payment: Step[]
  reporting_obligations: { code: string; form: string; filer: string; jurisdiction: string; due: string; rule: Rule }[]
  settlement_methods: { rail: string; net: string; withheld: string; rule: Rule }[]
  withholding: { chapter?: string; rate?: string; amount?: string; reason: string; rule: Rule }
  facts_required: { code: string; question: string; blocks: boolean; rule: Rule }[]
  decidedAt: number
  notice: string
}

export const clearance = (req: ClearIn) =>
  request<Clearance>({ method: 'POST', path: '/v1/principal/clearance', body: req })

// ── wallets ──────────────────────────────────────────────────────────────────

export interface Wallet {
  id: string
  accountId: string
  name: string
  custody: string
  chain: string
  address: string
}

export const wallets = () => request<{ wallets: Wallet[] }>({ path: '/v1/wallet' })

export const createAccount = (name: string) =>
  request<{ id: string; name: string }>({ method: 'POST', path: '/v1/wallet/accounts', body: { name } })

/** POST /v1/wallet. `chain` is the EVM chain it is for, as "eip155:<n>"; the x402 rail pays on the Hanzo L1. */
export const createWallet = (req: { accountId: string; name: string; custody: 'mpc' | 'kms'; chain?: string }) =>
  request<Wallet>({ method: 'POST', path: '/v1/wallet', body: req })

/** POST /v1/wallet/{id}/sign — the org wallet signs a 32-byte digest, verbatim. */
export const sign = (wallet: string, hash: string) =>
  request<{ address: string; digest: string; signature: string; walletId: string }>({
    method: 'POST',
    path: `/v1/wallet/${encodeURIComponent(wallet)}/sign`,
    body: { digest: hash },
  })

// ── tax ──────────────────────────────────────────────────────────────────────

/** Form W-9 (a U.S. person), W-8BEN (a foreign individual), W-8BEN-E (a foreign entity). */
export type TaxForm = 'w9' | 'w8ben' | 'w8bene'

export type Classification =
  | 'individual'
  | 'c_corp'
  | 's_corp'
  | 'partnership'
  | 'trust_estate'
  | 'llc_c'
  | 'llc_s'
  | 'llc_p'

export interface Address {
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
  /** ISO 3166-1 alpha-2; US on a W-9. */
  country?: string
}

/** What a W-8 certifies beyond name and address (W-8BEN / W-8BEN-E lines). */
export interface W8Facts {
  /** Line 2: country of citizenship or incorporation, alpha-2. */
  country: string
  /** W-8BEN-E line 4. */
  chapter3?: string
  /** W-8BEN-E line 5, the FATCA status. */
  chapter4?: string
  noForeignTin?: boolean
  /** W-8BEN line 8, YYYY-MM-DD. */
  birth?: string
  /** Who signs a W-8BEN-E, e.g. "Director". */
  capacity?: string
}

export interface TaxProfile {
  form: TaxForm
  name: string
  businessName?: string
  classification?: Classification
  address: Address
  /** Masked. */
  tin: string
  tinType?: 'ssn' | 'ein'
  foreignTin?: string
  w8?: W8Facts
  consent?: { electronic: boolean }
  certification: { status: 'none' | 'pending' | 'certified' }
  valid: boolean
  expires?: number
  version: number
  updatedAt: number
}

export interface W9 {
  form: 'w9'
  name: string
  businessName?: string
  classification: Classification
  address: Address
  tin: string
  tinType: 'ssn' | 'ein'
  electronicConsent: boolean
}

export interface W8 {
  form: 'w8ben' | 'w8bene'
  name: string
  address: Address
  tin?: string
  foreignTin?: string
  w8: W8Facts
  electronicConsent: boolean
}

export const taxProfile = () => request<TaxProfile>({ path: '/v1/tax/profile' })

export const saveTaxProfile = (form: W9 | W8) =>
  request<TaxProfile>({ method: 'PUT', path: '/v1/tax/profile', body: form })

export const certifyTax = () => request<TaxProfile>({ method: 'POST', path: '/v1/tax/profile/certify', body: {} })

export interface Statement {
  id: string
  payer: { org: string; name: string; businessName?: string }
  kind: '1099-NEC' | '1099-MISC'
  year: number
  corrected: boolean
  boxes: { box: string; label: string; cents: number }[]
  backup: { required: boolean; rate?: number; dueCents?: number }
  furnishedAt: number
}

/** GET /v1/tax/inbox — the 1099s this org received. */
export const taxInbox = (year?: number) =>
  request<{ data: Statement[] }>({ path: '/v1/tax/inbox', query: { year } })

export const statementPdf = (id: string) => blob({ path: `/v1/tax/inbox/${encodeURIComponent(id)}/pdf` })

// ── x402 ─────────────────────────────────────────────────────────────────────

export interface Receipt {
  id: string
  /** What the payment bought: a tool's resource, or job:<id> for a job paid at release. */
  resource: string
  payer: string
  from?: string
  payee: string
  payeeOrg: string
  amount: string
  network: string
  settledVia: 'ledger' | 'chain'
  txHash?: string
  category?: string
  settledAt: number
}

/** GET /v1/x402/settlements?role=payee — what this org was paid, newest first. */
export const settlements = (role: 'payer' | 'payee', year?: number) =>
  request<{ settlements: Receipt[] }>({ path: '/v1/x402/settlements', query: { role, year } })
