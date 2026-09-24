import { useEffect, useState } from 'react'
import { useIam } from '@hanzo/iam/react'
import { Text, YStack } from '@hanzo/ui'
import { useNavigate } from 'react-router'

import { destination } from '~/session'

/**
 * The return from hanzo.id. The SDK reads the code and state from the URL and
 * the PKCE verifier from storage, exchanges the code and stores the tokens; this
 * screen only decides where the reader lands. A failed exchange is shown, never
 * swallowed.
 */
export function Callback() {
  const go = useNavigate()
  const { handleCallback } = useIam()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    handleCallback()
      .then(() => {
        if (live) void go(destination(), { replace: true })
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
