/**
 * Where the platform is, decided at call time for the document that is open.
 *
 * On any published host the gateway is addressed absolutely: api.hanzo.ai is the
 * one endpoint. A local page (dev server, preview, the e2e suite) asks its own
 * origin instead, and the Vite proxy forwards `/v1` — a localhost port is not on
 * the gateway's CORS allowlist, so an absolute call from it fails its preflight.
 */
export const GATEWAY = 'https://api.hanzo.ai'

/** hanzo.id is the one issuer. */
export const ISSUER = 'https://hanzo.id'

/** The IAM application this storefront signs in as: `<org>-<app>`. */
export const CLIENT_ID = 'hanzo-market'

/**
 * hanzo.ai, where every Hanzo site on the web signs people in. This site types no
 * credential and draws no account chooser of its own: it sends the browser to
 * hanzo.ai's page with its own authorize request, and the code comes back here.
 * Its pages stay public: only a sign-in leaves.
 */
export const SIGNIN = 'https://hanzo.ai'

export function local(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost')
}

/**
 * A URL someone else supplied (a seller's docs, a delivery link, a catalog
 * entry's site), kept only if it is an absolute http(s) address — anything else
 * (`javascript:`, `data:`, a relative path) is dropped rather than rendered.
 */
export function web(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

/** The gateway origin, no trailing slash: callers write `${api()}/v1/…`. */
export function api(): string {
  if (typeof window === 'undefined') return GATEWAY
  return local(window.location.hostname) ? window.location.origin : GATEWAY
}

/** IAM sign-in configuration for this origin. */
export function iam(): { serverUrl: string; clientId: string; redirectUri: string; organization: string } {
  const origin = typeof window === 'undefined' ? 'https://hanzo.market' : window.location.origin
  return {
    serverUrl: ISSUER,
    clientId: CLIENT_ID,
    redirectUri: `${origin}/auth/callback`,
    organization: CLIENT_ID.split('-')[0],
  }
}

/**
 * hanzo.ai's sign-in (or sign-up) page carrying the query of `authorize`, this
 * site's own authorize request: its client, its callback, a fresh state and the
 * PKCE challenge whose verifier stays in this site's storage. Only the query is
 * kept; the issuer's address is hanzo.ai's to know. hanzo.ai signs the person in,
 * or spends the session it holds, and sends the browser to this site's
 * /auth/callback with the code.
 */
export function signin(authorize: string, mode: 'login' | 'signup' = 'login'): string {
  return `${SIGNIN}/${mode}${new URL(authorize).search}`
}

/**
 * Where a sign-out on `origin` leaves for once the tokens are handed back:
 * hanzo.id's end-session, a top-level visit, which ends the session on every
 * origin IAM signs in on and retires the grant to every Hanzo app with it
 * (`everywhere`), then returns the browser to this site's home page, a
 * post-logout address registered for hanzo-market. The site is public, so a
 * person who leaves lands on it, not on a sign-in. No id_token_hint rides in the
 * address: the session cookie names the person. A local page stays local, on its
 * own home page, since IAM returns no browser to a development address.
 */
export function signout(origin: string): string {
  const home = new URL('/', origin).href
  if (local(new URL(origin).hostname)) return home
  return `${ISSUER}/v1/iam/oauth/logout?${new URLSearchParams({ client_id: CLIENT_ID, everywhere: 'true', post_logout_redirect_uri: home })}`
}
