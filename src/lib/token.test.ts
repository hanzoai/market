import { acting, bearer, choice, claims, org, orgs, own, show, subject, work } from '~/lib/token'

const jwt = (payload: unknown) => `h.${btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`

beforeEach(() => localStorage.clear())

describe('session token', () => {
  it('reads nothing when signed out', () => {
    expect(bearer()).toBeNull()
    expect(claims()).toBeNull()
    expect(subject()).toBeUndefined()
    expect(orgs()).toEqual([])
    expect(org()).toBeNull()
  })

  it('reads the claims the stored token carries', () => {
    localStorage.setItem('hanzo_iam_access_token', jwt({ sub: 'acme/ada', orgs: [{ org: 'acme' }, 'globex', { org: 'acme' }, { nope: 1 }] }))
    expect(bearer()).not.toBeNull()
    expect(subject()).toBe('acme/ada')
    expect(orgs()).toEqual(['acme', 'globex'])
    expect(org()).toBe('acme')
  })

  it('switches only to an org the token lists', () => {
    localStorage.setItem('hanzo_iam_access_token', jwt({ sub: 's', orgs: ['acme', 'globex'] }))
    expect(work('initech')).toBe(false)
    expect(work('globex')).toBe(true)
    expect(org()).toBe('globex')
  })

  it('treats a malformed token as no claims', () => {
    localStorage.setItem('hanzo_iam_access_token', 'not-a-jwt')
    expect(claims()).toBeNull()
    localStorage.setItem('hanzo_iam_access_token', 'a.%%%.b')
    expect(claims()).toBeNull()
  })

  it('forgets the last person’s org choice when someone else signs in', () => {
    localStorage.setItem('hanzo:who', 'acme/ada')
    localStorage.setItem('hanzo_iam_current_org', 'globex')
    localStorage.setItem('hanzo_iam_access_token', 't')
    localStorage.setItem('hanzo:other', 'x')
    own('acme/ada')
    expect(localStorage.getItem('hanzo_iam_current_org')).toBe('globex')
    own('initech/bob')
    expect(localStorage.getItem('hanzo_iam_current_org')).toBeNull()
    expect(localStorage.getItem('hanzo:other')).toBeNull()
    expect(localStorage.getItem('hanzo_iam_access_token')).toBe('t')
    expect(localStorage.getItem('hanzo:who')).toBe('initech/bob')
    own(undefined)
    expect(localStorage.getItem('hanzo:who')).toBeNull()
  })

  // Red market-13: another tab's switch made this one act as an org it was not showing.
  it('acts as the org this tab shows, whatever another tab stored since', () => {
    localStorage.setItem('hanzo_iam_access_token', jwt({ sub: 's', orgs: ['acme', 'globex'] }))
    expect(acting()).toBe('acme')
    show('acme')
    localStorage.setItem('hanzo_iam_current_org', 'globex')
    expect(org()).toBe('globex')
    expect(acting()).toBe('acme')
    show('globex')
    expect(acting()).toBe('globex')
    show(null)
    expect(acting()).toBeNull()
    expect(choice('hanzo_iam_current_org')).toBe(true)
    expect(choice(null)).toBe(true)
    expect(choice('hanzo_iam_access_token')).toBe(false)
  })
})
