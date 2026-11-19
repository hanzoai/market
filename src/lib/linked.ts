// The sign-in identities Hanzo IAM holds for this account, and the way to connect
// another: IAM's own `GET /v1/iam/linked-accounts` and `POST /v1/iam/link`. Nothing
// here authenticates or keeps a token; IAM links a provider to the account that is
// signed in, runs the provider's consent, and brings the browser back.

import { api, CLIENT_ID, local, SIGNIN } from '~/lib/api'
import { Refusal, Silence, why } from '~/lib/http'
import { bearer } from '~/lib/token'

/** The provider records of the `hanzo-market` application (`GET /v1/iam/auth/methods`). */
export const GITHUB = 'provider-github'

/** Where the page the person was on is kept while the browser is away at the provider. */
const BACK = 'market:link'

/** IAM answers `{status, data}`; a bare list is read the same. */
const rows = (body: unknown): unknown[] => {
  const data = (body as { data?: unknown } | null)?.data ?? body
  return Array.isArray(data) ? data : []
}

/**
 * The id of the GitHub account linked here, or null when none is, or IAM would not
 * say. Asked outside `request`: whatever IAM answers to this question is no word on
 * the session, so it must not sign the reader out.
 */
export async function github(): Promise<string | null> {
  const token = bearer()
  if (!token) return null
  let res: Response
  try {
    res = await fetch(`${api()}/v1/iam/linked-accounts`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
  } catch {
    return null
  }
  if (!res.ok) return null
  for (const r of rows(await res.json().catch(() => null)) as { provider?: unknown; subject?: unknown }[]) {
    if (r.provider === 'github' && typeof r.subject === 'string' && r.subject) return r.subject
  }
  return null
}

/** Say where to come back to once the provider has been connected. */
export function remember(path: string): void {
  try {
    window.sessionStorage.setItem(BACK, path)
  } catch {
    /* the person lands on the home page */
  }
}

/** Where the connect started, read once. */
export function back(): string {
  try {
    const to = window.sessionStorage.getItem(BACK)
    window.sessionStorage.removeItem(BACK)
    return to && to.startsWith('/') && !to.startsWith('//') ? to : '/'
  } catch {
    return '/'
  }
}

/**
 * Where a connect starts: hanzo.ai, the origin the person signed in on.
 *
 * IAM answers the start with an address on the sign-in origin the request reached,
 * and opening it needs the person's session THERE (federation_link.go `follow`,
 * `signedInHere`). The market keeps no session of its own since it signs in on
 * hanzo.ai (D5), so a start on this origin would open on the issuer, hanzo.id,
 * where the person holds none, and stop at "sign in here as the account you are
 * connecting". Started on hanzo.ai, it opens where the session lives. The call
 * carries the market's own bearer, which IAM accepts from the platform's own
 * applications, and hanzo.ai admits hanzo.market's requests (CORS). A local page
 * asks its own origin, as every other call here does.
 */
export function linkOrigin(): string {
  return local(window.location.hostname) ? window.location.origin : SIGNIN
}

/**
 * Start connecting `provider` to this account: IAM answers an address, and the
 * browser goes there; IAM sends it on to the provider and then to `/auth/callback`
 * with `linked=<provider>` (or the reason it refused). A call IAM does not answer
 * is said as it is.
 */
export async function connect(provider: string, path: string): Promise<void> {
  let res: Response
  const at = linkOrigin()
  try {
    res = await fetch(new URL('/v1/iam/link', at), {
      method: 'POST',
      // The bearer names the person. hanzo.ai admits this origin without
      // credentials (no Access-Control-Allow-Credentials), so cookies ride only
      // on a same-origin (local) call.
      credentials: at === window.location.origin ? 'include' : 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(bearer() ? { Authorization: `Bearer ${bearer()}` } : {}) },
      body: JSON.stringify({ provider, clientId: CLIENT_ID, returnUri: `${window.location.origin}/auth/callback` }),
    })
  } catch (e) {
    throw new Silence(`Hanzo IAM did not answer: ${why(e)}`)
  }
  const body = (await res.json().catch(() => null)) as { status?: string; data?: unknown; msg?: string } | null
  if (!body) throw new Refusal(res.status, 'Connecting is not available here yet.')
  if (typeof body.data !== 'string' || body.status === 'error') throw new Refusal(res.status, typeof body.msg === 'string' && body.msg ? body.msg : 'Hanzo IAM did not start the connection.')
  remember(path)
  window.location.assign(body.data)
}

/** What the callback was told on its way back from a connect: the provider connected, or why not. Null when no connect is under way, so a sign-in's return is never read as one. */
export function returned(search: string): { linked: string } | { refused: string } | null {
  try {
    if (!window.sessionStorage.getItem(BACK)) return null
  } catch {
    return null
  }
  const q = new URLSearchParams(search)
  const linked = q.get('linked')
  if (linked) return { linked }
  const refused = q.get('error_description') ?? q.get('error')
  return refused ? { refused } : null
}
