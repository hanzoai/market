import { YStack } from '@hanzo/ui'
import { Outlet } from 'react-router'

import { Footer, Header } from '~/chrome'
import { SessionProvider } from '~/session'

/** Every screen sits under the session and the shared chrome. */
export function Root() {
  return (
    <SessionProvider>
      <YStack grow={1} minH="100dvh" bg="$background">
        <Header />
        <YStack grow={1} shrink={0} render="main">
          <Outlet />
        </YStack>
        <Footer />
      </YStack>
    </SessionProvider>
  )
}
