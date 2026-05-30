import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

import { generateWellKnown } from './scripts/generate-well-known'

const require = createRequire(import.meta.url)

const BRAND_ID = (process.env.BRAND_ID ?? 'generic').trim() || 'generic'

// LP-0010 §4.1 — emits public/brand.json (legacy mashed shape, for loader.ts)
// AND public/.well-known/{brand,<appId>}.json (split shape, for federation).
generateWellKnown(BRAND_ID)

const convexEntry = require.resolve('convex')
const convexRoot = dirname(dirname(dirname(convexEntry)))
const convexReactPath = join(convexRoot, 'dist/esm/react/index.js')
const convexBrowserPath = join(convexRoot, 'dist/esm/browser/index.js')
const convexValuesPath = join(convexRoot, 'dist/esm/values/index.js')
const convexAuthReactPath = require.resolve('@convex-dev/auth/react')

function handleRollupWarning(
  warning: { code?: string; message: string; id?: string },
  warn: (warning: { code?: string; message: string; id?: string }) => void,
) {
  if (
    warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
    warning.id?.includes('node_modules') &&
    /use client/i.test(warning.message)
  ) {
    return
  }
  if (
    warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
    /@tanstack\/start-|@tanstack\/router-core\/ssr\/(client|server)/.test(warning.message)
  ) {
    return
  }
  if (warning.code === 'EMPTY_BUNDLE' || /Generated an empty chunk/i.test(warning.message)) {
    return
  }
  warn(warning)
}

const config = defineConfig({
  define: {
    __BUILD_BRAND_ID__: JSON.stringify(BRAND_ID),
  },
  resolve: {
    dedupe: ['convex', '@convex-dev/auth', 'react', 'react-dom'],
    alias: {
      'convex/react': convexReactPath,
      'convex/browser': convexBrowserPath,
      'convex/values': convexValuesPath,
      '@convex-dev/auth/react': convexAuthReactPath,
    },
  },
  optimizeDeps: {
    include: ['convex/react', 'convex/browser'],
  },
  plugins: [
    devtools(),
    nitro({
      serverDir: 'server',
      rollupConfig: {
        onwarn: handleRollupWarning,
      },
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      onwarn: handleRollupWarning,
    },
  },
})

export default config
