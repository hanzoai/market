import { due, REASK, revoked, settle, silent, spend } from '~/lib/silent'

const at = (hostname: string) => Object.defineProperty(window, 'location', { value: { hostname, origin: `https://${hostname}` }, configurable: true })
const agent = (ua: string, webdriver = false) => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
  Object.defineProperty(navigator, 'webdriver', { value: webdriver, configurable: true })
}
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36'
const REQUEST =
  'https://hanzo.id/login/oauth/authorize?client_id=hanzo-market&response_type=code&redirect_uri=https%3A%2F%2Fhanzo.market%2Fauth%2Fcallback&scope=openid&state=s-1&code_challenge=c&code_challenge_method=S256'

beforeEach(() => {
  at('hanzo.market')
  agent(CHROME)
})

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('when a tab may ask hanzo.ai', () => {
  it('asks at once, then not again for a minute, then again', () => {
    const now = 1_000_000_000
    expect(due(now)).toBe(true)
    spend(now)
    expect(due(now + 1)).toBe(false)
    expect(due(now + REASK - 1)).toBe(false)
    expect(due(now + REASK)).toBe(true)
  })

  it('reads a clock it cannot parse as never having asked', () => {
    sessionStorage.setItem('market:silent.at', 'soon')
    expect(due()).toBe(true)
  })

  it('never asks from a development address, a crawler or an automated browser', () => {
    at('127.0.0.1')
    expect(due()).toBe(false)
    at('market.localhost')
    expect(due()).toBe(false)
    at('hanzo.market')
    agent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
    expect(due()).toBe(false)
    agent(CHROME.replace('Chrome', 'HeadlessChrome'))
    expect(due()).toBe(false)
    agent(CHROME, true)
    expect(due()).toBe(false)
  })

  it('never asks from a browser that keeps no store, and spends nothing there', () => {
    // vitest.setup.ts stands its own store in for the browser's: refuse that one.
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(due()).toBe(false)
    expect(() => spend()).not.toThrow()
    expect(silent(REQUEST)).toContain('prompt=none')
    expect(settle('?state=s-1&error=login_required')).toBeNull()
  })
})

describe('the silent ask', () => {
  it('is this site’s own request, with prompt=none, at IAM’s authorize on hanzo.ai', () => {
    const to = new URL(silent(REQUEST))
    expect(to.origin + to.pathname).toBe('https://hanzo.ai/v1/iam/oauth/authorize')
    expect(to.searchParams.get('prompt')).toBe('none')
    expect(to.searchParams.get('client_id')).toBe('hanzo-market')
    expect(to.searchParams.get('redirect_uri')).toBe('https://hanzo.market/auth/callback')
    expect(to.searchParams.get('code_challenge')).toBe('c')
    expect(to.searchParams.get('state')).toBe('s-1')
  })

  it('replaces any prompt the request carried', () => {
    expect(new URL(silent(`${REQUEST}&prompt=login`)).searchParams.getAll('prompt')).toEqual(['none'])
  })
})

describe('what the callback is to the ask', () => {
  it('a refusal of this tab’s own ask is quiet, and only once', () => {
    silent(REQUEST)
    expect(settle('?state=s-1&error=login_required&error_description=nobody')).toBe('refused')
    expect(settle('?state=s-1&error=login_required')).toBeNull()
  })

  it('every refusal IAM gives a prompt=none is quiet', () => {
    for (const error of ['login_required', 'interaction_required', 'consent_required', 'account_selection_required']) {
      silent(REQUEST)
      expect(settle(`?state=s-1&error=${error}`)).toBe('refused')
    }
  })

  it('a code for this tab’s ask is a sign-in by the session hanzo.ai held', () => {
    silent(REQUEST)
    expect(settle('?state=s-1&code=abc')).toBe('answered')
  })

  it('anything else is shown as it always was', () => {
    // No ask in flight: the person's own sign-in, or a stranger's address.
    expect(settle('?state=s-1&error=login_required')).toBeNull()
    // Another state than the ask's.
    silent(REQUEST)
    expect(settle('?state=other&error=login_required')).toBeNull()
    // A fault, not a refusal to answer silently.
    silent(REQUEST)
    expect(settle('?state=s-1&error=server_error')).toBeNull()
    // Neither a code nor an error.
    silent(REQUEST)
    expect(settle('?state=s-1')).toBeNull()
  })
})

describe('a token IAM no longer holds', () => {
  it('is a 401 from userinfo, and nothing else', () => {
    expect(revoked(new Error('Userinfo fetch failed (401)'))).toBe(true)
    expect(revoked(new Error('Userinfo fetch failed (500)'))).toBe(false)
    expect(revoked(new Error('Failed to fetch'))).toBe(false)
    expect(revoked('(401)')).toBe(false)
  })
})
