import { Refusal, Silence } from '~/lib/http'
import { handle, mine, PILLARS, show, type Own } from '~/lib/reward'

let calls: { method: string; path: string; body: unknown }[] = []
const serve = (answer: (method: string) => Response | Promise<Response>) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: string, init: RequestInit) => {
      calls.push({ method: init.method ?? 'GET', path: new URL(u).pathname, body: init.body ? JSON.parse(init.body as string) : undefined })
      return answer(init.method ?? 'GET')
    }),
  )
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const own = (over: Partial<Own> = {}): Own => ({ handle: '', public: false, links: {}, ...over })

beforeEach(() => {
  calls = []
})
afterEach(() => vi.unstubAllGlobals())

describe('the member’s profile', () => {
  it('reads the member’s own, and is none where the program is not served', async () => {
    serve(() => json({ handle: 'ada', public: true, links: {} }))
    expect(await mine()).toEqual({ handle: 'ada', public: true, links: {} })
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/v1/reward/me/profile' })
    serve(() => json({ detail: 'not here' }, 404))
    expect(await mine()).toBeNull()
    serve(() => Promise.reject(new Error('offline')))
    expect(await mine()).toBeNull()
    serve(() => json({ detail: 'sign in' }, 401))
    await expect(mine()).rejects.toBeInstanceOf(Refusal)
    expect(new Silence('x')).toBeInstanceOf(Error)
  })

  it('has five pillars in the program’s order', () => {
    expect(PILLARS.map((p) => p.id)).toEqual(['use', 'share', 'community', 'contribute', 'expert'])
  })
})

describe('a handle', () => {
  it('is the first name the program accepts, lower-cased and cleaned', () => {
    expect(handle('Ada Lovelace')).toBe('ada-lovelace')
    expect(handle('', undefined, 'zeekay')).toBe('zeekay')
    expect(handle('ab', 'Grace_H')).toBe('grace_h')
    expect(handle('--x--', 'a.b.c')).toBe('a-b-c')
    expect(handle('x'.repeat(40))).toBe('x'.repeat(32))
    expect(handle('é', '!!', undefined)).toBe('')
    expect(handle()).toBe('')
  })
})

describe('showing level and badges', () => {
  it('does nothing where the program is not served', async () => {
    serve(() => json({}))
    expect(await show(true, null, { github: 'ada' })).toBe(false)
    expect(calls).toEqual([])
  })

  it('makes the profile public under the member’s handle, with their GitHub link', async () => {
    serve(() => json({}))
    expect(await show(true, own(), { github: 'ada', name: 'Ada L' })).toBe(true)
    expect(calls).toEqual([{ method: 'PUT', path: '/v1/reward/me/profile', body: { handle: 'ada', public: true, links: { github: 'https://github.com/ada' } } }])
  })

  it('keeps the handle and links the member already has', async () => {
    serve(() => json({}))
    await show(true, own({ handle: 'grace', links: { x: 'https://x.com/grace' } }), { name: 'Ignored' })
    expect(calls[0]?.body).toEqual({ handle: 'grace', public: true, links: { x: 'https://x.com/grace' } })
  })

  it('derives a handle from the name or the address when GitHub gives none', async () => {
    serve(() => json({}))
    await show(true, own(), { name: 'Ada L' })
    await show(true, own(), { email: 'ada.lovelace@acme.test' })
    expect(calls.map((c) => (c.body as { handle: string }).handle)).toEqual(['ada-l', 'ada-lovelace'])
  })

  it('refuses to guess a handle it cannot make', async () => {
    serve(() => json({}))
    await expect(show(true, own(), {})).rejects.toMatchObject({ status: 400 })
    expect(calls).toEqual([])
  })

  it('makes a public profile private again, and leaves a private one alone', async () => {
    serve(() => json({}))
    expect(await show(false, own({ handle: 'ada', public: true }), {})).toBe(true)
    expect(calls).toEqual([{ method: 'PUT', path: '/v1/reward/me/profile', body: { handle: 'ada', public: false, links: {} } }])
    calls = []
    expect(await show(false, own({ handle: 'ada' }), {})).toBe(true)
    expect(calls).toEqual([])
  })

  it('says the program’s refusal, a handle someone holds', async () => {
    serve(() => json({ detail: 'that handle is taken' }, 409))
    await expect(show(true, own(), { github: 'ada' })).rejects.toMatchObject({ status: 409, message: 'that handle is taken' })
  })
})
