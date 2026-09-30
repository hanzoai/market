// Our stream, the ad tags and consent, all from @hanzo/event. Every event is a
// POST to api.hanzo.ai/v1/event under the publishable key below. Which ad tags
// load (GA4, the Meta Pixel) is the project's tag set in cloud
// (/v1/project/tags, asked with this host), never this code, and nothing loads
// before the visitor's consent allows it.

import { acceptAll, asks, captureClick, readConsent, rejectAll, startTags, track as send, type Analytics as Stream } from '@hanzo/event'
import { AnalyticsProvider, useAnalytics, useConsent, usePageview } from '@hanzo/event/react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'

import { api } from '~/lib/api'
import { Act } from '~/ui'

/**
 * The publishable key of Hanzo's site project, the one hanzo.ai ships: it files
 * our stream's events and names the tag set. Write-only and public by design.
 */
const KEY = 'pk-CmfLA2K6kvsPflrS9DSkt06H_kSoQB_21sjedt6VJdc'

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
  useEffect(() => startTags({ key: KEY, host: window.location.hostname, domains: DOMAINS }), [])
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

/** The consent question, asked only where the law asks it first: an opt-in visitor who has not chosen. */
function Consent() {
  const [open, setOpen] = useState(asks)
  if (!open) return null
  const choose = (all: boolean) => {
    if (all) acceptAll()
    else rejectAll()
    setOpen(false)
  }
  return (
    <YStack
      role="dialog"
      aria-label="Cookie preferences"
      position="fixed"
      b="$4"
      l="$4"
      r="$4"
      maxW={560}
      gap="$3"
      p="$4"
      rounded="$6"
      bg="$background"
      borderWidth={1}
      borderColor="$borderColor"
      z={1000}
    >
      <Text fontSize="$3" color="$ink">
        Hanzo uses cookies to measure this site and the ads that bring people to it. Allow them?
      </Text>
      <XStack gap="$2" justify="flex-end">
        <Act onPress={() => choose(false)}>Reject</Act>
        <Act loud onPress={() => choose(true)}>
          Accept
        </Act>
      </XStack>
    </YStack>
  )
}

/** Our stream runs while the visitor's consent allows Analytics, starting the moment they allow it. */
export function Analytics({ children }: { children: ReactNode }) {
  const consent = useConsent()
  return (
    <AnalyticsProvider config={{ product: 'market', host: api(), ingestKey: KEY, enabled: consent.analytics }}>
      <Tags />
      <Consent />
      {children}
    </AnalyticsProvider>
  )
}
