import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
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

function copyBrandPreset() {
  const root = dirname(new URL(import.meta.url).pathname)
  const presetPath = resolvePath(root, 'src/brand/presets', `${BRAND_ID}.json`)
  if (!existsSync(presetPath) || !statSync(presetPath).isFile()) {
    throw new Error(
      `BRAND_ID=${BRAND_ID} but src/brand/presets/${BRAND_ID}.json not found. ` +
        `Create the preset or set BRAND_ID to one of the available presets.`,
    )
  }
  const dest = resolvePath(root, 'public/brand.json')
  copyFileSync(presetPath, dest)

  // Same source of truth: also publish the active brand at /.well-known/market.json
  // per IETF RFC 8615 so federated peers can discover this market.
  const wellKnownDir = resolvePath(root, 'public/.well-known')
  if (!existsSync(wellKnownDir)) mkdirSync(wellKnownDir, { recursive: true })
  copyFileSync(presetPath, resolvePath(wellKnownDir, 'market.json'))
}

copyBrandPreset()

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
    dedupe: ['react', 'react-dom'],
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
