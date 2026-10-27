import { YStack } from '@hanzo/ui'
import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'

import { Analytics } from '~/analytics'
import { Footer, Header } from '~/chrome'
import { ABOUT, NAME, SITE, twin } from '~/lib/pages'
import { SessionProvider } from '~/session'

/**
 * A prerendered page's head names that page. Once the app moves to another, the
 * head names the one shown: the title and description fall back to the site's,
 * canonical and the Markdown twin follow the path, and the first page's JSON-LD
 * and robots rule go.
 */
function useHead() {
  const { pathname } = useLocation()
  const landed = useRef(pathname)
  useEffect(() => {
    if (pathname === landed.current) return
    landed.current = ''
    const path = pathname.replace(/\/+$/, '') || '/'
    document.title = NAME
    document.querySelector('meta[name="description"]')?.setAttribute('content', ABOUT)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', SITE + path)
    document.querySelector('link[rel="alternate"][type="text/markdown"]')?.setAttribute('href', twin(path))
    for (const el of document.querySelectorAll('script[type="application/ld+json"], meta[name="robots"]')) el.remove()
  }, [pathname])
}

/** Every screen sits under our stream, the session and the shared chrome. */
export function Root() {
  useHead()
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
