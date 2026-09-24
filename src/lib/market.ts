// Every api.hanzo.ai operation this storefront calls, named once, with the shapes
// cloud answers. Money is an exact decimal string (USD); times are unix seconds.
//
// Operations marked SPECIFIED are the storefront's half of a contract cloud does
// not serve yet; the types here are that contract. Pages call them and say "not
// live yet" on a 404 rather than inventing an answer — which is also what they
// say for an operation cloud has built but api.hanzo.ai does not route yet.

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

/** How a storefront payment moves: per call over x402, or into on-chain escrow. */
export type Rail = 'x402' | 'escrow'

/** The rail name clearance knows each storefront rail by. */
export const RAIL: Record<Rail, string> = { x402: 'x402', escrow: 'chain' }

/** POST /v1/principal/clearance — a payment the caller means to make. */
export interface ClearIn {
  /** The org to be paid. */
  payee: string
  /** Gross USD, "1250.00". */
  amount: string
  category?: 'services' | 'attorney' | 'rents' | 'royalties' | 'other' | 'merchandise'
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
  rail: string
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

export const createWallet = (req: { accountId: string; name: string; custody: 'mpc' | 'kms' }) =>
  request<Wallet>({ method: 'POST', path: '/v1/wallet', body: req })

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
