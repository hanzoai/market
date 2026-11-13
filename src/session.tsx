// Who is signed in, and the org they act as. hanzo.id is the only issuer and
// @hanzo/iam is the only client. This site is its own OAuth client (hanzo-market)
// but signs nobody in itself: a person signs in on hanzo.ai's page, which this
// site leaves for with its own authorize request (`useLeave`), and hanzo.ai sends
// the code back to /auth/callback, where the SDK exchanges it and keeps the
// tokens. This site holds no IAM session cookie of its own. This file reads the
// session and names the org. Signed in is the SDK's word (a token that is valid
// or was refreshed), withdrawn the moment the gateway refuses it (401): a token
// merely left in storage is not a session.
//
// The org is the one this tab shows, and every request acts as exactly that org.
// A switch made in another tab is followed here: the screen re-keys to the new
// org (see Gate) before anything acts as it.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { IamProvider, useIam } from '@hanzo/iam/react'
import { useSignOut } from '@hanzo/ui/auth'
import { useNavigate } from 'react-router'

import { authorize, track } from '~/analytics'
import { iam, signin, signout } from '~/lib/api'
import { LAPSED } from '~/lib/http'
import { due, REASK, revoked, silent, spend } from '~/lib/silent'
import { choice, org as chosenOrg, orgs as tokenOrgs, own, show, subject, work } from '~/lib/token'

export interface Session {
  loading: boolean
  signedIn: boolean
  name: string
  email: string | null
  /** The org every read and write acts as. */
  org: string | null
  orgs: string[]
  choose: (org: string) => void
  signIn: () => void
  signOut: () => void
}

const Ctx = createContext<Session | null>(null)

const RETURN = 'market:return'

/** This site's sign-in and sign-up addresses: each leaves for hanzo.ai's own (src/login.tsx). */
export const LOGIN = '/login'
export const SIGNUP = '/signup'

/**
 * Leave for hanzo.ai's sign-in (or sign-up) with this site's OWN authorize
 * request: the SDK builds it and keeps the PKCE verifier and state in this
 * site's storage, and hanzo.ai's page finishes it, so the code comes back to
 * this site's /auth/callback. `prompt` asks hanzo.ai something of the sign-in:
 * `select_account` draws hanzo.ai's account chooser (where another account is
 * also added) instead of spending its session at once. A provider already
 * chosen (`?provider=` on this page) rides along, so hanzo.ai starts that
 * provider's hop instead of asking again. The address carries the visitor, so
 * the hop is one visit (`authorize`).
 */
export function useLeave(): (mode: 'login' | 'signup', prompt?: string) => Promise<void> {
  const { sdk } = useIam()
  return useCallback(
    async (mode: 'login' | 'signup', prompt?: string) => {
      const request = new URL(await sdk.getSigninUrl(prompt ? { additionalParams: { prompt } } : undefined))
      const via = new URLSearchParams(window.location.search).get('provider')
      if (via) request.searchParams.set('provider', via)
      window.location.replace(authorize(signin(request.href, mode)))
    },
    [sdk],
  )
}

/** Write the page down, so a sign-in that follows (the first, or another account's) comes back to it. */
export function remember(): void {
  const here = window.location.pathname
  if (here === LOGIN || here === SIGNUP) return
  try {
    window.sessionStorage.setItem(RETURN, here + window.location.search)
  } catch {
    /* the sign-in still lands on the home page */
  }
}

/** Where to land once signed in: the page the sign-in started from. */
export function destination(): string {
  try {
    const to = window.sessionStorage.getItem(RETURN)
    window.sessionStorage.removeItem(RETURN)
    return to && to.startsWith('/') && !to.startsWith('//') ? to : '/'
  } catch {
    return '/'
  }
}

function Bind({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, accessToken, user, sdk } = useIam()
  const go = useNavigate()
  // Sign-out: both tokens handed back and the end-session call made on this
  // origin, as before (a session cookie a sign-in here once left ends with it),
  // the local session cleared, and then the browser goes to hanzo.id's
  // end-session (`signout`), which ends the session on hanzo.ai and hanzo.id with
  // every Hanzo app's grant and returns it to this site's home page, a public
  // page, not a sign-in. A local page lands on its own home page instead.
  const out = useSignOut({ to: signout(window.location.origin), track })
  const [picked, setPicked] = useState<string | null>(() => chosenOrg())
  // The token the gateway refused; a new one (a refresh, a sign-in) is a new session.
  const [refused, setRefused] = useState<string | null>(null)

  useEffect(() => {
    const lapse = () => setRefused(accessToken ?? '')
    window.addEventListener(LAPSED, lapse)
    return () => window.removeEventListener(LAPSED, lapse)
  }, [accessToken])

  useEffect(() => {
    if (isLoading) return
    own(subject())
    setPicked(chosenOrg())
  }, [isLoading, isAuthenticated])

  // SIGNED IN ON ANOTHER HANZO SITE IS SIGNED IN HERE (~/lib/silent). A tab with no
  // tokens asks hanzo.ai, with no page, on a page it opens and again when it is
  // looked at, at most once a minute, and never from a page the reader has typed
  // into, which leaving would lose. Not from the sign-in pages or the callback,
  // which make or finish their own.
  useEffect(() => {
    if (isLoading || isAuthenticated) return undefined
    const { pathname } = window.location
    if (pathname.startsWith('/auth/') || pathname === LOGIN || pathname === SIGNUP) return undefined
    const ask = () => {
      spend()
      remember()
      void sdk.getSigninUrl({ additionalParams: { prompt: 'none' } }).then(
        (request) => window.location.replace(authorize(silent(request))),
        () => undefined,
      )
    }
    if (due()) {
      ask()
      return undefined
    }
    let typed = false
    const type = () => {
      typed = true
    }
    const seen = () => {
      if (document.visibilityState === 'visible' && !typed && due()) ask()
    }
    document.addEventListener('input', type, true)
    document.addEventListener('visibilitychange', seen)
    return () => {
      document.removeEventListener('input', type, true)
      document.removeEventListener('visibilitychange', seen)
    }
  }, [isLoading, isAuthenticated, sdk])

  // A SIGN-OUT ON ANY HANZO SITE SIGNS THIS ONE OUT. Leaving any first-party site
  // retires the person's grant to all of them (hanzoai/iam `revokeShared`,
  // IAM_SIGNOUT_APPS), and IAM's userinfo then answers this site's token 401, while
  // the token itself would pass for its seven days. It is asked where the SDK's own
  // read came back empty, and again when the tab is looked at after a minute or
  // more; a 401 drops the tokens and the page reloads signed out. A network fault or
  // a 5xx signs nobody out.
  useEffect(() => {
    if (isLoading || !isAuthenticated) return undefined
    let last = user ? Date.now() : 0
    const check = () => {
      last = Date.now()
      void sdk.getUserInfo().catch((e: unknown) => {
        if (!revoked(e)) return
        sdk.clearTokens()
        spend()
        window.location.reload()
      })
    }
    if (!user) check()
    const seen = () => {
      if (document.visibilityState === 'visible' && Date.now() - last >= REASK) check()
    }
    document.addEventListener('visibilitychange', seen)
    return () => document.removeEventListener('visibilitychange', seen)
  }, [isLoading, isAuthenticated, user, sdk])

  // Another tab chose another org: this one follows, rather than show one org and act as another.
  useEffect(() => {
    const follow = (e: StorageEvent) => {
      if (choice(e.key)) setPicked(chosenOrg())
    }
    window.addEventListener('storage', follow)
    return () => window.removeEventListener('storage', follow)
  }, [])

  // Before any screen's reads run (they are passive effects), requests act as the org shown.
  useLayoutEffect(() => show(picked), [picked])

  const session = useMemo<Session>(() => {
    const u = (user ?? null) as { displayName?: string; name?: string; email?: string } | null
    const email = u?.email ?? null
    return {
      loading: isLoading,
      signedIn: isAuthenticated && refused !== (accessToken ?? ''),
      name: u?.displayName || u?.name || (email ? email.split('@')[0] : ''),
      email,
      org: picked,
      orgs: tokenOrgs(),
      choose: (pick) => {
        if (work(pick)) setPicked(pick)
      },
      signIn: () => {
        remember()
        void go(LOGIN)
      },
      // The page a sign-out lands on asks hanzo.ai nothing for a minute (~/lib/silent).
      signOut: () => {
        spend()
        void out()
      },
    }
  }, [isLoading, isAuthenticated, accessToken, refused, user, picked, go, out])

  return <Ctx.Provider value={session}>{children}</Ctx.Provider>
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Before anything reads storage: a browser someone else left signed in is
  // emptied of their org choice.
  own(subject())
  const config = useMemo(() => ({ ...iam(), postLogoutRedirectUri: `${window.location.origin}/` }), [])
  return (
    <IamProvider config={config}>
      <Bind>{children}</Bind>
    </IamProvider>
  )
}

export function useSession(): Session {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession must be used within SessionProvider')
  return s
}
