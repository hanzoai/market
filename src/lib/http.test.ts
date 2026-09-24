import { blob, needsSession, notServed, Refusal, request, text, unbuilt, unsigned, url, why } from '~/lib/http'

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

  it('names the statuses the storefront treats specially', () => {
    expect([404, 405, 501].every(notServed)).toBe(true)
    expect(notServed(400)).toBe(false)
    expect(notServed(null)).toBe(false)
    expect([401, 403].every(needsSession)).toBe(true)
    expect(needsSession(404)).toBe(false)
    expect(why('plain')).toBe('plain')
    expect(unbuilt(new Error('x'))).toBe(false)
  })
})
