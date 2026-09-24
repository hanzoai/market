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
