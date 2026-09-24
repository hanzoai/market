import { Hanzo } from '@hanzo/ui'
// Zen, self-hosted: @hanzo/ui's theme names the family, this ships the faces.
import '@hanzo/font/css'
// @hanzo/design's tokens, the reset, and the glass surfaces.
import '@hanzo/ui/theme.css'
// The rules gui components assume (the min-width floor every grid child needs).
import '@hanzo/ui/styles/motion.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '~/app'

// The ambient gui telemetry client, off: it would build itself on first render
// and, with no ingest key here, report a refusal on every visit.
;(globalThis as Record<string, unknown>)['__HANZO_TELEMETRY__'] = { enabled: false }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Hanzo theme="dark">
      <App />
    </Hanzo>
  </StrictMode>,
)
