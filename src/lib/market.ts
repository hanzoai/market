// Every api.hanzo.ai operation this storefront calls, named once, with the shapes
// cloud answers. Money is an exact decimal string (USD); times are unix seconds.
//
// Operations marked SPECIFIED are the storefront's half of a contract cloud does
// not serve yet; the types here are that contract. Pages call them and say "not
// live yet" on a 404 rather than inventing an answer.

import { blob, request, text } from '~/lib/http'

export type Kind = 'agent' | 'app' | 'skill' | 'mcp'
export const KINDS: readonly Kind[] = ['agent', 'app', 'skill', 'mcp']

// ── /v1/marketplace ──────────────────────────────────────────────────────────

export interface Listing {
  id: string
  publisherOrg: string
  tool: string
  title: string
  description: string
  category: string
  /** "0" is free. */
  price: string
  currency: string
  /** Payout wallet id in publisherOrg. */
  recipient: string
  public: boolean
  createdAt: number
  /** SPECIFIED: what the listing offers. */
  kind?: Kind
  /** SPECIFIED: where its documentation lives. */
  docs?: string
}

export interface Reputation {
  /** 0–5, null until the first review. */
  rating: number | null
  reviews: number
  installs: number
  jobs: { completed: number; disputed: number }
}

/** SPECIFIED: a public listing as anyone may read it. */
export interface ShopListing extends Listing {
  kind: Kind
  publisherName?: string
  reputation: Reputation
}

export interface Shop {
  listings: ShopListing[]
  total: number
  facets?: { kind?: Partial<Record<Kind, number>> }
}

export interface PublishReq {
  tool: string
  title: string
  description?: string
  category?: string
  price?: string
  currency?: string
  recipient?: string
  public?: boolean
  kind: Kind
  docs?: string
}

export type ListingPatch = Partial<Omit<PublishReq, 'tool' | 'kind'>>

/** SPECIFIED: GET /v1/marketplace/shop — every public listing, any org, no sign-in. */
export const shop = (q: { q?: string; kind?: Kind | ''; limit?: number; offset?: number }) =>
  request<Shop>({ path: '/v1/marketplace/shop', query: q, anonymous: true })

/** SPECIFIED: GET /v1/marketplace/shop/{id}. */
export const shopListing = (id: string) =>
  request<ShopListing>({ path: `/v1/marketplace/shop/${encodeURIComponent(id)}`, anonymous: true })

/** GET /v1/marketplace/listings — the caller org's own listings. */
export const ownListings = () => request<{ listings: Listing[] }>({ path: '/v1/marketplace/listings' })

/** POST /v1/marketplace/listings → 201. */
export const publish = (req: PublishReq) =>
  request<Listing>({ method: 'POST', path: '/v1/marketplace/listings', body: req })

/** SPECIFIED: PATCH /v1/marketplace/listings/{id}. */
export const updateListing = (id: string, patch: ListingPatch) =>
  request<Listing>({ method: 'PATCH', path: `/v1/marketplace/listings/${encodeURIComponent(id)}`, body: patch })

/** DELETE /v1/marketplace/listings/{id} → 204. */
export const unpublish = (id: string) =>
  request<void>({ method: 'DELETE', path: `/v1/marketplace/listings/${encodeURIComponent(id)}` })

/** POST /v1/marketplace/install — activates one tool for the caller's org. */
export const install = (tool: string) =>
  request<{ tool: string; installed: boolean }>({ method: 'POST', path: '/v1/marketplace/install', body: { tool } })

/** POST /v1/marketplace/uninstall. */
export const uninstall = (tool: string) =>
  request<{ tool: string; installed: boolean }>({ method: 'POST', path: '/v1/marketplace/uninstall', body: { tool } })

// ── jobs: the on-chain escrow (SPECIFIED) ────────────────────────────────────

export type JobStatus = 'open' | 'accepted' | 'delivered' | 'released' | 'disputed'

export interface Job {
  id: string
  listing: string
  title: string
  buyerOrg: string
  sellerOrg: string
  amount: string
  currency: string
  status: JobStatus
  brief: string
  delivery?: { note: string; url?: string; at: number }
  dispute?: { reason: string; at: number }
  escrow: { network: string; contract: string; txHash?: string }
  history: { status: JobStatus; at: number; by: string }[]
  createdAt: number
  updatedAt: number
}

export interface HireReq {
  listing: string
  brief: string
  amount: string
  /** The buyer org's wallet that funds the escrow. */
  wallet: string
}

export const hire = (req: HireReq) => request<Job>({ method: 'POST', path: '/v1/marketplace/jobs', body: req })

export const jobs = (role: 'buyer' | 'seller') =>
  request<{ jobs: Job[] }>({ path: '/v1/marketplace/jobs', query: { role } })

export const job = (id: string) => request<Job>({ path: `/v1/marketplace/jobs/${encodeURIComponent(id)}` })

export type JobAct = 'accept' | 'deliver' | 'release' | 'dispute'

export const actOnJob = (id: string, act: JobAct, body?: { note?: string; url?: string; reason?: string }) =>
  request<Job>({ method: 'POST', path: `/v1/marketplace/jobs/${encodeURIComponent(id)}/${act}`, body: body ?? {} })

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

// ── the org as economic principal ────────────────────────────────────────────

export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected'

/** SPECIFIED: GET /v1/principal. */
export interface Principal {
  org: string
  name: string
  kyc: { status: KycStatus; verifyUrl?: string }
  tax: { form: TaxForm | null; status: 'none' | 'pending' | 'certified' }
  payout: { wallet?: string }
}

export const principal = () => request<Principal>({ path: '/v1/principal' })

/** SPECIFIED: POST /v1/principal/kyc — start the org's own verification. */
export const startKyc = () => request<{ verifyUrl: string }>({ method: 'POST', path: '/v1/principal/kyc', body: {} })

/** SPECIFIED: PUT /v1/principal/payout. */
export const setPayout = (wallet: string) =>
  request<Principal>({ method: 'PUT', path: '/v1/principal/payout', body: { wallet } })

export type Rail = 'x402' | 'escrow'

export type NeedKind = 'sign_in' | 'kyc' | 'tax_form' | 'payout_wallet' | 'billing' | 'payer_wallet'

export interface Need {
  kind: NeedKind
  party: 'buyer' | 'seller'
  detail?: string
}

/** SPECIFIED: GET /v1/principal/clearance?listing=&rail=. */
export interface Clearance {
  status: 'clear' | 'needs' | 'blocked'
  needs: Need[]
  /** Backup withholding the platform will apply to this payment, if any. */
  withholding: { rate: number; reason: string } | null
  reason?: string
}

export const clearance = (listing: string, rail: Rail) =>
  request<Clearance>({ path: '/v1/principal/clearance', query: { listing, rail } })

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

export const createWallet = (req: { accountId: string; name: string; custody: 'mpc' | 'kms' }) =>
  request<Wallet>({ method: 'POST', path: '/v1/wallet', body: req })

// ── tax ──────────────────────────────────────────────────────────────────────

/** W-9 is served today; W-8BEN / W-8BEN-E are SPECIFIED. */
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
  country?: string
}

export interface TaxProfile {
  name: string
  businessName?: string
  classification?: Classification
  address: Address
  tin: string
  tinType?: 'ssn' | 'ein'
  consent?: { electronic: boolean }
  certification: { status: 'none' | 'pending' | 'certified' }
  version: number
  updatedAt: number
  /** SPECIFIED with W-8: which form this profile is. Absent means W-9. */
  form?: TaxForm
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

/** SPECIFIED: a non-US person or entity certifies foreign status. */
export interface W8 {
  form: 'w8ben' | 'w8bene'
  name: string
  country: string
  address: Address
  foreignTin?: string
  treaty?: { country: string; article: string; rate: number }
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
  resource: string
  payer: string
  payee: string
  payeeOrg: string
  amount: string
  network: string
  settledVia: 'ledger' | 'chain'
  txHash?: string
  settledAt: number
}

/** SPECIFIED: GET /v1/x402/settlements?role=payee — what this org was paid. */
export const settlements = (role: 'payer' | 'payee', year?: number) =>
  request<{ settlements: Receipt[] }>({ path: '/v1/x402/settlements', query: { role, year } })
