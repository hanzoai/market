import { expect, test, type Page } from '@playwright/test'

import { departures, signIn } from './flow'
import { mock, world } from './mock'

// /login and /signup are hanzo.ai's: each leaves at once for hanzo.ai's own page
// with this site's authorize request and draws nothing to type. hanzo.ai's pages
// are refused (`departures`), so these run against a deployed storefront too.

/** The shell's bar, and the three widths the storefront is held to. */
const BAR = 60
const SCREENS = [
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]

/** The page leaves for hanzo.ai: the first address it left for. */
async function leaving(page: Page, path: string): Promise<URL> {
  if (!process.env.BASE_URL) await mock(page, world())
  const left = await departures(page)
  await page.goto(path)
  await expect.poll(() => left.length, { message: 'the browser never left for hanzo.ai' }).toBeGreaterThan(0)
  return left[0]
}

for (const path of ['/login', '/signup']) {
  test(`@live ${path} leaves for hanzo.ai${path} with this site’s own request, and nothing is typed here`, async ({ page }) => {
    const to = await leaving(page, path)
    expect(to.origin + to.pathname).toBe(`https://hanzo.ai${path}`)
    expect(to.searchParams.get('client_id')).toBe('hanzo-market')
    expect(to.searchParams.get('response_type')).toBe('code')
    expect(to.searchParams.get('redirect_uri')).toBe(`${new URL(page.url()).origin}/auth/callback`)
    expect(to.searchParams.get('code_challenge_method')).toBe('S256')
    expect(to.searchParams.get('code_challenge')).toBeTruthy()
    expect(to.searchParams.get('state')).toBeTruthy()
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveCount(0)
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })
}

test('@live a provider already chosen rides along to hanzo.ai', async ({ page }) => {
  const to = await leaving(page, '/login?provider=github')
  expect(to.searchParams.get('provider')).toBe('github')
  expect(to.searchParams.get('client_id')).toBe('hanzo-market')
})

test('signed in already, /login goes on to where the sign-in was headed and leaves for nowhere', async ({ page }) => {
  await mock(page, world())
  await page.goto('/sell')
  await signIn(page, '/sell')
  const left = await departures(page)
  await page.goto('/login')
  await page.waitForURL((u) => u.pathname === '/')
  expect(left).toEqual([])
})

for (const screen of SCREENS) {
  test(`@live /login at ${screen.width}: while it leaves, the page fills the screen under the bar, the footer follows, and nothing overflows`, async ({ page }) => {
    await page.setViewportSize(screen)
    await leaving(page, '/login')
    await expect(page.getByText('One moment…')).toBeVisible()
    const m = await page.evaluate(() => {
      const box = (el: Element | null) => {
        if (!el) throw new Error('not drawn')
        const r = el.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
      }
      return {
        area: box(document.querySelector('main > *')),
        footer: box(document.querySelector('footer')),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    })
    expect(m.area.top).toBeCloseTo(BAR, 0)
    expect(m.area.bottom - m.area.top).toBeGreaterThanOrEqual(screen.height - BAR - 1)
    expect(m.footer.top).toBeGreaterThanOrEqual(m.area.bottom - 1)
    expect(m.overflow).toBeLessThanOrEqual(0)
  })
}
