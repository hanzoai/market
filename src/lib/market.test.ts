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
    [() => m.jobs('seller'), 'GET /v1/marketplace/jobs?role=seller'],
    [() => m.job('job_1'), 'GET /v1/marketplace/jobs/job_1'],
    [() => m.actOnJob('job_1', 'deliver', { note: 'n' }), 'POST /v1/marketplace/jobs/job_1/deliver'],
    [() => m.actOnJob('job_1', 'accept'), 'POST /v1/marketplace/jobs/job_1/accept'],
    [() => m.actOnJob('job_1', 'decline', { reason: 'r' }), 'POST /v1/marketplace/jobs/job_1/decline'],
    [() => m.actOnJob('job_1', 'cancel'), 'POST /v1/marketplace/jobs/job_1/cancel'],
    [() => m.actOnJob('job_1', 'refund'), 'POST /v1/marketplace/jobs/job_1/refund'],
    [() => m.rate('job_1', 5, 'On time'), 'POST /v1/marketplace/jobs/job_1/feedback'],
    [() => m.seller(2026), 'GET /v1/marketplace/seller?year=2026'],
    [() => m.sign('wal_1', '0xab'), 'POST /v1/wallet/wal_1/sign'],
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
    [() => m.clearance({ payee: 'orbital', amount: '250', rail: 'x402' }), 'POST /v1/principal/clearance'],
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
    await m.clearance({ payee: 'orbital', amount: '250', rail: 'x402', category: 'services', performed: 'DE' })
    expect(calls.at(-1)!.body).toEqual({ payee: 'orbital', amount: '250', rail: 'x402', category: 'services', performed: 'DE' })
  })

  it('fetches SKILL.md as text and a 1099 as a PDF', async () => {
    await m.skillDoc('vector-search')
    expect(last()).toBe('GET /.well-known/agent-skills/vector-search/SKILL.md')
    await m.statementPdf('stm_1')
    expect(last()).toBe('GET /v1/tax/inbox/stm_1/pdf')
  })

  // Red market-7: a hire is two steps on one call — a 402 with the terms, then the
  // same request with the payment the buyer's wallet signed for exactly them.
  describe('hire', () => {
    const accepted = {
      scheme: 'exact',
      network: 'eip155:36963',
      amount: '250000000',
      asset: '0x5425890298aed601595a70AB815c96711a31Bc65',
      payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
      maxTimeoutSeconds: 300,
      extra: { assetTransferMethod: 'eip3009', name: 'USD Coin', version: '2' },
    }
    const required = { x402Version: 2, resource: { url: 'job:job_1' }, accepts: [accepted] }
    const deadline = Math.floor(Date.now() / 1000) + 7 * 86_400
    const req = { listing: 'lst_1', brief: 'A market map.', amount: '250.00', category: 'service' as const, performed: 'US', deadline, wallet: 'wal_acme' }
    const payer = { id: 'wal_acme', address: '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23' }

    const answer = (steps: ((body: Record<string, unknown>) => Response)[]) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(async (u: string, init: RequestInit) => {
          const body = init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {}
          calls.push({ method: init.method ?? 'GET', url: new URL(u), body, auth: null })
          return steps[calls.length - 1](body)
        }),
      )
    const problem = (status: number, extra: Record<string, unknown> = {}) =>
      new Response(JSON.stringify({ status, detail: `refused ${status}`, ...extra }), { status, headers: { 'Content-Type': 'application/problem+json' } })
    const ok = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } })

    it('signs the terms with the buyer wallet and opens the job', async () => {
      answer([
        () => problem(402, { paymentRequired: Buffer.from(JSON.stringify(required)).toString('base64') }),
        (b) => ok({ address: payer.address, digest: b.digest, signature: '0xsig', walletId: payer.id }),
        () => ok({ id: 'job_1', status: 'open' }, 201),
      ])
      const opened = await m.hire(req, payer)
      expect(opened).toMatchObject({ id: 'job_1', status: 'open' })
      expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
        'POST /v1/marketplace/jobs',
        'POST /v1/wallet/wal_acme/sign',
        'POST /v1/marketplace/jobs',
      ])
      expect(calls[0].body).toEqual(req)
      expect((calls[1].body as { digest: string }).digest).toMatch(/^0x[0-9a-f]{64}$/)
      const { payment, ...again } = calls[2].body as Record<string, unknown>
      expect(again).toEqual(req)
      const sent = JSON.parse(Buffer.from(payment as string, 'base64').toString())
      expect(sent).toMatchObject({ x402Version: 2, resource: { url: 'job:job_1' }, accepted, payload: { signature: '0xsig' } })
      const a = sent.payload.authorization
      expect(a).toMatchObject({ from: payer.address, to: accepted.payTo, value: '250000000' })
      // Valid through the deadline, the review window, a ruling and a day for the clock.
      expect(Number(a.validBefore)).toBeGreaterThanOrEqual(deadline + m.TAIL)
      expect(Number(a.validAfter)).toBeLessThanOrEqual(Math.floor(Date.now() / 1000))
    })

    it('passes a refusal through, and refuses to sign for another address', async () => {
      answer([() => problem(409, { detail: 'the seller must furnish its tax form to you first' })])
      await expect(m.hire(req, payer)).rejects.toMatchObject({ status: 409, message: 'the seller must furnish its tax form to you first' })
      calls = []
      answer([() => problem(402, {})])
      await expect(m.hire(req, payer)).rejects.toMatchObject({ status: 402 })
      calls = []
      answer([
        () => problem(402, { paymentRequired: Buffer.from(JSON.stringify({ ...required, accepts: [{ ...accepted, network: 'solana:mainnet' }] })).toString('base64') }),
      ])
      await expect(m.hire(req, payer)).rejects.toThrow(/no chain this storefront can sign for/)
      calls = []
      answer([
        () => problem(402, { paymentRequired: Buffer.from(JSON.stringify(required)).toString('base64') }),
        () => ok({ address: '0x0000000000000000000000000000000000000001', digest: '0x', signature: '0xsig', walletId: payer.id }),
      ])
      await expect(m.hire(req, payer)).rejects.toThrow(/signed as 0x0000000000000000000000000000000000000001/)
      expect(calls).toHaveLength(2)
    })

    it('answers the job when the platform opens it on the first ask', async () => {
      answer([() => ok({ id: 'job_2', status: 'open' }, 201)])
      await expect(m.hire(req, payer)).resolves.toMatchObject({ id: 'job_2' })
    })
  })

  it('binds a payout wallet by signing the challenge on the platform', async () => {
    const steps = [
      () => ({ wallet: 'wal_acme', address: '0xacme', message: 'Hanzo marketplace payout wallet', digest: '0xd1', expires: 1 }),
      () => ({ address: '0xacme', digest: '0xd1', signature: '0xs1', walletId: 'wal_acme' }),
      () => ({ wallet: 'wal_acme', address: '0xacme', bound: true, boundAt: 2 }),
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string, init: RequestInit) => {
        calls.push({ method: init.method ?? 'GET', url: new URL(u), body: JSON.parse(init.body as string), auth: null })
        return new Response(JSON.stringify(steps[calls.length - 1]()), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }),
    )
    await expect(m.bindPayout('wal_acme')).resolves.toMatchObject({ bound: true })
    expect(calls.map((c) => [`${c.method} ${c.url.pathname}`, c.body])).toEqual([
      ['POST /v1/marketplace/seller/payout', { wallet: 'wal_acme' }],
      ['POST /v1/wallet/wal_acme/sign', { digest: '0xd1' }],
      ['POST /v1/marketplace/seller/payout/verify', { signature: '0xs1' }],
    ])
  })
})
