import PocketBase from 'pocketbase'
import { env } from '../lib/env.js'

// PocketBase SDK client — talks to Hanzo Base (sidecar at BASE_URL).
//
// Modern Hanzo Base is a pure IAM client: it validates every collection
// request's bearer token against IAM (hanzo.id) userinfo/JWKS and has no
// local password / OTP / MFA surface (the legacy `_superusers`
// authWithPassword path returns 410 Gone). The market API therefore
// authenticates to Base as a service principal using its own IAM
// application credentials via the OAuth2 client_credentials grant; the
// resulting access token is installed on pb.authStore so the SDK sends it
// as the Authorization header on every request.
export const pb = new PocketBase(env.baseUrl)

// Refresh the service token this many ms before its declared expiry so a
// request never rides an already-expired token.
const EXPIRY_SKEW_MS = 60_000

// Fallback lifetime when IAM omits expires_in. Conservative: forces a
// re-exchange every 5 minutes rather than trusting an unbounded token.
const DEFAULT_TTL_MS = 5 * 60_000

let tokenExpiresAt = 0
let inflight: Promise<void> | null = null

type TokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: string
  error_description?: string
}

// ensureAdminAuth installs (and refreshes) the service-account access token
// on pb.authStore. Concurrent callers coalesce onto a single in-flight
// exchange. Fails closed: on any error the token is cleared and the error
// propagates so callers return 5xx rather than issuing unauthenticated
// Base requests.
export async function ensureAdminAuth(): Promise<void> {
  if (pb.authStore.token && Date.now() < tokenExpiresAt - EXPIRY_SKEW_MS) {
    return
  }
  if (inflight) return inflight

  inflight = exchangeClientCredentials()
    .finally(() => {
      inflight = null
    })
  return inflight
}

async function exchangeClientCredentials(): Promise<void> {
  if (!env.iamClientId || !env.iamClientSecret) {
    pb.authStore.clear()
    tokenExpiresAt = 0
    throw new Error(
      'Base service auth misconfigured: IAM_CLIENT_ID / IAM_CLIENT_SECRET are required',
    )
  }

  let res: Response
  try {
    res = await fetch(env.iamTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.iamClientId,
        client_secret: env.iamClientSecret,
        scope: 'openid profile email',
      }),
    })
  } catch (err) {
    pb.authStore.clear()
    tokenExpiresAt = 0
    // Network error to IAM — do not leak details to callers; log server-side.
    console.error('IAM client_credentials request failed:', err)
    throw new Error('Base service auth failed: IAM unreachable')
  }

  if (!res.ok) {
    pb.authStore.clear()
    tokenExpiresAt = 0
    const body = await res.text().catch(() => '')
    console.error(`IAM client_credentials returned ${res.status}: ${body}`)
    throw new Error(`Base service auth failed: IAM returned ${res.status}`)
  }

  const tokens = (await res.json()) as TokenResponse
  if (!tokens.access_token) {
    pb.authStore.clear()
    tokenExpiresAt = 0
    throw new Error('Base service auth failed: IAM response missing access_token')
  }

  const ttlMs = tokens.expires_in ? tokens.expires_in * 1000 : DEFAULT_TTL_MS
  tokenExpiresAt = Date.now() + ttlMs

  // Install the IAM access token as the SDK's bearer. The second arg is the
  // auth record model; null is correct for a service principal with no Base
  // user row — the SDK still attaches authStore.token to every request.
  pb.authStore.save(tokens.access_token, null)
}
