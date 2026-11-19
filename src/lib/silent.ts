// SIGNED IN ON ANOTHER HANZO SITE IS SIGNED IN HERE.
//
// This site holds no IAM session of its own: IAM's cookie (`__Host-hanzo_session`)
// is hanzo.ai's alone, set wherever a person signs in on hanzo.ai's page, for
// hanzo.app, hanzo.team, hanzo.bot or this site. So a tab with no tokens asks
// hanzo.ai, with no page: this site's own authorize request (its client, its
// callback, a fresh state and PKCE challenge) with `prompt=none`, at IAM's
// authorize on hanzo.ai. Signed in there, the code comes back to /auth/callback
// and is exchanged like any other; nobody signed in, IAM answers
// `login_required` and the callback goes back to the page the ask left, saying
// nothing. IAM answers it for the platform's own apps that share one sign-out
// (hanzoai/iam `silentAtSigninOrigin`, D6; hanzo-market is on IAM_SIGNOUT_APPS),
// so a silent answer can never revive a session the person ended.
//
// The ask is a page navigation because it has to be: the session cookie is
// SameSite=Lax, so a fetch or a frame from this origin reaches IAM without it.
// It is made at most once a minute, by the tab's own clock (sessionStorage), on
// a page the tab opens and when it is looked at again; never from a page the
// reader has typed into (session.tsx), never from a development address (IAM
// returns no browser there), and never by a crawler or an automated browser.
// hanzo.team and hanzo.app ask the same way.

import { local, SIGNIN } from '~/lib/api'

/** When this tab last asked hanzo.ai. */
const ASKED_AT = 'market:silent.at'
/** The state of the ask in flight, so its refusal is told from any other callback. */
const PENDING = 'market:silent.state'
/** How long after one ask the next may be made, and how long a tab is looked away from before its session is asked about again. */
export const REASK = 60_000
/** What names itself a crawler, a preview fetcher or a headless browser. */
const AUTOMATED = /bot|crawl|spider|slurp|preview|lighthouse|headless/i
/** What IAM answers a `prompt=none` the session cannot (OIDC Core §3.1.2.6). */
const QUIET = new Set(['login_required', 'interaction_required', 'consent_required', 'account_selection_required'])

/** Whether this tab may ask hanzo.ai now: a person's browser on the published host, with no ask in the last minute. */
export function due(now = Date.now()): boolean {
  if (typeof window === 'undefined' || local(window.location.hostname)) return false
  if (navigator.webdriver || AUTOMATED.test(navigator.userAgent)) return false
  try {
    return now - (Number(window.sessionStorage.getItem(ASKED_AT)) || 0) >= REASK
  } catch {
    return false
  }
}

/** Start the minute: before an ask leaves, and before a sign-out, so the page it lands on asks nothing. */
export function spend(now = Date.now()): void {
  try {
    window.sessionStorage.setItem(ASKED_AT, String(now))
  } catch {
    /* a browser with no store is never `due` */
  }
}

/**
 * IAM's authorize on hanzo.ai carrying `request`, this site's own authorize
 * request, with `prompt=none`. Only the query is kept, as for the sign-in page
 * (`signin`). The ask is written down as in flight, by its state.
 */
export function silent(request: string): string {
  const own = new URL(request)
  own.searchParams.set('prompt', 'none')
  try {
    window.sessionStorage.setItem(PENDING, own.searchParams.get('state') ?? '')
  } catch {
    /* its refusal is then shown as any other */
  }
  return `${SIGNIN}/v1/iam/oauth/authorize${own.search}`
}

/**
 * What the callback at `search` is to this tab's silent ask: `refused` when IAM
 * found nobody to answer it with (back to the page, nothing said), `answered`
 * when it brought a code, or null when it is no silent ask of this tab's (a
 * sign-in the person made, or a stranger's address). Reading it ends the ask.
 */
export function settle(search: string): 'refused' | 'answered' | null {
  let pending: string | null = null
  try {
    pending = window.sessionStorage.getItem(PENDING)
    window.sessionStorage.removeItem(PENDING)
  } catch {
    return null
  }
  const q = new URLSearchParams(search)
  if (!pending || q.get('state') !== pending) return null
  const error = q.get('error')
  if (error) return QUIET.has(error) ? 'refused' : null
  return q.get('code') ? 'answered' : null
}

/**
 * Whether IAM refused this site's token outright: the SDK's userinfo read names
 * the status it got (`Userinfo fetch failed (401)`). Only a 401 says the grant is
 * gone; a network fault or a 5xx says nothing about the person.
 */
export function revoked(e: unknown): boolean {
  return e instanceof Error && e.message.includes('(401)')
}
