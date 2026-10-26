// Our stream, the ad tags and consent, all from @hanzo/event. Every event is a
// POST to api.hanzo.ai/v1/event under hanzo.market's own project key, which
// @hanzo/event finds by host (`siteKey`). Which ad tags load (GA4, the Meta
// Pixel) is that project's tag set in cloud (/v1/project/tags, asked with the
// same key and this host), never this code. The stream is first party and runs
// for every visitor; consent gates the ad tags alone, and nothing of theirs
// loads before the visitor allows it.

import { captureClick, readConsent, startTags, track as send, type Analytics as Stream } from '@hanzo/event'
import { AnalyticsProvider, useAnalytics, usePageview } from '@hanzo/event/react'
import { Consent } from '@hanzo/ui/consent'
import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router'

import { api } from '~/lib/api'

/** The sites one visit crosses, so GA4 keeps it one session across them. */
const DOMAINS = ['hanzo.market', 'hanzo.ai', 'pay.hanzo.ai', 'cal.hanzo.ai']

/** The funnel moment a click out to one of these places is: a host, or a host and a mounted path. */
const INTENT: Record<string, string> = {
  'hanzo.ai/pay': 'checkout_started',
  'pay.hanzo.ai': 'checkout_started',
  'cal.hanzo.ai': 'generate_lead',
}

let stream: Stream | undefined

/** One funnel moment, to our stream and every ad tag running, under one event_id. */
export function track(name: string, params: Record<string, unknown> = {}): void {
  send(stream, name, params)
}

/** `url` with the visitor on it when it leads to another Hanzo host, so the hop is one visitor. */
export function link(url: string): string {
  return stream ? stream.link(url) : url
}

/** `link` for an address this page is leaving for: the queue is sent before it goes. */
export function authorize(url: string): string {
  return stream ? stream.authorize(url) : url
}

function intent(href: string): string | undefined {
  const u = new URL(href, window.location.href)
  const at = u.host + u.pathname
  const key = Object.keys(INTENT).find((k) => at === k || at.startsWith(k + '/'))
  return key && INTENT[key]
}

/**
 * Binds the stream, counts each route, starts the tag manager, records the ad
 * click this page arrived on, carries the visitor on a link to another Hanzo
 * host, and sends the moment a click to a checkout or the sales calendar is.
 */
function Tags() {
  stream = useAnalytics()
  usePageview(useLocation().pathname)
  useEffect(() => startTags({ host: window.location.hostname, domains: DOMAINS }), [])
  useEffect(() => captureClick(readConsent()), [])
  useEffect(() => {
    const carry = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (a) a.href = link(a.href)
    }
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      const name = a ? intent(a.href) : undefined
      if (a && name) track(name, { link_url: a.href, page_path: window.location.pathname })
    }
    const on = ['pointerdown', 'click', 'contextmenu', 'keydown'] as const
    on.forEach((t) => document.addEventListener(t, carry, { capture: true }))
    document.addEventListener('click', click, { capture: true })
    return () => {
      on.forEach((t) => document.removeEventListener(t, carry, { capture: true }))
      document.removeEventListener('click', click, { capture: true })
    }
  }, [])
  return null
}

/**
 * Our stream runs for every visitor: it is first-party analytics. <Consent> is
 * @hanzo/ui's one banner, and its answer governs the ad tags alone (startTags).
 */
export function Analytics({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProvider config={{ product: 'market', host: api() }}>
      <Tags />
      <Consent />
      {children}
    </AnalyticsProvider>
  )
}
