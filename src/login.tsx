// /login and /signup: the way in, which is hanzo.ai's. This site types no
// credential and draws no account chooser: each page leaves at once for
// hanzo.ai's own (/login, /signup) with this site's authorize request
// (`useLeave`), and hanzo.ai signs the person in, or spends the session it
// holds, and sends the code back to /auth/callback. Every way in on this site
// (the bar's Try Hanzo, a gate's, a listing's) comes through here; the rest of
// the site stays public and is browsed signed out. Signed in already, the page
// goes on to where the sign-in was headed instead.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useIam } from '@hanzo/iam/react'
import { Text, YStack } from '@hanzo/ui'
import { useNavigate } from 'react-router'

import { BAR } from '~/chrome'
import { destination, useLeave } from '~/session'

/** The page area: at least the screen below the bar, what it says centred in it, so the footer follows and never overlaps. */
function Area({ children }: { children: ReactNode }) {
  return (
    <YStack grow={1} shrink={0} items="center" justify="center" gap="$2" p="$8" minH={`calc(100dvh - ${BAR}px)`}>
      {children}
    </YStack>
  )
}

export function Login({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const go = useNavigate()
  const { isLoading, isAuthenticated } = useIam()
  const leave = useLeave()
  const [failed, setFailed] = useState<string | null>(null)
  // Once per page: the page leaves, and where a signed-in reader lands is read once.
  const started = useRef(false)

  useEffect(() => {
    if (isLoading || started.current) return
    started.current = true
    if (isAuthenticated) {
      void go(destination(), { replace: true })
      return
    }
    // The SDK refuses to start a sign-in whose verifier this browser cannot keep; that is said, not swallowed.
    leave(mode).catch((e: unknown) => setFailed(e instanceof Error ? e.message : 'Sign-in could not start'))
  }, [isLoading, isAuthenticated, mode, leave, go])

  return (
    <Area>
      <Text fontSize="$3" color={failed ? '$ink' : '$soft'} role={failed ? 'alert' : undefined}>
        {failed ?? 'One moment…'}
      </Text>
    </Area>
  )
}
