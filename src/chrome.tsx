// The shared Hanzo chrome: @hanzogui/shell's HanzoHeader and HanzoFooter, the
// same bar and footer hanzo.ai, hanzo.chat and hanzo.app wear. What is this
// surface's own is content — its nav and its one primary action.

import { HanzoFooter, HanzoHeader, type HanzoLink, type HanzoNav, type HanzoSurface } from '@hanzogui/shell'
import { useLocation } from 'react-router'

import { useSession } from '~/session'

const NAV: HanzoNav[] = [
  { id: 'agents', label: 'Agents', href: '/agents', glyph: 'bot', hint: 'Hire an agent for a job' },
  { id: 'apps', label: 'Apps', href: '/apps', glyph: 'blocks', hint: 'Apps built on Hanzo' },
  { id: 'skills', label: 'Skills', href: '/skills', glyph: 'spark', hint: 'Skills an agent can load' },
  { id: 'mcp', label: 'MCP servers', href: '/mcp', glyph: 'plug', hint: 'Tools over MCP' },
  {
    id: 'sell',
    label: 'Sell',
    href: '/sell',
    glyph: 'card',
    items: [
      { id: 'sell-setup', label: 'Set up', href: '/sell', glyph: 'user', hint: 'Identity, tax form, payout wallet' },
      { id: 'sell-listings', label: 'Listings', href: '/sell/listings', glyph: 'package', hint: 'What you offer' },
      { id: 'sell-jobs', label: 'Jobs', href: '/sell/jobs', glyph: 'layers', hint: 'Work in escrow' },
      { id: 'sell-earnings', label: 'Earnings', href: '/sell/earnings', glyph: 'pulse', hint: 'Payouts and 1099s' },
    ],
  },
]

/** The one filled control, as on every Hanzo site: sign in first, then on to pay. */
const TRY: HanzoLink = { id: 'try-hanzo', label: 'Try Hanzo', href: '/login' }

export const SURFACE: HanzoSurface = {
  id: 'market',
  host: 'hanzo.market',
  productId: 'market',
  brandName: 'Hanzo Market',
  localNav: NAV,
  primaryCTA: TRY,
  preFooter: { heading: 'Sell what you build', actions: [TRY] },
}

export function Header() {
  const session = useSession()
  const where = useLocation()
  const auth = session.loading
    ? undefined
    : {
        user: session.signedIn ? { name: session.name || 'Signed in', email: session.email ?? undefined } : null,
        onSignIn: session.signIn,
        onSignOut: session.signOut,
        items: [
          { id: 'my-jobs', label: 'Your jobs', href: '/jobs' },
          { id: 'my-listings', label: 'Your listings', href: '/sell/listings' },
        ],
      }
  return <HanzoHeader surface={SURFACE} auth={auth} currentHref={where.pathname + where.search} primaryLast />
}

export function Footer() {
  return <HanzoFooter currentProductId="market" />
}
