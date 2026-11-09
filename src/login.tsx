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

import { useEffect, useState, type ReactNode } from 'react'
import { Choose } from '@hanzo/app/Choose'
import { useAccounts } from '@hanzo/app/lib/accounts'
import { useIam } from '@hanzo/iam/react'
import { Text, YStack } from '@hanzo/ui'
import { SignIn, type Mode } from '@hanzo/ui/auth'
import { useNavigate } from 'react-router'

import { authorize, track } from '~/analytics'
import { BAR } from '~/chrome'
import { keep, METHOD, usePick } from '~/pick'
import { destination, LOGIN, SIGNUP, useClient } from '~/session'

/** How long the page waits on IAM's answer about a session before it draws the form. */
const PATIENCE = 3000

/** The tab asked IAM for a session once already. */
const ASKED = 'signin.asked'

function unasked(): boolean {
  try {
    return !window.sessionStorage.getItem(ASKED)
  } catch {
    return false
  }
}

/**
 * The page area: at least the screen below the bar, the sign-in centred in it and
 * as tall as the card and its sign-up line need, so the footer follows them and
 * never overlaps.
 */
function Area({ children }: { children: ReactNode }) {
  return (
    <YStack grow={1} shrink={0} items="center" justify="center" minH={`calc(100dvh - ${BAR}px)`}>
      {children}
    </YStack>
  )
}

/** The card the chooser's rows sit in, as the sign-in's own. */
function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <YStack render="section" aria-label={label} width="100%" maxW={400} gap="$4" p="$6" mx="$4" rounded="$4" borderWidth={1} borderColor="$borderColor">
      {children}
    </YStack>
  )
}

/** What the address says the person came for: `from=logout` (just signed out) or `from=add` (another account). */
const arrived = (): string | null => new URLSearchParams(window.location.search).get('from')

export function Login({ mode = 'login' }: { mode?: Mode }) {
  const go = useNavigate()
  const { isLoading, isAuthenticated } = useIam()
  const iam = useClient()
  const pick = usePick()
  const [shown, setShown] = useState(false)
  // The sign-in form, asked for by the person ("Use another account") or by the menu's Add account.
  const [other, setOther] = useState(() => arrived() === 'add')
  // The accounts IAM holds for this browser: a stranger's list is empty and changes nothing.
  const known = useAccounts(mode === 'login' && !isAuthenticated)
  // Several accounts signed in here, or one the person just signed out of: they choose. Once the
  // chooser is drawn it stays while any account is left, so signing one out does not swap it for the form.
  const wants = known.accounts.length > 1 || (known.accounts.length > 0 && arrived() === 'logout')
  const [held, hold] = useState(false)
  useEffect(() => {
    if (wants) hold(true)
  }, [wants])
  const choosing = !other && known.accounts.length > 0 && (wants || held)

  useEffect(() => {
    if (isLoading) return undefined
    // Signed in already, the page is on its way back to where the sign-in was headed, unless the
    // person asked for another account: that is the form, with the session they hold kept.
    if (isAuthenticated && arrived() !== 'add') {
      void go(destination(), { replace: true })
      return undefined
    }
    if (!unasked() || arrived() === 'logout' || arrived() === 'add') {
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
      <Area>
        <Text fontSize="$3" color="$soft">
          One moment…
        </Text>
      </Area>
    )
  }
  if (choosing) {
    return (
      <Area>
        <Choose rows={known.accounts} listed known={known} onOther={() => setOther(true)} pick={pick} frame={Card} />
      </Area>
    )
  }
  return (
    <Area>
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
    </Area>
  )
}
