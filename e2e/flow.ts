import { expect, type Page } from '@playwright/test'

/** Sign in through the mocked hanzo.id round trip and wait to land back on `path`. */
export async function signIn(page: Page, path: string) {
  await page.getByRole('button', { name: 'Sign in with Hanzo' }).click()
  await page.waitForURL((u) => u.pathname + u.search === path)
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toHaveCount(0)
}
