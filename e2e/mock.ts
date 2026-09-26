// The platform, faked at the network layer. Every request the storefront makes to
// api.hanzo.ai (`/v1/…`, `/.well-known/agent-skills/…`) and to hanzo.id is
// answered here from a small stateful world, so a flow's writes are visible to
// its later reads. Anything the world does not know answers 404 problem+json —
// exactly what the live gateway says for an operation it does not serve.
//
// The shapes are cloud's (hanzo-inc/cloud 725e61052). A hire is its two steps: a
// 402 with x402 terms, then the payment, whose signature is checked against the
// terms with viem's own EIP-712 recovery — and the org wallet that signs it holds
// a real key, generated per world.

import type { Page, Route } from '@playwright/test'
import { hashMessage, recoverAddress, recoverTypedDataAddress, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

/** An hour ago, so every record falls in the current tax year. */
export const NOW = Math.floor(Date.now() / 1000) - 3600

type Row = Record<string, unknown>

export interface World {
  org: string
  sub: string
  /** How clearance decides: clear in full, clear net of withholding, needs a step, foreign payee (asks where), or not live. */
  clearance: 'clear' | 'withheld' | 'needs' | 'foreign' | 'absent'
  cleared: Row[]
  listings: Row[]
  shop: Row[]
  jobs: Row[]
  /** Every hire request, both steps. */
  hires: Row[]
  wallets: Row[]
  /** The key behind each wallet the org creates or holds. */
  keys: Record<string, PrivateKeyAccount>
  apps: Row[]
  tax: Row | null
  principal: Row | null
  seller: Row | null
  challenge: { wallet: string; address: string; digest: Hex } | null
  installed: string[]
  calls: string[]
}

const reputation = { rating: 4.8, reviews: 23, installs: 1402, jobs: { completed: 57, disputed: 1 } }
const none = { rating: null, reviews: 0, installs: 12, jobs: { completed: 0, disputed: 0 } }

/** A wallet of the acting org, with a real key behind it. */
export function wallet(w: World, id = 'wal_acme', name = 'Treasury'): Row {
  const key = privateKeyToAccount(generatePrivateKey())
  w.keys[id] = key
  const made = { id, accountId: 'acct_1', name, custody: 'mpc', chain: 'lux', address: key.address }
  w.wallets.push(made)
  return made
}

/** The seller's payout address the x402 terms name. */
const PAY_TO = '0x209693Bc6afc0C5328bA36FaF03C514EF312287C'
const USDC = '0x5425890298aed601595a70AB815c96711a31Bc65'

export function world(over: Partial<World> = {}): World {
  return {
    org: 'acme',
    sub: 'acme/ada',
    clearance: 'clear',
    listings: [],
    shop: [
      {
        id: 'lst_research',
        publisherOrg: 'orbital',
        kind: 'agent',
        tool: 'deep-research',
        title: 'Deep Research Agent',
        description: 'Reads the sources, runs the numbers, writes the brief.',
        category: 'research',
        price: '250',
        currency: 'USD',
        public: true,
        docs: '/docs/agents/deep-research',
        createdAt: NOW - 86_400,
        updatedAt: NOW - 86_400,
        seller: { org: 'orbital', documented: true, reputation },
        reputation,
        links: {
          docs: '/docs/agents/deep-research',
          cli: 'hanzo marketplace jobs create --listing lst_research --brief <brief> --amount <usd>',
          mcp: { tool: 'marketplace', op: 'post_marketplace_jobs' },
        },
      },
      {
        id: 'lst_geocode',
        publisherOrg: 'admin',
        kind: 'tool',
        tool: 'geocode',
        title: 'Geocode',
        description: 'Address to coordinates, per call.',
        category: 'data',
        price: '0.0025',
        currency: 'USD',
        public: true,
        createdAt: NOW - 7200,
        updatedAt: NOW - 7200,
        seller: { org: 'admin', documented: true, reputation: none },
        reputation: none,
        links: { cli: 'hanzo marketplace install --tool geocode', mcp: { tool: 'marketplace', op: 'post_marketplace_install' } },
      },
    ],
    jobs: [],
    hires: [],
    wallets: [],
    keys: {},
    apps: [
      {
        id: 'hanzo/chat',
        org: 'hanzo',
        name: 'chat',
        title: 'Hanzo Chat',
        kind: 'site',
        origin: 'product',
        description: 'Chat with every frontier model.',
        url: 'https://hanzo.chat',
        repo: 'https://github.com/hanzoai/chat',
        forkable: true,
        stars: 311,
        language: 'TypeScript',
        license: 'MIT',
      },
    ],
    tax: null,
    principal: {
      org: 'acme',
      identity: { status: 'none', reason: 'No founder has started identity verification.' },
      sanctions: { status: 'clear', reason: '' },
      wallets: [],
      compliance: {
        ready: false,
        missing: [
          { code: 'identity', who: 'org', where: 'POST /v1/company/kyc', what: 'No founder has started identity verification.', rule: { code: 'identity', reason: '' } },
          { code: 'tax_form', who: 'org', where: 'PUT /v1/tax/profile', what: 'Certify a W-9 (a U.S. person) or a W-8BEN or W-8BEN-E (a foreign person): a payer asks for it before it pays.', rule: { code: 'status_unknown', reason: '' } },
        ],
      },
      sources: [],
    },
    seller: {
      org: 'acme',
      ready: false,
      missing: ['identity', 'tax_form', 'payout'],
      identity: 'none',
      tax: undefined,
      sanctions: 'clear',
      sanctionsReason: '',
      payout: { bound: false },
      credentials: [],
      earnings: { year: new Date().getUTCFullYear(), currency: 'USD', gross: '120.005', payments: 3, byRail: { x402: '120.005' } },
      received: [],
      sources: [],
    },
    challenge: null,
    installed: [],
    cleared: [],
    calls: [],
    ...over,
  }
}

const SKILLS = {
  base_url: 'https://api.hanzo.ai',
  skill_count: 61,
  skills: [
    { name: 'vector-search', service: 'vector', description: 'Search embeddings by meaning.', path: 'vector-search/SKILL.md' },
    ...Array.from({ length: 60 }, (_, i) => ({
      name: `op_${String(i).padStart(2, '0')}`,
      service: 'ops',
      description: `Operation ${i}.`,
      path: `op_${i}/SKILL.md`,
    })),
  ],
}

const json = (route: Route, status: number, body: unknown, headers: Record<string, string> = {}) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers })

const problem = (route: Route, status: number, detail: string, extra: Row = {}) =>
  route.fulfill({ status, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', status, detail, ...extra }) })

const absent = (route: Route, path: string) => problem(route, 404, `no route for ${path}`)

function b64url(v: unknown): string {
  return Buffer.from(JSON.stringify(v)).toString('base64url')
}

/** An unsigned JWT: the storefront reads claims; the gateway (mocked) would check the signature. */
export function token(w: World): string {
  return `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({
    sub: w.sub,
    iss: 'https://hanzo.id',
    aud: 'hanzo-market',
    orgs: [{ org: w.org, role: 'admin' }],
    name: 'Ada Lovelace',
    email: 'ada@acme.test',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.sig`
}

/** A page of `rows` as `limit` and `offset` ask. */
function paged(url: URL, rows: Row[]): Row[] {
  const limit = Number(url.searchParams.get('limit') ?? 48)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  return rows.slice(offset, offset + limit)
}

const hits = (url: URL, rows: Row[]) => {
  const q = (url.searchParams.get('q') ?? '').toLowerCase()
  return rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q))
}

function decide(w: World, body: Row): Row {
  const rule = { code: 'r', reason: '' }
  const amount = Number(body.amount)
  const base = {
    id: `clr_${w.cleared.length}`,
    payer: w.org,
    payee: body.payee,
    amount: amount.toFixed(2),
    category: body.category,
    rail: body.rail,
    performed: body.performed,
    status: 'us',
    reporting_obligations: [],
    facts_required: [],
    rules: [],
    decidedAt: NOW,
    notice: 'A clearance is a decision on the facts the platform holds now.',
  }
  const whole = { rail: 'ledger', net: amount.toFixed(2), withheld: '0.00', rule }
  if (w.clearance === 'needs')
    return {
      ...base,
      allowed: false,
      required_before_payment: [
        { code: 'payer_identity', who: 'payer', where: 'POST /v1/company/kyc', what: "The payer's founders complete identity verification: no founder has started.", rule },
      ],
      settlement_methods: [],
      withholding: { reason: "Undetermined until the payee's status is documented.", rule },
    }
  if (w.clearance === 'foreign' && !body.performed)
    return {
      ...base,
      status: 'foreign',
      allowed: false,
      required_before_payment: [],
      facts_required: [
        { code: 'performed', blocks: true, rule, question: 'Where is the service performed — or, for rents, where is the property; for royalties, where is it used?' },
      ],
      settlement_methods: [],
      withholding: { reason: 'Undetermined until the source of the income is known.', rule },
    }
  if (w.clearance === 'withheld') {
    const kept = (amount * 0.24).toFixed(2)
    return {
      ...base,
      allowed: true,
      required_before_payment: [],
      settlement_methods: [{ rail: 'ledger', net: (amount - Number(kept)).toFixed(2), withheld: kept, rule }],
      withholding: { rate: '24', amount: kept, reason: 'The payee has not furnished a TIN, so backup withholding applies (IRC §3406).', rule },
    }
  }
  return {
    ...base,
    status: w.clearance === 'foreign' ? 'foreign' : 'us',
    allowed: true,
    required_before_payment: [],
    settlement_methods: [whole],
    withholding: { reason: 'Nothing is withheld: the payee furnished its form.', rule },
  }
}

/** The x402 terms cloud's 402 names for a job: USDC-style EIP-3009 on the Hanzo chain. */
function terms(id: string, amount: string) {
  return {
    x402Version: 2,
    resource: { url: `job:${id}` },
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:36963',
        amount: String(Math.round(Number(amount) * 1e6)),
        asset: USDC,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: { assetTransferMethod: 'eip3009', name: 'USD Coin', version: '2' },
      },
    ],
  }
}

/** Whose signature a payment carries, recovered from the terms it answers — or why it is refused. */
async function signer(payment: string): Promise<{ from: string; to: string; value: string; validBefore: number; resource: string } | string> {
  const p = JSON.parse(Buffer.from(payment, 'base64').toString()) as {
    x402Version: number
    resource: { url: string }
    accepted: ReturnType<typeof terms>['accepts'][number]
    payload: { signature: Hex; authorization: { from: Hex; to: Hex; value: string; validAfter: string; validBefore: string; nonce: Hex } }
  }
  const a = p.payload.authorization
  const got = await recoverTypedDataAddress({
    domain: { name: p.accepted.extra.name, version: p.accepted.extra.version, chainId: 36963, verifyingContract: USDC },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: { from: a.from, to: a.to, value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore), nonce: a.nonce },
    signature: p.payload.signature,
  })
  if (got.toLowerCase() !== a.from.toLowerCase()) return `invalid_exact_evm_payload_signature: recovered ${got}, claimed ${a.from}`
  return { from: a.from, to: a.to, value: a.value, validBefore: Number(a.validBefore), resource: p.resource.url }
}

async function hire(route: Route, w: World, body: Row) {
  w.hires.push(body)
  const l = w.shop.find((x) => x.id === body.listing)
  if (!l) return problem(route, 404, 'listing not found')
  const d = decide(w, { payee: l.publisherOrg, amount: body.amount, performed: body.performed, category: 'services', rail: 'x402' })
  if (!d.allowed) return problem(route, 403, `clearance ${String(d.id)}: this payment cannot clear now`)
  if (Number((d.settlement_methods as { withheld: string }[])[0].withheld) > 0)
    return problem(route, 409, `clearance ${String(d.id)}: this payment clears only net of withholding`)
  if (!body.payment) {
    const id = `job_${w.jobs.length + 1}`
    const t = terms(id, String(body.amount))
    return problem(route, 402, `sign the payment for job:${id}`, { paymentRequired: Buffer.from(JSON.stringify(t)).toString('base64'), ...t })
  }
  const who = await signer(body.payment as string)
  if (typeof who === 'string') return problem(route, 402, `the payment was refused: ${who}`)
  const id = who.resource.replace(/^job:/, '')
  if (who.validBefore < Number(body.deadline) + 18 * 86_400) return problem(route, 402, 'the authorization must stay valid through the deadline')
  const made = {
    id,
    listing: body.listing,
    title: l.title,
    buyerOrg: w.org,
    sellerOrg: l.publisherOrg,
    amount: Number(body.amount).toFixed(2),
    currency: 'USD',
    category: body.category ?? 'service',
    status: 'open',
    brief: body.brief,
    performed: body.performed,
    deadline: body.deadline,
    review: 259_200,
    clearance: d.id,
    payer: who.from,
    escrow: { rail: 'x402', network: 'eip155:36963', contract: USDC, payTo: PAY_TO },
    history: [
      { status: 'quoted', at: NOW, by: w.org },
      { status: 'open', at: NOW, by: w.org },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  }
  w.jobs.push(made)
  return json(route, 201, made)
}

async function api(route: Route, w: World) {
  const req = route.request()
  const url = new URL(req.url())
  const path = url.pathname
  const method = req.method()
  const body = (req.postData() ? JSON.parse(req.postData()!) : {}) as Row
  w.calls.push(`${method} ${path}${url.search}`)

  // ── catalog sources ──
  if (method === 'GET' && path === '/v1/marketplace/shop') {
    const all = hits(url, w.shop)
    const kind = url.searchParams.get('kind')
    const hit = all.filter((l) => !kind || l.kind === kind)
    const facets: Record<string, number> = {}
    for (const l of all) facets[String(l.kind)] = (facets[String(l.kind)] ?? 0) + 1
    return json(route, 200, { listings: paged(url, hit), total: hit.length, facets: { kind: facets, category: {}, price: {}, rating: {} } })
  }
  const one = path.match(/^\/v1\/marketplace\/shop\/([^/]+)$/)
  if (method === 'GET' && one) {
    const l = w.shop.find((x) => x.id === decodeURIComponent(one[1]))
    return l ? json(route, 200, l) : absent(route, path)
  }
  if (method === 'GET' && path === '/v1/catalog') {
    const org = url.searchParams.get('org')
    const hit = hits(url, w.apps).filter((a) => !org || a.org === org)
    return json(route, 200, { data: paged(url, hit), total: hit.length, facets: {} })
  }
  if (method === 'GET' && path === '/.well-known/agent-skills/index.json') return json(route, 200, SKILLS)
  if (method === 'GET' && path.startsWith('/.well-known/agent-skills/') && path.endsWith('/SKILL.md'))
    return route.fulfill({ status: 200, contentType: 'text/markdown', body: '# vector-search\n\nSearch embeddings by meaning.' })

  // Everything below needs a principal.
  if (!req.headers().authorization?.startsWith('Bearer ')) return problem(route, 403, 'a validated principal is required')

  if (method === 'GET' && path === '/v1/tool/catalog')
    return json(route, 200, {
      catalog: [
        { id: 'com.stripe_mcp', name: 'stripe', vendor: 'Stripe', title: 'Stripe', description: 'Payments over MCP.', version: '1.2.0', transports: ['http'], featured: true, official: true },
      ],
      total: 1,
    })

  // ── principal ──
  if (method === 'GET' && path === '/v1/principal') return w.principal ? json(route, 200, w.principal) : absent(route, path)
  if (method === 'POST' && path === '/v1/company/kyc') {
    ;(w.principal!.identity as Row).status = 'pending'
    return json(route, 200, {
      provider: 'persona',
      sessions: [{ email: 'ada@acme.test', ref: 'inq_1', verifyUrl: 'https://verify.invalid/ada', status: 'pending' }],
    })
  }
  if (method === 'POST' && path === '/v1/principal/clearance') {
    w.cleared.push(body)
    if (w.clearance === 'absent') return absent(route, path)
    return json(route, 201, decide(w, body))
  }

  // ── tax ──
  if (method === 'GET' && path === '/v1/tax/profile') return w.tax ? json(route, 200, w.tax) : absent(route, path)
  if (method === 'PUT' && path === '/v1/tax/profile') {
    w.tax = {
      form: body.form ?? 'w9',
      name: body.name,
      businessName: body.businessName,
      classification: body.classification,
      address: body.address,
      tin: '**-***6789',
      tinType: body.tinType,
      certification: { status: 'none' },
      valid: false,
      version: 1,
      updatedAt: NOW,
    }
    return json(route, 200, w.tax)
  }
  if (method === 'POST' && path === '/v1/tax/profile/certify') {
    w.tax = { ...w.tax!, certification: { status: 'certified' }, valid: true }
    w.principal!.tax = { form: 'w9', usPerson: true, country: 'US', residence: 'US', certified: true, valid: true }
    return json(route, 200, w.tax)
  }
  if (method === 'GET' && path === '/v1/tax/inbox')
    return json(route, 200, {
      data: [
        {
          id: 'stm_1',
          payer: { org: 'orbital', name: 'Orbital Labs' },
          kind: '1099-NEC',
          year: Number(url.searchParams.get('year')),
          corrected: false,
          boxes: [{ box: '1', label: 'Nonemployee compensation', cents: 125_000 }],
          backup: { required: false },
          furnishedAt: NOW,
        },
      ],
    })

  // ── wallets ──
  if (method === 'GET' && path === '/v1/wallet') return json(route, 200, { wallets: w.wallets })
  if (method === 'POST' && path === '/v1/wallet/accounts') return json(route, 201, { id: 'acct_1', name: body.name })
  if (method === 'POST' && path === '/v1/wallet') return json(route, 201, wallet(w, 'wal_acme', String(body.name)))
  const signing = path.match(/^\/v1\/wallet\/([^/]+)\/sign$/)
  if (method === 'POST' && signing) {
    const key = w.keys[decodeURIComponent(signing[1])]
    if (!key) return problem(route, 404, 'wallet not found')
    const signature = await key.sign({ hash: body.digest as Hex })
    return json(route, 200, { address: key.address, digest: body.digest, signature, walletId: signing[1] })
  }

  // ── the seller ──
  if (method === 'GET' && path === '/v1/marketplace/seller') return w.seller ? json(route, 200, w.seller) : absent(route, path)
  if (method === 'POST' && path === '/v1/marketplace/seller/payout') {
    const wal = w.wallets.find((x) => x.id === body.wallet)
    if (!wal) return problem(route, 404, 'wallet not found')
    const message = `Hanzo marketplace payout wallet\norg: ${w.org}\nwallet: ${String(wal.id)}\naddress: ${String(wal.address)}`
    w.challenge = { wallet: String(wal.id), address: String(wal.address), digest: hashMessage(message) }
    return json(route, 200, { wallet: wal.id, address: wal.address, message, digest: w.challenge.digest, expires: NOW + 900 })
  }
  if (method === 'POST' && path === '/v1/marketplace/seller/payout/verify') {
    const c = w.challenge
    if (!c) return problem(route, 409, 'no payout challenge is outstanding')
    const got = await recoverAddress({ hash: c.digest, signature: body.signature as Hex })
    if (got.toLowerCase() !== c.address.toLowerCase()) return problem(route, 403, `the signature is not ${c.address}'s`)
    const payout = { wallet: c.wallet, address: c.address, bound: true, boundAt: NOW }
    w.seller = { ...w.seller!, payout }
    w.challenge = null
    return json(route, 200, payout)
  }

  // ── seller inventory ──
  if (method === 'GET' && path === '/v1/agent')
    return json(route, 200, { agents: [{ id: 'ag_1', name: 'triage-bot', description: 'Sorts the inbox', status: 'active' }] })
  if (method === 'GET' && path === '/v1/tool/skills/authored') return json(route, 200, { skills: [] })
  if (method === 'GET' && path === '/v1/tool/mcp/servers') return json(route, 200, { servers: [] })

  // ── listings ──
  if (method === 'GET' && path === '/v1/marketplace/listings') return json(route, 200, { listings: w.listings })
  if (method === 'POST' && path === '/v1/marketplace/listings') {
    const made = { id: `lst_${w.listings.length + 1}`, publisherOrg: w.org, currency: 'USD', createdAt: NOW, updatedAt: NOW, recipient: '', description: '', category: '', ref: 'ag_1', ...body }
    w.listings.unshift(made)
    return json(route, 201, made)
  }
  if (method === 'POST' && path === '/v1/marketplace/install') {
    w.installed.push(String(body.tool))
    return json(route, 200, { tool: body.tool, installed: true })
  }

  // ── jobs ──
  if (method === 'GET' && path === '/v1/marketplace/jobs') {
    const role = url.searchParams.get('role')
    return json(route, 200, { jobs: w.jobs.filter((j) => (role === 'seller' ? j.sellerOrg : j.buyerOrg) === w.org) })
  }
  if (method === 'POST' && path === '/v1/marketplace/jobs') return hire(route, w, body)
  const jobPath = path.match(/^\/v1\/marketplace\/jobs\/([^/]+)(?:\/(accept|decline|cancel|deliver|release|dispute|refund|feedback))?$/)
  if (jobPath) {
    const j = w.jobs.find((x) => x.id === jobPath[1])
    if (!j) return absent(route, path)
    if (method === 'GET' && !jobPath[2]) return json(route, 200, j)
    if (jobPath[2] === 'feedback') return json(route, 201, { id: 'fb_1', job: j.id, rating: body.rating })
    const next = { accept: 'accepted', decline: 'declined', cancel: 'cancelled', deliver: 'delivered', release: 'released', dispute: 'disputed', refund: 'refunded' }[
      jobPath[2] as 'accept'
    ]
    j.status = next
    j.updatedAt = NOW + 60
    ;(j.history as unknown[]).push({ status: next, at: NOW + 60, by: w.org })
    if (jobPath[2] === 'deliver') j.delivery = { note: body.note, url: body.url, hash: `0x${'ab'.repeat(32)}`, at: NOW + 60 }
    if (jobPath[2] === 'dispute') j.dispute = { reason: body.reason, by: w.org, at: NOW + 60 }
    return json(route, 200, j)
  }

  // ── x402 ──
  if (method === 'GET' && path === '/v1/x402/settlements')
    return json(route, 200, {
      settlements: [
        { id: 'x402_1', resource: 'tool:geocode', payer: 'globex', payee: '0xacme', payeeOrg: w.org, amount: '0.0025', network: 'eip155:36963', settledVia: 'ledger', settledAt: NOW },
        { id: 'x402_2', resource: 'tool:geocode', payer: 'initech', payee: '0xacme', payeeOrg: w.org, amount: '0.0025', network: 'eip155:36963', settledVia: 'ledger', settledAt: NOW },
        { id: 'x402_3', resource: 'job:job_3', payer: 'initech', payee: '0xacme', payeeOrg: w.org, amount: '120', network: 'eip155:36963', settledVia: 'ledger', settledAt: NOW },
      ],
    })

  return absent(route, path)
}

async function iam(route: Route, w: World, base: string) {
  const req = route.request()
  const url = new URL(req.url())
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  const issuer = 'https://hanzo.id'
  if (url.pathname === '/.well-known/openid-configuration')
    return json(
      route,
      200,
      {
        issuer,
        authorization_endpoint: `${issuer}/v1/iam/oauth/authorize`,
        token_endpoint: `${issuer}/v1/iam/oauth/token`,
        userinfo_endpoint: `${issuer}/v1/iam/oauth/userinfo`,
        jwks_uri: `${issuer}/v1/iam/.well-known/jwks`,
        end_session_endpoint: `${issuer}/v1/iam/oauth/logout`,
      },
      cors,
    )
  if (url.pathname === '/v1/iam/oauth/authorize') {
    const back = new URL(url.searchParams.get('redirect_uri') ?? `${base}/auth/callback`)
    back.searchParams.set('code', 'test-code')
    back.searchParams.set('state', url.searchParams.get('state') ?? '')
    return route.fulfill({ status: 302, headers: { location: back.toString() } })
  }
  if (url.pathname === '/v1/iam/oauth/token')
    return json(
      route,
      200,
      { access_token: token(w), refresh_token: 'refresh', id_token: token(w), token_type: 'Bearer', expires_in: 3600 },
      cors,
    )
  if (url.pathname === '/v1/iam/oauth/userinfo')
    return json(route, 200, { sub: w.sub, owner: w.org, name: 'ada', displayName: 'Ada Lovelace', email: 'ada@acme.test' }, cors)
  return route.fulfill({ status: 404, headers: cors })
}

/** Serve the platform and the issuer from `w` for this page. */
export async function mock(page: Page, w: World) {
  const base = new URL(page.url() === 'about:blank' ? 'http://127.0.0.1' : page.url()).origin
  await page.route(/\/v1\//, (route) => (new URL(route.request().url()).hostname === 'hanzo.id' ? iam(route, w, base) : api(route, w)))
  await page.route(/\/\.well-known\/agent-skills\//, (route) => api(route, w))
  await page.route(/^https:\/\/hanzo\.id\//, (route) => iam(route, w, base))
}
