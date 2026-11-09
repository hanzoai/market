import { expect, test, type Page } from '@playwright/test'

import { mock, world } from './mock'

/** The shell's bar, and the three widths the storefront is held to. */
const BAR = 60
const SCREENS = [
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]
const SCHEMES = ['light', 'dark'] as const

/** What the page measures of the sign-in: the card, its sign-up line, the page area and the footer. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) throw new Error('the sign-in is not drawn')
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    }
    const link = [...document.querySelectorAll('a')].find((a) => a.textContent === 'Create an account') ?? null
    const line = link?.parentElement ?? null
    const centre = link ? link.getBoundingClientRect() : null
    const hit = centre ? document.elementFromPoint(centre.left + centre.width / 2, centre.top + centre.height / 2) : null
    // A first visit is asked about cookies by a banner fixed over the screen's foot: it covers the page, never the footer.
    return {
      card: box(document.querySelector('section[aria-label="Log in"] > *')),
      line: box(line),
      area: box(document.querySelector('main > *')),
      footer: box(document.querySelector('footer')),
      underFooter: Boolean(hit && document.querySelector('footer')?.contains(hit)),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  })
}

for (const screen of SCREENS) {
  for (const scheme of SCHEMES) {
    test(`@live /login at ${screen.width} ${scheme}: the sign-up line is whole above the footer and the card is centred`, async ({ page }) => {
      await page.setViewportSize(screen)
      await page.emulateMedia({ colorScheme: scheme })
      if (!process.env.BASE_URL) await mock(page, world())
      await page.goto('/login?from=logout')
      await expect(page.getByRole('heading', { name: 'Log in to Hanzo Market', level: 1 })).toBeVisible()
      await expect(page.getByText('New to Hanzo Market?')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible()

      const m = await measure(page)
      // The sign-up line is whole, on screen across, and the footer is not drawn over it.
      expect(m.underFooter).toBe(false)
      expect(m.line.left).toBeGreaterThanOrEqual(0)
      expect(m.line.right).toBeLessThanOrEqual(screen.width)
      // The page area is at least the screen below the bar, and the footer starts where it ends.
      expect(m.area.top).toBeCloseTo(BAR, 0)
      expect(m.area.bottom - m.area.top).toBeGreaterThanOrEqual(screen.height - BAR - 1)
      expect(m.footer.top).toBeGreaterThanOrEqual(m.area.bottom - 1)
      expect(m.line.bottom).toBeLessThanOrEqual(m.area.bottom)
      expect(m.line.bottom).toBeLessThanOrEqual(m.footer.top)
      // The card is centred across the page and in the area, with room above it.
      expect(Math.abs((m.card.left + m.card.right) / 2 - screen.width / 2)).toBeLessThanOrEqual(1)
      const above = m.card.top - m.area.top
      const below = m.area.bottom - m.line.bottom
      expect(above).toBeGreaterThanOrEqual(48)
      expect(Math.abs(above - below)).toBeLessThanOrEqual(24)
      expect(m.overflow).toBeLessThanOrEqual(0)
    })
  }
}
