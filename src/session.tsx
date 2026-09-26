// Who is signed in, and the org they act as. hanzo.id is the only issuer and
// @hanzo/iam is the only client: `login()` is authorization-code + PKCE (S256)
// by top-level redirect, and the SDK owns the tokens. This file adds nothing to
// auth — it reads the session and names the org. Signed in is the SDK's word
// (a token that is valid or was refreshed), withdrawn the moment the gateway
// refuses it (401): a token merely left in storage is not a session.
//
// The org is the one this tab shows, and every request acts as exactly that org.
// A switch made in another tab is followed here: the screen re-keys to the new
// org (see Gate) before anything acts as it.

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { IamProvider, useIam } from '@hanzo/iam/react'

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

/** Where to land after the round trip to hanzo.id. */
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
  const { isLoading, isAuthenticated, accessToken, user, login, logout } = useIam()
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
        try {
          window.sessionStorage.setItem(RETURN, window.location.pathname + window.location.search)
        } catch {
          /* the round trip still lands on the home page */
        }
        void login()
      },
      signOut: () => void logout(),
    }
  }, [isLoading, isAuthenticated, accessToken, refused, user, picked, login, logout])

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
