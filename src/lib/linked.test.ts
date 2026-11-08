import { back, connect, github, GITHUB, remember, returned } from '~/lib/linked'
import { Refusal, Silence } from '~/lib/http'

let calls: { url: URL; init: RequestInit }[] = []
const assign = vi.fn()

const serve = (answer: () => Response | Promise<Response>) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: string | URL, init: RequestInit) => {
      calls.push({ url: new URL(u), init })
      return answer()
    }),
  )
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  calls = []
  assign.mockClear()
  localStorage.setItem('hanzo_iam_access_token', 'h.e30.s')
  Object.defineProperty(window, 'location', { value: { origin: 'https://hanzo.market', hostname: 'hanzo.market', pathname: '/experts/join', assign }, configurable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('the identities IAM holds', () => {
  it('reads the GitHub account linked here, from IAM’s envelope or a bare list', async () => {
    serve(() => json({ status: 'ok', data: [{ provider: 'google', subject: 'g1' }, { provider: 'github', subject: '424242' }] }))
    expect(await github()).toBe('424242')
    expect(calls[0]?.url.pathname).toBe('/v1/iam/linked-accounts')
    serve(() => json([{ provider: 'github', subject: '7' }]))
    expect(await github()).toBe('7')
  })

  it('is none when GitHub is not linked, or IAM lists nothing', async () => {
    serve(() => json({ status: 'ok', data: [{ provider: 'google', subject: 'g1' }] }))
    expect(await github()).toBeNull()
    serve(() => json({ status: 'ok', data: [{ provider: 'github', subject: '' }] }))
    expect(await github()).toBeNull()
    serve(() => json({ status: 'ok', data: null }))
    expect(await github()).toBeNull()
  })
})

describe('connecting a provider', () => {
  it('asks IAM on this origin, with the page’s credential and the callback to return to, and goes where IAM says', async () => {
    serve(() => json({ status: 'ok', data: 'https://hanzo.market/v1/iam/link?state=s1' }))
    await connect(GITHUB, '/experts/join')
    const call = calls[0]
    expect(call.url.href).toBe('https://hanzo.market/v1/iam/link')
    expect(call.init.method).toBe('POST')
    expect(call.init.credentials).toBe('include')
    expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer h.e30.s')
    expect(JSON.parse(call.init.body as string)).toEqual({ provider: 'provider-github', clientId: 'hanzo-market', returnUri: 'https://hanzo.market/auth/callback' })
    expect(assign).toHaveBeenCalledWith('https://hanzo.market/v1/iam/link?state=s1')
    expect(back()).toBe('/experts/join')
  })

  it('says IAM’s own words when it refuses, and goes nowhere', async () => {
    serve(() => json({ status: 'error', msg: 'this provider is already connected to your account' }))
    await expect(connect(GITHUB, '/experts/join')).rejects.toMatchObject({ message: 'this provider is already connected to your account' })
    serve(() => json({ status: 'ok', data: null }))
    await expect(connect(GITHUB, '/experts/join')).rejects.toMatchObject({ message: 'Hanzo IAM did not start the connection.' })
    expect(assign).not.toHaveBeenCalled()
  })

  it('says so when the origin does not answer IAM’s link, or nothing answers at all', async () => {
    serve(() => new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } }))
    await expect(connect(GITHUB, '/experts/join')).rejects.toMatchObject({ message: 'Connecting is not available here yet.' })
    serve(() => Promise.reject(new Error('offline')))
    await expect(connect(GITHUB, '/experts/join')).rejects.toBeInstanceOf(Silence)
    expect(assign).not.toHaveBeenCalled()
  })

  it('sends no bearer when there is none', async () => {
    localStorage.clear()
    serve(() => json({ status: 'ok', data: 'https://x/y' }))
    await connect(GITHUB, '/a')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined()
  })
})

describe('coming back', () => {
  it('reads a connect’s return only when one is under way', () => {
    expect(returned('?linked=provider-github')).toBeNull()
    remember('/experts/join')
    expect(returned('?linked=provider-github')).toEqual({ linked: 'provider-github' })
    expect(returned('?error=access_denied&error_description=that%20account%20is%20taken')).toEqual({ refused: 'that account is taken' })
    expect(returned('?error=access_denied')).toEqual({ refused: 'access_denied' })
    expect(returned('?code=abc&state=x')).toBeNull()
  })

  it('goes back to the page it left, once, and never to another site', () => {
    expect(back()).toBe('/')
    remember('/experts/join?x=1')
    expect(back()).toBe('/experts/join?x=1')
    expect(back()).toBe('/')
    remember('//evil.example')
    expect(back()).toBe('/')
  })

  it('is no connect when storage refuses', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(returned('?linked=x')).toBeNull()
    expect(back()).toBe('/')
    expect(() => remember('/a')).not.toThrow()
    vi.restoreAllMocks()
  })
})

describe('a refusal', () => {
  it('is a Refusal carrying the status', async () => {
    serve(() => json({ status: 'error', msg: 'no' }, 400))
    const err = await connect(GITHUB, '/a').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Refusal)
    expect((err as Refusal).status).toBe(400)
  })
})
