import { hanzo } from '@hanzo/vite'
import react from '@vitejs/plugin-react'

/**
 * hanzo.market is a static storefront: `vite build` writes dist/, and the sites
 * plane serves it. There is no server in this repo — every read and write goes
 * to api.hanzo.ai.
 *
 * `hanzo()` resolves the Hanzo runtime (react-native-web, web-first extensions,
 * one copy of gui) the same way every Hanzo Vite app does.
 */
const API = 'https://api.hanzo.ai'

/**
 * Same-origin in front of the gateway on the dev server and on a preview of a
 * build. api.hanzo.ai admits an origin by allowlist; a localhost port is not on
 * it, so a local page asks its own origin and this proxy forwards. The skills
 * directory is served from the gateway's /.well-known, so it is proxied too.
 */
const proxy = {
  '/v1': { target: API, changeOrigin: true },
  '/.well-known/agent-skills': { target: API, changeOrigin: true },
}

/**
 * Pinned because it is half of a redirect: IAM returns the browser to the exact
 * `redirect_uri` registered for the hanzo-market client, port included.
 */
const PORT = 3330

/**
 * The sites plane serves `index.html` for any page-shaped path (spaMode), and a
 * static host without that answers the site's `404.html`. Writing the document
 * under both names makes every deep link land on the app either way.
 */
const spaFallback = {
  name: 'spa-fallback',
  async writeBundle(options: { dir?: string }) {
    const { copyFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const dir = options.dir ?? 'dist'
    await copyFile(join(dir, 'index.html'), join(dir, '404.html'))
  },
}

const config = hanzo(
  {
    plugins: [react(), spaFallback],
    server: { port: PORT, allowedHosts: true, proxy },
    preview: { port: PORT, allowedHosts: true, proxy },
  },
  {
    root: import.meta.dirname,
    // One copy of the theme: the theme and config contexts live in
    // @hanzogui/core, a layer below what `hanzo()` dedupes.
    dedupe: ['@hanzogui/core', '@hanzogui/web', '@hanzogui/portal', '@hanzogui/toast'],
  },
)

/**
 * Dependency optimization is a second resolution pass and inherits none of the
 * first, so it is told the same extensions: a react-native package's `.web.js`
 * sibling comes first. The dev runtime `hanzo()` injects is named up front: the
 * scanner cannot see an import a transform adds, and finding it mid-session
 * re-bundles and reloads every open page.
 */
export default {
  ...config,
  optimizeDeps: {
    include: ['@hanzo/source/client', '@hanzo/source/jsx-dev-runtime', 'react/jsx-dev-runtime'],
    rollupOptions: {
      resolve: { extensions: (config.resolve as { extensions: string[] }).extensions },
    },
  },
}
