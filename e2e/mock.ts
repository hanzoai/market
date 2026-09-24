// The platform, faked at the network layer. Every request the storefront makes to
// api.hanzo.ai (`/v1/…`, `/.well-known/agent-skills/…`) and to hanzo.id is
// answered here from a small stateful world, so a flow's writes are visible to
// its later reads. Anything the world does not know answers 404 problem+json —
// exactly what the live gateway says for an operation it does not serve.

import type { Page, Route } from '@playwright/test'

/** An hour ago, so every record falls in the current tax year. */
export const NOW = Math.floor(Date.now() / 1000) - 3600

export interface World {
  org: string
  sub: string
  clearance: 'clear' | 'needs' | 'absent'
  cleared: Record<string, unknown>[]
  listings: Record<string, unknown>[]
  shop: Record<string, unknown>[]
  jobs: Record<string, unknown>[]
  wallets: Record<string, unknown>[]
  tax: Record<string, unknown> | null
  principal: Record<string, unknown> | null
  installed: string[]
  calls: string[]
}

const reputation = { rating: 4.8, reviews: 23, installs: 1402, jobs: { completed: 57, disputed: 1 } }

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
        publisherName: 'Orbital Labs',
        tool: 'deep-research',
        title: 'Deep Research Agent',
        description: 'Reads the sources, runs the numbers, writes the brief.',
        category: 'research',
        price: '250',
        currency: 'USD',
        recipient: 'wal_orbital',
        public: true,
        createdAt: NOW - 86_400,
        kind: 'agent',
        reputation,
      },
      {
        id: 'lst_geocode',
        publisherOrg: 'mapworks',
        tool: 'geocode',
        title: 'Geocode',
        description: 'Address to coordinates, per call.',
        category: 'data',
        price: '0.0025',
        currency: 'USD',
        recipient: 'wal_map',
        public: true,
        createdAt: NOW - 7200,
        kind: 'skill',
        reputation: { rating: null, reviews: 0, installs: 12, jobs: { completed: 0, disputed: 0 } },
      },
    ],
    jobs: [],
    wallets: [],
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
    installed: [],
    cleared: [],
    calls: [],
    ...over,
  }
}

const APPS = [
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
]

const SKILLS = {
  base_url: 'https://api.hanzo.ai',
  skill_count: 61,
  skills: [
    { name: 'vector-search', service: 'vector', description: 'Search embeddings by meaning.', path: 'vector-search/SKILL.md' },
    // The live directory is hundreds of per-operation skills; sixty is enough to page.
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

const absent = (route: Route, path: string) =>
  route.fulfill({
    status: 404,
    contentType: 'application/problem+json',
    body: JSON.stringify({ type: 'about:blank', status: 404, detail: `no route for ${path}` }),
  })

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

async function api(route: Route, w: World) {
  const req = route.request()
  const url = new URL(req.url())
  const path = url.pathname
  const method = req.method()
  const body = (req.postData() ? JSON.parse(req.postData()!) : {}) as Record<string, unknown>
  w.calls.push(`${method} ${path}${url.search}`)

  // ── catalog sources ──
  if (method === 'GET' && path === '/v1/marketplace/shop') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const hit = w.shop.filter((l) => !q || JSON.stringify(l).toLowerCase().includes(q))
    return json(route, 200, { listings: hit, total: hit.length })
  }
  const one = path.match(/^\/v1\/marketplace\/shop\/([^/]+)$/)
  if (method === 'GET' && one) {
    const l = w.shop.find((x) => x.id === decodeURIComponent(one[1]))
    return l ? json(route, 200, l) : absent(route, path)
  }
  if (method === 'GET' && path === '/v1/catalog') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const org = url.searchParams.get('org')
    const hit = APPS.filter((a) => (!q || JSON.stringify(a).toLowerCase().includes(q)) && (!org || a.org === org))
    return json(route, 200, { data: hit, total: hit.length, facets: {} })
  }
  if (method === 'GET' && path === '/.well-known/agent-skills/index.json') return json(route, 200, SKILLS)
  if (method === 'GET' && path.startsWith('/.well-known/agent-skills/') && path.endsWith('/SKILL.md'))
    return route.fulfill({ status: 200, contentType: 'text/markdown', body: '# vector-search\n\nSearch embeddings by meaning.' })

  // Everything below needs a principal.
  if (!req.headers().authorization?.startsWith('Bearer ')) {
    return route.fulfill({
      status: 403,
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: 403, detail: 'a validated principal is required' }),
    })
  }

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
    ;(w.principal!.identity as Record<string, unknown>).status = 'pending'
    return json(route, 200, {
      provider: 'persona',
      sessions: [{ email: 'ada@acme.test', ref: 'inq_1', verifyUrl: 'https://verify.invalid/ada', status: 'pending' }],
    })
  }
  if (method === 'POST' && path === '/v1/principal/clearance') {
    w.cleared.push(body)
    if (w.clearance === 'absent') return absent(route, path)
    const rule = { code: 'r', reason: '' }
    const base = {
      id: `clr_${w.cleared.length}`,
      payer: w.org,
      payee: body.payee,
      amount: body.amount,
      rail: body.rail,
      status: 'us',
      reporting_obligations: [],
      facts_required: [],
      rules: [],
      decidedAt: NOW,
      notice: 'A clearance is a decision on the facts the platform holds now.',
    }
    if (w.clearance === 'needs')
      return json(route, 201, {
        ...base,
        allowed: false,
        required_before_payment: [
          { code: 'payer_identity', who: 'payer', where: 'POST /v1/company/kyc', what: "The payer's founders complete identity verification: no founder has started.", rule },
        ],
        settlement_methods: [],
        withholding: { reason: "Undetermined until the payee's status is documented.", rule },
      })
    const amount = Number(body.amount)
    const kept = (amount * 0.24).toFixed(2)
    return json(route, 201, {
      ...base,
      allowed: true,
      required_before_payment: [],
      settlement_methods: [{ rail: 'ledger', net: (amount - Number(kept)).toFixed(2), withheld: kept, rule }],
      withholding: { rate: '24', amount: kept, reason: 'The payee has not furnished a TIN, so backup withholding applies (IRC §3406).', rule },
    })
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
  if (method === 'POST' && path === '/v1/wallet') {
    const made = { id: 'wal_acme', accountId: body.accountId, name: body.name, custody: body.custody, chain: 'lux', address: '0xacme' }
    w.wallets.push(made)
    return json(route, 201, made)
  }

  // ── seller inventory ──
  if (method === 'GET' && path === '/v1/agent')
    return json(route, 200, { agents: [{ id: 'ag_1', name: 'triage-bot', description: 'Sorts the inbox', status: 'active' }] })
  if (method === 'GET' && path === '/v1/tool/skills/authored') return json(route, 200, { skills: [] })
  if (method === 'GET' && path === '/v1/tool/mcp/servers') return json(route, 200, { servers: [] })

  // ── listings ──
  if (method === 'GET' && path === '/v1/marketplace/listings') return json(route, 200, { listings: w.listings })
  if (method === 'POST' && path === '/v1/marketplace/listings') {
    const made = { id: `lst_${w.listings.length + 1}`, publisherOrg: w.org, currency: 'USD', createdAt: NOW, recipient: '', description: '', category: '', ...body }
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
  if (method === 'POST' && path === '/v1/marketplace/jobs') {
    const l = w.shop.find((x) => x.id === body.listing)!
    const made = {
      id: `job_${w.jobs.length + 1}`,
      listing: body.listing,
      title: l.title,
      buyerOrg: w.org,
      sellerOrg: l.publisherOrg,
      amount: body.amount,
      currency: 'USD',
      status: 'open',
      brief: body.brief,
      escrow: { network: 'lux', contract: '0xescrow', txHash: '0xfund' },
      history: [{ status: 'open', at: NOW, by: w.org }],
      createdAt: NOW,
      updatedAt: NOW,
    }
    w.jobs.push(made)
    return json(route, 201, made)
  }
  const jobPath = path.match(/^\/v1\/marketplace\/jobs\/([^/]+)(?:\/(accept|deliver|release|dispute))?$/)
  if (jobPath) {
    const j = w.jobs.find((x) => x.id === jobPath[1])
    if (!j) return absent(route, path)
    if (method === 'GET' && !jobPath[2]) return json(route, 200, j)
    const next = { accept: 'accepted', deliver: 'delivered', release: 'released', dispute: 'disputed' }[jobPath[2] as 'accept']
    j.status = next
    j.updatedAt = NOW + 60
    ;(j.history as unknown[]).push({ status: next, at: NOW + 60, by: w.org })
    if (jobPath[2] === 'deliver') j.delivery = { note: body.note, url: body.url, at: NOW + 60 }
    return json(route, 200, j)
  }

  // ── x402 ──
  if (method === 'GET' && path === '/v1/x402/settlements')
    return json(route, 200, {
      settlements: [
        { id: 'x402_1', resource: 'tool:geocode', payer: 'globex', payee: '0xacme', payeeOrg: w.org, amount: '0.0025', network: 'lux', settledVia: 'ledger', settledAt: NOW },
        { id: 'x402_2', resource: 'tool:geocode', payer: 'initech', payee: '0xacme', payeeOrg: w.org, amount: '0.0025', network: 'lux', settledVia: 'ledger', settledAt: NOW },
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
