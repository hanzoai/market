import { useEffect, useState } from 'react'
import { useIam } from '@hanzo/iam/react'
import { Text, YStack } from '@hanzo/ui'
import { useNavigate } from 'react-router'

import { track } from '~/analytics'
import { back, returned } from '~/lib/linked'
import { settle } from '~/lib/silent'
import { destination } from '~/session'

/**
 * The return from the sign-in on hanzo.ai, and from connecting a provider to the
 * account (`~/lib/linked`): that one brings no code, so it goes back to the page
 * it left, carrying IAM's reason when it refused.
 *
 * The return from the sign-in on hanzo.ai, which this site left for with its own
 * authorize request (`useLeave`). The SDK reads the code and state from the URL
 * and the PKCE verifier from this site's storage, exchanges the code and stores
 * the tokens; this screen counts login_completed and decides where the reader
 * lands. The way in was chosen on hanzo.ai, which counts it there. A failed
 * exchange is shown, never swallowed.
 *
 * And the return from this tab's silent ask (`~/lib/silent`): a code is
 * exchanged the same way and counted as a sign-in by the session hanzo.ai held;
 * IAM's word that nobody is signed in there (`login_required` and its kin, for
 * this tab's own ask alone) goes back to the page the ask left, saying nothing.
 */
export function Callback() {
  const go = useNavigate()
  const { handleCallback } = useIam()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const connect = returned(window.location.search)
    if (connect) {
      // The page that asked says what IAM said.
      void go(back(), { replace: true, state: 'refused' in connect ? { refused: connect.refused } : undefined })
      return undefined
    }
    const ask = settle(window.location.search)
    if (ask === 'refused') {
      void go(destination(), { replace: true })
      return undefined
    }
    handleCallback()
      .then(() => {
        if (!live) return
        track('login_completed', ask === 'answered' ? { method: 'session' } : {})
        void go(destination(), { replace: true })
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : 'Sign-in failed')
      })
    return () => {
      live = false
    }
  }, [handleCallback, go])

  return (
    <YStack flex={1} items="center" justify="center" gap="$2" p="$8" minH={320}>
      <Text fontSize="$5" color="$ink" role={error ? 'alert' : undefined}>
        {error ?? 'Completing sign-in…'}
      </Text>
      <Text fontSize="$2" color="$soft">
        {error ? 'Try signing in again.' : 'One moment.'}
      </Text>
    </YStack>
  )
}
