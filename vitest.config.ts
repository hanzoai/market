import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'

import app from './vite.config'

export default mergeConfig(
  app,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/lib/**/*.ts'],
        exclude: ['src/lib/**/*.test.ts'],
        thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      },
    },
  }),
)
