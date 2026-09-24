import { api, CLIENT_ID, GATEWAY, iam, local, web } from '~/lib/api'

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
