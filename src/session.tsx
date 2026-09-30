// Who is signed in, and the org they act as. hanzo.id is the only issuer and
// @hanzo/iam is the only client, but nobody is sent there: a person signs in on
// this site's own /login (src/login.tsx), whose credential calls this origin
// answers, and the SDK owns the tokens the callback exchanges for. This file
// reads the session and names the org. Signed in is the SDK's word (a token
// that is valid or was refreshed), withdrawn the moment the gateway refuses it
// (401): a token merely left in storage is not a session.
//
// The org is the one this tab shows, and every request acts as exactly that org.
// A switch made in another tab is followed here: the screen re-keys to the new
// org (see Gate) before anything acts as it.

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { IAM } from '@hanzo/iam'
import { IamProvider, useIam } from '@hanzo/iam/react'
import { useSignOut } from '@hanzo/ui/auth'
import { useNavigate } from 'react-router'

import { track } from '~/analytics'
import { iam } from '~/lib/api'
import { LAPSED } from '~/lib/http'
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

/** This site's sign-in and sign-up pages. */
export const LOGIN = '/login'
export const SIGNUP = '/signup'

/** The IAM client for this page, posting its credential and sign-out calls to this origin. */
export function useClient(): IAM {
  const { config } = useIam()
  return useMemo(() => new IAM({ ...config, proxyBaseUrl: window.location.origin }), [config])
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
  const { isLoading, isAuthenticated, accessToken, user } = useIam()
  const go = useNavigate()
  const client = useClient()
  const out = useSignOut({ to: `${LOGIN}?from=logout`, track })
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
        const here = window.location.pathname
        if (here !== LOGIN && here !== SIGNUP) {
          try {
            window.sessionStorage.setItem(RETURN, here + window.location.search)
          } catch {
            /* the sign-in still lands on the home page */
          }
        }
        void go(LOGIN)
      },
      signOut: () => void client.end().then(out),
    }
  }, [isLoading, isAuthenticated, accessToken, refused, user, picked, go, client, out])

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
