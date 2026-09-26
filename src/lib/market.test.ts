import { hashMessage } from 'viem'

import { lost, Refusal, Silence } from '~/lib/http'
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
    const attempt = (): m.Attempt => ({ req, from: payer })

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
    const quote = (over: Record<string, unknown> = {}, resource = 'job:job_1') => () =>
      problem(402, { paymentRequired: Buffer.from(JSON.stringify({ ...required, resource: { url: resource }, accepts: [{ ...accepted, ...over }] })).toString('base64') })
    const signs = (b: Record<string, unknown>) => ok({ address: payer.address, digest: b.digest, signature: '0xsig', walletId: payer.id })
    const paths = () => calls.map((c) => `${c.method} ${c.url.pathname}`)

    it('signs the terms with the buyer wallet and opens the job', async () => {
      answer([quote(), signs, () => ok({ id: 'job_1', status: 'open' }, 201)])
      const a = attempt()
      const opened = await m.hire(a)
      expect(opened).toMatchObject({ id: 'job_1', status: 'open' })
      expect(paths()).toEqual(['POST /v1/marketplace/jobs', 'POST /v1/wallet/wal_acme/sign', 'POST /v1/marketplace/jobs'])
      expect(calls[0].body).toEqual(req)
      expect((calls[1].body as { digest: string }).digest).toMatch(/^0x[0-9a-f]{64}$/)
      const { payment, ...again } = calls[2].body as Record<string, unknown>
      expect(again).toEqual(req)
      const sent = JSON.parse(Buffer.from(payment as string, 'base64').toString())
      expect(sent).toMatchObject({ x402Version: 2, resource: { url: 'job:job_1' }, accepted, payload: { signature: '0xsig' } })
      const auth = sent.payload.authorization
      expect(auth).toMatchObject({ from: payer.address, to: accepted.payTo, value: '250000000' })
      // Valid through the deadline, the review window, a ruling and a day for the clock.
      expect(Number(auth.validBefore)).toBeGreaterThanOrEqual(deadline + m.TAIL)
      expect(Number(auth.validAfter)).toBeLessThanOrEqual(Math.floor(Date.now() / 1000))
      expect(a.signed).toEqual({ job: 'job_1', payment, amount: '250.00', payTo: accepted.payTo })
    })

    it('passes a refusal through, and refuses to sign for another address', async () => {
      answer([() => problem(409, { detail: 'the seller must furnish its tax form to you first' })])
      await expect(m.hire(attempt())).rejects.toMatchObject({ status: 409, message: 'the seller must furnish its tax form to you first' })
      calls = []
      answer([() => problem(402, {})])
      await expect(m.hire(attempt())).rejects.toMatchObject({ status: 402 })
      calls = []
      answer([quote({ network: 'solana:mainnet' })])
      await expect(m.hire(attempt())).rejects.toThrow(/no chain and asset this storefront can sign for/)
      calls = []
      answer([quote(), () => ok({ address: '0x0000000000000000000000000000000000000001', digest: '0x', signature: '0xsig', walletId: payer.id })])
      await expect(m.hire(attempt())).rejects.toThrow(/signed as 0x0000000000000000000000000000000000000001/)
      expect(calls).toHaveLength(2)
    })

    it('answers the job when the platform opens it on the first ask', async () => {
      answer([() => ok({ id: 'job_2', status: 'open' }, 201)])
      await expect(m.hire(attempt())).resolves.toMatchObject({ id: 'job_2' })
    })

    // Red market-12: the payment's answer was lost after cloud opened the job; the
    // retry re-quoted, re-signed and opened a second job with a second hold.
    it('sends the same payment again after its answer is lost, and signs nothing new', async () => {
      const a = attempt()
      answer([quote(), signs, () => problem(504, { detail: 'upstream request timeout' })])
      const e = await m.hire(a).catch((x: unknown) => x)
      expect(e).toMatchObject({ status: 504 })
      expect(lost(e)).toBe(true)
      const first = calls[2].body
      calls = []
      answer([() => ok({ id: 'job_1', status: 'open' })])
      await expect(m.hire(a)).resolves.toMatchObject({ id: 'job_1' })
      expect(paths()).toEqual(['POST /v1/marketplace/jobs'])
      expect(calls[0].body).toEqual(first)
    })

    it('treats no answer at all as lost, and a refusal as an answer', async () => {
      const a = attempt()
      let n = 0
      vi.stubGlobal(
        'fetch',
        vi.fn(async (u: string, init: RequestInit) => {
          const body = init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {}
          calls.push({ method: init.method ?? 'GET', url: new URL(u), body, auth: null })
          n += 1
          if (n === 1) return quote()()
          if (n === 2) return signs(body)
          throw new TypeError('Failed to fetch')
        }),
      )
      const e = await m.hire(a).catch((x: unknown) => x)
      expect(e).toBeInstanceOf(Silence)
      expect(lost(e)).toBe(true)
      expect(a.signed?.payment).toEqual((calls[2].body as { payment: string }).payment)
      expect(lost(new Refusal(402, 'insufficient_funds'))).toBe(false)
      expect(lost(new Refusal(409, 'already paid for'))).toBe(false)
      expect(lost(new Refusal(429, 'slow down'))).toBe(true)
      expect(lost(new Refusal(408, 'timeout'))).toBe(true)
      expect(lost(new Error('a bug'))).toBe(false)
    })

    it('asks again with the same terms and deadline after a lost quote', async () => {
      const a = attempt()
      answer([() => problem(502, { detail: 'bad gateway' })])
      await expect(m.hire(a)).rejects.toMatchObject({ status: 502 })
      expect(a.signed).toBeUndefined()
      const first = calls[0].body
      calls = []
      answer([quote(), signs, () => ok({ id: 'job_1', status: 'open' }, 201)])
      await expect(m.hire(a)).resolves.toMatchObject({ id: 'job_1' })
      expect(calls[0].body).toEqual(first)
    })

    // Red market-15: the page signed whatever a 402 asked — any value, payee and asset.
    it.each([
      [{ amount: '25000000000' }, 'job:job_1', /asked the wallet to sign \$25,000\.00 for a job cleared at \$250\.00/],
      [{ amount: '250000001' }, 'job:job_1', /asked the wallet to sign \$250\.000001/],
      [{ amount: '' }, 'job:job_1', /name no amount/],
      [{ amount: '2.5e8' }, 'job:job_1', /name no amount/],
      [{ payTo: payer.address }, 'job:job_1', /not a seller's address/],
      [{ payTo: '0x0000000000000000000000000000000000000000' }, 'job:job_1', /not a seller's address/],
      [{ payTo: 'anyone' }, 'job:job_1', /not a seller's address/],
      [{ asset: 'usdc' }, 'job:job_1', /no token contract/],
      [{ extra: { assetTransferMethod: 'eip3009', name: 'Tether USD', version: '1' } }, 'job:job_1', /no chain and asset/],
      [{}, 'tool:geocode', /for tool:geocode, not a job/],
    ])('refuses unsigned terms other than the job it cleared (%#)', async (over, resource, why) => {
      answer([quote(over, resource)])
      const a = attempt()
      const e = (await m.hire(a).catch((x: unknown) => x)) as Error
      expect(e.message).toMatch(why)
      expect(e.message).toMatch(/Nothing was signed\.$/)
      expect(paths().every((p) => !p.endsWith('/sign'))).toBe(true)
      expect(a.signed).toBeUndefined()
    })

    it('finds a job already under way for exactly these terms', async () => {
      const job = (over: Record<string, unknown>) => ({ id: 'job_1', listing: 'lst_1', brief: 'A market map.', amount: '250', status: 'open', ...over })
      const list = (jobs: unknown[]) => answer([() => ok({ jobs })])
      list([job({ status: 'quoted' }), job({ status: 'released', id: 'job_0' }), job({ id: 'job_7', status: 'accepted' })])
      await expect(m.underway(req)).resolves.toMatchObject({ id: 'job_7' })
      expect(`${calls[0].method} ${calls[0].url.pathname}${calls[0].url.search}`).toBe('GET /v1/marketplace/jobs?role=buyer')
      calls = []
      list([job({ brief: 'Another map.' }), job({ amount: '250.01' }), job({ listing: 'lst_2' }), job({ ending: 'cancelled' })])
      await expect(m.underway(req)).resolves.toBeNull()
    })
  })

  describe('payout proof', () => {
    const w = { id: 'wal_acme', address: '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23' }
    const message = (over: Partial<Record<'org' | 'wallet' | 'address', string>> = {}) =>
      [
        'Hanzo marketplace payout wallet',
        `org: ${over.org ?? 'acme'}`,
        `wallet: ${over.wallet ?? w.id}`,
        `address: ${over.address ?? w.address.toLowerCase()}`,
        'nonce: 0b1f',
        'expires: 1800000000',
      ].join('\n')
    const challenge = (msg = message(), over: Partial<m.Challenge> = {}): m.Challenge => ({ wallet: w.id, address: w.address, message: msg, digest: hashMessage(msg), expires: 1, ...over })

    const answer2 = (steps: (() => unknown)[]) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(async (u: string, init: RequestInit) => {
          calls.push({ method: init.method ?? 'GET', url: new URL(u), body: init.body ? JSON.parse(init.body as string) : undefined, auth: null })
          return new Response(JSON.stringify(steps[calls.length - 1]()), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }),
      )

    it('binds a payout wallet by signing the challenge on the platform', async () => {
      const c = challenge()
      const steps = [() => c, () => ({ address: w.address, digest: c.digest, signature: '0xs1', walletId: w.id }), () => ({ wallet: w.id, address: w.address, bound: true, boundAt: 2 })]
      vi.stubGlobal(
        'fetch',
        vi.fn(async (u: string, init: RequestInit) => {
          calls.push({ method: init.method ?? 'GET', url: new URL(u), body: JSON.parse(init.body as string), auth: null })
          return new Response(JSON.stringify(steps[calls.length - 1]()), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }),
      )
      await expect(m.bindPayout('acme', w)).resolves.toMatchObject({ bound: true })
      expect(calls.map((x) => [`${x.method} ${x.url.pathname}`, x.body])).toEqual([
        ['POST /v1/marketplace/seller/payout', { wallet: w.id }],
        ['POST /v1/wallet/wal_acme/sign', { digest: c.digest }],
        ['POST /v1/marketplace/seller/payout/verify', { signature: '0xs1' }],
      ])
    })

    // Red market-15: the page signed the challenge's digest without checking it was the digest of the message.
    it('signs only cloud\'s proof of this wallet for this org', async () => {
      expect(m.unfit(challenge(), 'acme', w)).toBeNull()
      const other = '0x' + 'ab'.repeat(32)
      expect(m.unfit(challenge(message(), { digest: other }), 'acme', w)).toMatch(/not the hash of its message/)
      expect(m.unfit(challenge(message(), { digest: 'nope' }), 'acme', w)).toMatch(/not the hash of its message/)
      expect(m.unfit(challenge(message({ org: 'globex' })), 'acme', w)).toMatch(/not a proof of wal_acme for acme/)
      expect(m.unfit(challenge(message({ wallet: 'wal_other' })), 'acme', w)).toMatch(/not a proof/)
      expect(m.unfit(challenge(message({ address: '0x209693bc6afc0c5328ba36faf03c514ef312287c' })), 'acme', w)).toMatch(/not a proof/)
      expect(m.unfit(challenge(message() + '\norg: acme'), 'acme', w)).toMatch(/not a proof/)
      expect(m.unfit(challenge('Transfer 25000 USDC'), 'acme', w)).toMatch(/not a proof/)
      expect(m.unfit(challenge(message(), { address: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' }), 'acme', w)).toMatch(/names wal_acme at 0x2096/)

      answer2([() => challenge(message(), { digest: other })])
      await expect(m.bindPayout('acme', w)).rejects.toThrow(/Nothing was signed/)
      expect(calls.map((x) => x.url.pathname)).toEqual(['/v1/marketplace/seller/payout'])
      calls = []
      const c = challenge()
      answer2([() => c, () => ({ address: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C', digest: c.digest, signature: '0xs', walletId: w.id })])
      await expect(m.bindPayout('acme', w)).rejects.toThrow(/signed as 0x2096/)
      expect(calls).toHaveLength(2)
    })

  })
})
