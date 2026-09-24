import * as m from '~/lib/market'

// The contract, pinned: every operation the storefront calls, by method and path.

let calls: { method: string; url: URL; body: unknown; auth: string | null }[] = []

beforeEach(() => {
  calls = []
  localStorage.setItem('hanzo_iam_access_token', `h.${btoa(JSON.stringify({ orgs: ['acme'] }))}.s`)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: string, init: RequestInit) => {
      calls.push({
        method: init.method ?? 'GET',
        url: new URL(u),
        body: init.body ? JSON.parse(init.body as string) : undefined,
        auth: (init.headers as Headers).get('Authorization'),
      })
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const last = () => {
  const c = calls.at(-1)!
  return `${c.method} ${c.url.pathname}${c.url.search}`
}

describe('market contract', () => {
  it.each([
    [() => m.shop({ q: 'x', kind: 'agent', limit: 5 }), 'GET /v1/marketplace/shop?q=x&kind=agent&limit=5'],
    [() => m.shopListing('lst 1'), 'GET /v1/marketplace/shop/lst%201'],
    [() => m.ownListings(), 'GET /v1/marketplace/listings'],
    [() => m.publish({ tool: 't', title: 'T', kind: 'skill' }), 'POST /v1/marketplace/listings'],
    [() => m.updateListing('lst_1', { title: 'T2' }), 'PATCH /v1/marketplace/listings/lst_1'],
    [() => m.unpublish('lst_1'), 'DELETE /v1/marketplace/listings/lst_1'],
    [() => m.install('t'), 'POST /v1/marketplace/install'],
    [() => m.uninstall('t'), 'POST /v1/marketplace/uninstall'],
    [() => m.hire({ listing: 'l', brief: 'b', amount: '1', wallet: 'w' }), 'POST /v1/marketplace/jobs'],
    [() => m.jobs('seller'), 'GET /v1/marketplace/jobs?role=seller'],
    [() => m.job('job_1'), 'GET /v1/marketplace/jobs/job_1'],
    [() => m.actOnJob('job_1', 'deliver', { note: 'n' }), 'POST /v1/marketplace/jobs/job_1/deliver'],
    [() => m.actOnJob('job_1', 'accept'), 'POST /v1/marketplace/jobs/job_1/accept'],
    [() => m.apps({ q: 'chat', org: 'hanzo' }), 'GET /v1/catalog?q=chat&org=hanzo'],
    [() => m.skills(), 'GET /.well-known/agent-skills/index.json'],
    [() => m.mcpCatalog({ q: 'pay' }), 'GET /v1/tool/catalog?q=pay'],
    [() => m.mcpListing('com.stripe_mcp'), 'GET /v1/tool/catalog/com.stripe_mcp'],
    [() => m.connectMcp({ listing: 'com.stripe_mcp' }), 'POST /v1/tool/mcp/servers'],
    [() => m.mcpServers(), 'GET /v1/tool/mcp/servers'],
    [() => m.authoredSkills(), 'GET /v1/tool/skills/authored'],
    [() => m.authorSkill({ name: 'n', content: 'c' }), 'POST /v1/tool/skills'],
    [() => m.agents(), 'GET /v1/agent'],
    [() => m.principal(), 'GET /v1/principal'],
    [() => m.startKyc(), 'POST /v1/company/kyc'],
    [() => m.clearance({ payee: 'orbital', amount: '250', rail: m.RAIL.escrow }), 'POST /v1/principal/clearance'],
    [() => m.wallets(), 'GET /v1/wallet'],
    [() => m.createAccount('Payouts'), 'POST /v1/wallet/accounts'],
    [() => m.createWallet({ accountId: 'a', name: 'n', custody: 'mpc' }), 'POST /v1/wallet'],
    [() => m.taxProfile(), 'GET /v1/tax/profile'],
    [() => m.certifyTax(), 'POST /v1/tax/profile/certify'],
    [() => m.taxInbox(2026), 'GET /v1/tax/inbox?year=2026'],
    [() => m.taxInbox(), 'GET /v1/tax/inbox'],
    [() => m.settlements('payee', 2026), 'GET /v1/x402/settlements?role=payee&year=2026'],
  ])('%#: %s', async (call, want) => {
    await call()
    expect(last()).toBe(want)
  })

  it('reads the public catalog anonymously and everything else as the org', async () => {
    await m.shop({})
    await m.apps({})
    await m.skills()
    expect(calls.map((c) => c.auth)).toEqual([null, null, null])
    await m.wallets()
    expect(calls.at(-1)!.auth).toMatch(/^Bearer /)
  })

  it('sends the tax form it was given, whichever it is', async () => {
    const address = { line1: '1 Market St', city: 'SF', state: 'CA', zip: '94105' }
    await m.saveTaxProfile({ form: 'w9', name: 'Acme', classification: 'c_corp', address, tin: '12-3456789', tinType: 'ein', electronicConsent: true })
    expect(last()).toBe('PUT /v1/tax/profile')
    expect(calls.at(-1)!.body).toMatchObject({ form: 'w9', tinType: 'ein' })
    await m.saveTaxProfile({
      form: 'w8bene',
      name: 'Acme GmbH',
      address: { ...address, country: 'DE' },
      foreignTin: 'DE123',
      w8: { country: 'DE', chapter3: 'corporation', chapter4: 'active_nffe', capacity: 'Director' },
      electronicConsent: true,
    })
    expect(calls.at(-1)!.body).toMatchObject({ form: 'w8bene', w8: { country: 'DE', chapter3: 'corporation' }, foreignTin: 'DE123' })
    await m.clearance({ payee: 'orbital', amount: '250', rail: m.RAIL.escrow, category: 'services' })
    expect(calls.at(-1)!.body).toEqual({ payee: 'orbital', amount: '250', rail: 'chain', category: 'services' })
  })

  it('fetches SKILL.md as text and a 1099 as a PDF', async () => {
    await m.skillDoc('vector-search')
    expect(last()).toBe('GET /.well-known/agent-skills/vector-search/SKILL.md')
    await m.statementPdf('stm_1')
    expect(last()).toBe('GET /v1/tax/inbox/stm_1/pdf')
  })
})
