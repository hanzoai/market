import { api, CLIENT_ID, GATEWAY, iam, ISSUER, local, SIGNIN, signin, signout, web } from '~/lib/api'

describe('where the platform is', () => {
  it('knows a local page from a published one', () => {
    expect(local('localhost')).toBe(true)
    expect(local('127.0.0.1')).toBe(true)
    expect(local('market.localhost')).toBe(true)
    expect(local('hanzo.market')).toBe(false)
  })

  it('asks its own origin locally, and api.hanzo.ai when published', () => {
    expect(api()).toBe(window.location.origin)
    const was = window.location
    Object.defineProperty(window, 'location', { value: new URL('https://hanzo.market/sell'), configurable: true })
    try {
      expect(api()).toBe(GATEWAY)
      expect(iam().redirectUri).toBe('https://hanzo.market/auth/callback')
    } finally {
      Object.defineProperty(window, 'location', { value: was, configurable: true })
    }
  })

  it('signs in as hanzo-market against hanzo.id', () => {
    expect(iam()).toMatchObject({ serverUrl: 'https://hanzo.id', clientId: CLIENT_ID, organization: 'hanzo' })
    expect(CLIENT_ID).toBe('hanzo-market')
  })
})

describe('signing in on hanzo.ai, and out through hanzo.id', () => {
  const own =
    'https://hanzo.id/v1/iam/oauth/authorize?client_id=hanzo-market&response_type=code&redirect_uri=https%3A%2F%2Fhanzo.market%2Fauth%2Fcallback&scope=openid+profile+email&state=s1&code_challenge=c1&code_challenge_method=S256'

  it('carries this site’s own authorize request to hanzo.ai’s sign-in, and only its query', () => {
    const to = new URL(signin(own))
    expect(to.origin).toBe(SIGNIN)
    expect(to.pathname).toBe('/login')
    expect(to.search).toBe(new URL(own).search)
    expect(Object.fromEntries(to.searchParams)).toMatchObject({
      client_id: 'hanzo-market',
      response_type: 'code',
      redirect_uri: 'https://hanzo.market/auth/callback',
      state: 's1',
      code_challenge: 'c1',
      code_challenge_method: 'S256',
    })
    expect(signin(own)).not.toContain('hanzo.id')
  })

  it('carries it to hanzo.ai’s sign-up for a new account', () => {
    expect(new URL(signin(own, 'signup')).pathname).toBe('/signup')
    expect(new URL(signin(own, 'signup')).searchParams.get('client_id')).toBe('hanzo-market')
  })

  it('signs out through hanzo.id’s end-session for every Hanzo app, back to the home page, with no token in the address', () => {
    const to = new URL(signout('https://hanzo.market'))
    expect(to.origin + to.pathname).toBe(`${ISSUER}/v1/iam/oauth/logout`)
    expect(Object.fromEntries(to.searchParams)).toEqual({ client_id: 'hanzo-market', everywhere: 'true', post_logout_redirect_uri: 'https://hanzo.market/' })
    expect(to.searchParams.has('id_token_hint')).toBe(false)
  })

  it('stays local on a local page, landing on its own home page', () => {
    expect(signout('http://127.0.0.1:4330')).toBe('http://127.0.0.1:4330/')
    expect(signout('http://localhost:5173')).toBe('http://localhost:5173/')
    expect(signout('http://market.localhost')).toBe('http://market.localhost/')
  })
})

describe('web', () => {
  it('keeps only absolute http(s) addresses someone else supplied', () => {
    expect(web('https://docs.orbital.dev/x')).toBe('https://docs.orbital.dev/x')
    expect(web('http://example.com')).toBe('http://example.com/')
    expect(web('javascript:alert(1)')).toBeNull()
    expect(web('data:text/html,hi')).toBeNull()
    expect(web('/relative')).toBeNull()
    expect(web('')).toBeNull()
    expect(web(undefined)).toBeNull()
    expect(web(null)).toBeNull()
  })
})
