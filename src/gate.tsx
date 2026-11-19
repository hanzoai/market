// A screen that acts as an org: it needs a session. Signed out, it says why and
// offers the one way in. Signed in, the screen belongs to the org it acts as: a
// switch of org starts it afresh, so nothing one org typed, opened or was answered
// (a draft, a verification link, a payment in flight) is shown as another's.

import { Fragment, type ReactNode } from 'react'
import { Text, YStack } from '@hanzo/ui'

import { useSession } from '~/session'
import { Act } from '~/ui'

export function Gate({ why, children }: { why: string; children: ReactNode }) {
  const session = useSession()
  if (session.loading) return <YStack flex={1} minH={320} />
  if (!session.signedIn) {
    return (
      <YStack items="center" justify="center" gap="$3" p="$8" minH={320}>
        <Text render="h1" fontSize="$7" fontWeight="600" color="$ink">
          Sign in to continue
        </Text>
        <Text fontSize="$3" color="$soft" text="center" maxW={480}>
          {why}
        </Text>
        <Act loud onPress={session.signIn}>
          Try Hanzo
        </Act>
      </YStack>
    )
  }
  return <Fragment key={session.org ?? ''}>{children}</Fragment>
}
