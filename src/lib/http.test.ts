import { blob, LAPSED, lost, needsSession, notServed, Refusal, request, Silence, text, unbuilt, unsigned, url, why } from '~/lib/http'
import { show } from '~/lib/token'

const jwt = `h.${btoa(JSON.stringify({ sub: 's', orgs: ['acme'] }))}.s`

function answer(status: number, body: string, type = 'application/json') {
  return vi.fn(async () => new Response(status === 204 ? null : body, { status, headers: { 'Content-Type': type } }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('http', () => {
  it('builds a gateway URL and drops empty query values', () => {
    expect(url('/v1/catalog', { q: 'chat', limit: 5, org: '', kind: undefined, x: null, on: true })).toBe(
      `${window.location.origin}/v1/catalog?q=chat&limit=5&on=true`,
    )
  })

  it('sends the bearer and the org when signed in', async () => {
    localStorage.setItem('hanzo_iam_access_token', jwt)
    const f = answer(200, '{"ok":true}')
    vi.stubGlobal('fetch', f)
    expect(await request({ method: 'POST', path: '/v1/x', body: { a: 1 } })).toEqual({ ok: true })
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    const h = init.headers as Headers
    expect(h.get('Authorization')).toBe(`Bearer ${jwt}`)
    expect(h.get('X-Org-Id')).toBe('acme')
    expect(h.get('Content-Type')).toBe('application/json')
    expect(init.body).toBe('{"a":1}')
  })

  it('sends no credential on a public read', async () => {
    localStorage.setItem('hanzo_iam_access_token', jwt)
    const f = answer(200, '{}')
    vi.stubGlobal('fetch', f)
    await request({ path: '/v1/catalog', anonymous: true })
    const h = (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers
    expect(h.get('Authorization')).toBeNull()
    expect(h.get('X-Org-Id')).toBeNull()
  })

  it('answers undefined for 204, text and blobs as they are', async () => {
    vi.stubGlobal('fetch', answer(204, ''))
    expect(await request({ method: 'DELETE', path: '/v1/x' })).toBeUndefined()
    vi.stubGlobal('fetch', answer(200, '# skill', 'text/markdown'))
    expect(await text({ path: '/x.md' })).toBe('# skill')
    vi.stubGlobal('fetch', answer(200, 'PDF', 'application/pdf'))
    expect((await blob({ path: '/x.pdf' })).size).toBe(3)
  })

  it('turns a refusal into the platform’s own sentence', async () => {
    vi.stubGlobal('fetch', answer(404, '{"type":"about:blank","status":404,"detail":"no route","code":"nf"}', 'application/problem+json'))
    const e = await request({ path: '/v1/principal' }).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(Refusal)
    expect(e).toMatchObject({ status: 404, message: 'no route', code: 'nf' })
    expect(unbuilt(e)).toBe(true)
    expect(unsigned(e)).toBe(false)

    vi.stubGlobal('fetch', answer(403, '{"error":"a validated principal is required"}'))
    const f = await request({ path: '/v1/x' }).catch((x: unknown) => x)
    expect(why(f)).toBe('a validated principal is required')
    expect(unsigned(f)).toBe(true)

    vi.stubGlobal('fetch', answer(502, 'error code: 502', 'text/plain'))
    expect(why(await request({ path: '/v1/x' }).catch((x: unknown) => x))).toBe('error code: 502')

    vi.stubGlobal('fetch', answer(500, '{}'))
    expect(await request({ path: '/v1/x' }).catch((x: unknown) => (x as Refusal).status)).toBe(500)
  })

  it('keeps the whole problem document on the refusal', async () => {
    vi.stubGlobal('fetch', answer(402, '{"status":402,"detail":"sign the payment","paymentRequired":"e30="}', 'application/problem+json'))
    const e = (await request({ method: 'POST', path: '/v1/marketplace/jobs', body: {} }).catch((x: unknown) => x)) as Refusal
    expect(e.problem).toMatchObject({ paymentRequired: 'e30=' })
  })

  // Red market-8: a session the gateway refuses is a signed-out reader.
  it('says the session lapsed when the gateway refuses the bearer it was sent', async () => {
    const heard = vi.fn()
    window.addEventListener(LAPSED, heard)
    vi.stubGlobal('fetch', answer(401, '{"status":401,"detail":"token expired"}', 'application/problem+json'))
    await request({ path: '/v1/principal' }).catch(() => undefined)
    expect(heard).not.toHaveBeenCalled() // no bearer was sent, so nothing lapsed
    localStorage.setItem('hanzo_iam_access_token', jwt)
    await request({ path: '/v1/principal', anonymous: true }).catch(() => undefined)
    expect(heard).not.toHaveBeenCalled()
    await request({ path: '/v1/principal' }).catch(() => undefined)
    expect(heard).toHaveBeenCalledTimes(1)
    vi.stubGlobal('fetch', answer(403, '{"status":403,"detail":"not an admin"}', 'application/problem+json'))
    await request({ path: '/v1/principal' }).catch(() => undefined)
    expect(heard).toHaveBeenCalledTimes(1)
    window.removeEventListener(LAPSED, heard)
  })

  it('names the statuses the storefront treats specially', () => {
    expect([404, 405, 501].every(notServed)).toBe(true)
    expect(notServed(400)).toBe(false)
    expect(notServed(null)).toBe(false)
    expect([401, 403].every(needsSession)).toBe(true)
    expect(needsSession(404)).toBe(false)
    expect(why('plain')).toBe('plain')
    expect(unbuilt(new Error('x'))).toBe(false)
  })

  // Red market-13: X-Org-Id was read from storage every tab shares, not the org this tab shows.
  it('sends the org this tab shows', async () => {
    localStorage.setItem('hanzo_iam_access_token', `h.${btoa(JSON.stringify({ sub: 's', orgs: ['acme', 'globex'] }))}.s`)
    show('acme')
    localStorage.setItem('hanzo_iam_current_org', 'globex')
    const f = answer(200, '{}')
    vi.stubGlobal('fetch', f)
    await request({ method: 'POST', path: '/v1/tax/profile/certify', body: {} })
    expect(((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers).get('X-Org-Id')).toBe('acme')
  })

  it('says no answer came back when the request never reached the platform', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    const e = await request({ method: 'POST', path: '/v1/marketplace/jobs', body: {} }).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(Silence)
    expect(e).toMatchObject({ message: 'api.hanzo.ai did not answer: Failed to fetch' })
    expect(lost(e)).toBe(true)
    expect(lost(new Refusal(503, 'down'))).toBe(true)
    expect(lost(new Refusal(404, 'no route'))).toBe(false)
  })
})
