// Telemetry — the ONE client, `@hanzo/event`, posting to POST /v1/event.
//
// This replaces `@vercel/analytics`, which was the only telemetry this surface
// had: it shipped every pageview to Vercel, a third party we do not read and do
// not run on (market deploys to our own k8s), so the marketplace was effectively
// dark AND leaking. Cloud resolves analytics, insights and the error dashboard as
// lenses over the one `/v1/event` stream, so there is no second client here.

import { useRouterState } from '@tanstack/react-router'
import { AnalyticsProvider, ErrorBoundary, useAnalytics, usePageview } from '@hanzo/event/react'
import { useEffect, type ReactNode } from 'react'
import { useAuthContext } from '../lib/AuthContext'

/** Cloud front door: POST /v1/event, body { batch: [Event…] }. This is
 *  api.hanzo.ai, NOT this app's own `VITE_API_URL` — the market API is a
 *  different service behind a different door. */
const EVENT_HOST = import.meta.env.VITE_HANZO_API_URL || 'https://api.hanzo.ai'

/** Publishable ingest key, write-only and safe in the bundle. It resolves the
 *  request to this org; without it cloud files the traffic under the reserved
 *  `$public` tenant, which stores only pageview and error and which our org
 *  cannot read. Prefix is `pk-` (cloud.PublishablePrefix); other prefixes are
 *  not recognized as a key and fall through to `$public`.
 *  Mint: POST /v1/keys {"type":"publishable"} */
const INGEST_KEY = import.meta.env.VITE_EVENT_INGEST_KEY

/** Consent gate: Do Not Track and Global Privacy Control are opt-out. The SDK
 *  reads neither, so every surface passes `enabled` itself. */
function telemetryEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const w = window as unknown as { doNotTrack?: string }
  const n = navigator as unknown as {
    doNotTrack?: string
    msDoNotTrack?: string
    globalPrivacyControl?: boolean
  }
  const dnt = n.doNotTrack ?? w.doNotTrack ?? n.msDoNotTrack
  if (dnt === '1' || dnt === 'yes') return false
  if (n.globalPrivacyControl) return false
  return true
}

/** Route-change pageviews. TanStack Router's location is the source of truth;
 *  the provider's autoPageview covers the first load, so pages count once. */
function Pageview() {
  usePageview(useRouterState({ select: (s) => s.location.pathname }))
  return null
}

/**
 * The ONE place this surface binds telemetry identity — mounted inside
 * AuthProvider so it sees the resolved session on every route.
 *
 * The subject is the market user id, which is what joins a publisher's events to
 * the skills they own here. Traits come from the SAME `/auth/me` response the id
 * is read from, so nothing new is collected; they are what makes an otherwise
 * opaque subject legible in a funnel.
 *
 * Traits ride an AUTHENTICATED session only — the anonymous `$public` lane drops
 * `identify` outright — and consent still governs everything: under DNT / GPC the
 * client is disabled and no traits are sent either.
 *
 * THE CLIENT DOES NOT SEND THE ORG. There is deliberately no group() call: cloud
 * stamps the tenant server-side, and a tenant a client can name is a tenant a
 * client can get wrong.
 */
export function Identity() {
  const { user } = useAuthContext()
  const analytics = useAnalytics()
  const subject = user?.id
  useEffect(() => {
    if (!subject) return
    const traits: Record<string, unknown> = {}
    // A key is OMITTED rather than sent undefined: a trait sent as undefined is a
    // trait written, and it would blank a value an earlier identify established.
    if (user?.email) traits.email = user.email
    const name = user?.displayName || user?.handle
    if (name) traits.name = name
    analytics.identify(subject, Object.keys(traits).length ? traits : undefined)
    // The subject changing is what marks a new person; the traits object is
    // rebuilt every render and would re-identify on each one.
  }, [analytics, subject])
  return null
}

/** Minimal fallback when a render error is caught. The boundary already posted it
 *  as a type:'error' event, which is what sentry.hanzo.ai reads, so this just
 *  keeps the page usable. */
function Crashed(_error: Error, reset: () => void) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-medium">Something went wrong.</p>
      <button type="button" onClick={reset} className="rounded-full border px-5 py-2 text-sm font-medium">
        Try again
      </button>
    </div>
  )
}

/**
 * Telemetry root. `AnalyticsProvider` builds the client, fires the first pageview
 * and installs the window.onerror / unhandledrejection capture; `ErrorBoundary`
 * catches React render errors, which never reach window.onerror.
 *
 * NO `getToken`. This app's stored bearer is a MARKET session token
 * (`market.session.token`), minted by the market API and meaningless to
 * api.hanzo.ai — presenting it would fail closed and drop every event. Anonymous
 * attribution is what the publishable `pk-` key is for, and it is the whole
 * credential this surface needs.
 *
 * `environment` is passed explicitly: the SDK's fallback reads `process.env`,
 * which does not exist in a Vite browser bundle, so every build would otherwise
 * report an unset environment. `import.meta.env.MODE` is Vite's equivalent.
 */
export function Telemetry({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProvider
      config={{
        product: 'market',
        host: EVENT_HOST,
        ingestKey: INGEST_KEY,
        enabled: telemetryEnabled(),
        environment: import.meta.env.MODE,
      }}
    >
      <Pageview />
      <ErrorBoundary fallback={Crashed}>{children}</ErrorBoundary>
    </AnalyticsProvider>
  )
}
