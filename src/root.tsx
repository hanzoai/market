import { YStack } from '@hanzo/ui'
import { Outlet } from 'react-router'

import { Analytics } from '~/analytics'
import { Footer, Header } from '~/chrome'
import { SessionProvider } from '~/session'

/** Every screen sits under our stream, the session and the shared chrome. */
export function Root() {
  return (
    <Analytics>
      <SessionProvider>
        <YStack grow={1} minH="100dvh" bg="$background">
          <Header />
          <YStack grow={1} shrink={0} render="main">
            <Outlet />
          </YStack>
          <Footer />
        </YStack>
      </SessionProvider>
    </Analytics>
  )
}
