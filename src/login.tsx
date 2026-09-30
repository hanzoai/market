// Signing in on this site's own page, /login and /signup. IAM's credential and
// sign-out routes are answered on this origin (hanzoai/universe static-sites
// `iam-on-hanzo-ai`; the dev server's /v1 proxy locally), which is also where IAM
// keeps its session cookie. Nobody is sent to hanzo.id.
//
//   signed in       on to where the sign-in was headed
//   not asked yet   IAM is asked first, with no credential and no navigation
//                   (@hanzo/iam `resume`): a session on this origin signs the
//                   reader in with nothing typed. Skipped after a sign-out.
//   otherwise       @hanzo/ui/auth `SignIn`: IAM checks the password or the
//                   code and mints the code the callback exchanges.

import { useEffect, useState } from 'react'
import { useIam } from '@hanzo/iam/react'
import { Text, YStack } from '@hanzo/ui'
import { SignIn, type Mode } from '@hanzo/ui/auth'
import { useNavigate } from 'react-router'

import { authorize, track } from '~/analytics'
import { destination, LOGIN, SIGNUP, useClient } from '~/session'

/** How long the page waits on IAM's answer about a session before it draws the form. */
const PATIENCE = 3000

/** The tab asked IAM for a session once already. */
const ASKED = 'signin.asked'

/** The way in the person chose, carried to the callback. */
const METHOD = 'signin.method'

function keep(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    /* a tab that keeps nothing asks again and reports no method */
  }
}

function unasked(): boolean {
  try {
    return !window.sessionStorage.getItem(ASKED)
  } catch {
    return false
  }
}

/** Read-once: the way in, or undefined. */
export function takeMethod(): string | undefined {
  try {
    const m = window.sessionStorage.getItem(METHOD) ?? undefined
    window.sessionStorage.removeItem(METHOD)
    return m
  } catch {
    return undefined
  }
}

export function Login({ mode = 'login' }: { mode?: Mode }) {
  const go = useNavigate()
  const { isLoading, isAuthenticated } = useIam()
  const iam = useClient()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (isLoading) return undefined
    if (isAuthenticated) {
      void go(destination(), { replace: true })
      return undefined
    }
    if (!unasked() || new URLSearchParams(window.location.search).get('from') === 'logout') {
      setShown(true)
      return undefined
    }
    keep(ASKED, '1')
    let over = false
    const late = window.setTimeout(() => {
      over = true
      setShown(true)
    }, PATIENCE)
    void iam.resume().then((next) => {
      if (over) return
      window.clearTimeout(late)
      if (!next) {
        setShown(true)
        return
      }
      keep(METHOD, 'session')
      window.location.replace(authorize(next))
    })
    return () => window.clearTimeout(late)
  }, [isLoading, isAuthenticated, iam, go])

  if (!shown) {
    return (
      <YStack flex={1} items="center" justify="center" p="$8" minH={320}>
        <Text fontSize="$3" color="$soft">
          One moment…
        </Text>
      </YStack>
    )
  }
  return (
    <YStack flex={1} items="center" justify="center" p="$6" minH={480}>
      <SignIn
        mode={mode}
        site="Hanzo Market"
        loginPath={LOGIN}
        signupPath={SIGNUP}
        termsPath="https://hanzo.ai/terms"
        privacyPath="https://hanzo.ai/privacy"
        track={track}
        authorize={authorize}
        onMethod={(method) => keep(METHOD, method)}
      />
    </YStack>
  )
}
