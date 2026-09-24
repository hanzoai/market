import { defineConfig, devices } from '@playwright/test'

/**
 * The flows run against the Vite dev server with api.hanzo.ai and hanzo.id
 * answered at the network layer (e2e/mock.ts). BASE_URL points the same specs at
 * a deployed storefront; there only the specs tagged @live run, read-only.
 */
const PORT = 4330
const live = process.env.BASE_URL

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  grep: live ? /@live/ : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: live ?? `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: live
    ? undefined
    : {
        command: `bunx vite --host 127.0.0.1 --port ${PORT} --strictPort`,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
