import { Hanzo } from '@hanzo/ui'
// Zen, self-hosted: @hanzo/ui's theme names the family, this ships the faces.
import '@hanzo/font/css'
// @hanzo/design's tokens, the reset, and the glass surfaces.
import '@hanzo/ui/theme.css'
// The rules gui components assume (the min-width floor every grid child needs).
import '@hanzo/ui/styles/motion.css'
// The embedded sign-in card (@hanzo/ui/auth SignIn).
import '@hanzo/ui/auth.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '~/app'

// The ambient gui telemetry client, off: our one stream is src/analytics.tsx,
// and this one would send every page view a second time with no ingest key.
;(globalThis as Record<string, unknown>)['__HANZO_TELEMETRY__'] = { enabled: false }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Hanzo theme="dark">
      <App />
    </Hanzo>
  </StrictMode>,
)
