import { Hono } from 'hono'
import { env } from '../lib/env.js'

/**
 * BFF for the canonical Hanzo Cloud agent store (api.hanzo.ai/v1/agents).
 *
 * There is exactly ONE agent store — the cloud. This router owns no state; it
 * forwards the caller's IAM bearer to the upstream so cloud mints X-Org-Id from
 * the verified token's `owner` claim and keeps per-org metering. We never send a
 * client-supplied X-Org-Id.
 *
 * Auth is enforced at the mount (`requireAuth` in index.ts) so only signed-in
 * users reach these handlers; the router itself is a pure pass-through.
 */
export const agentsRouter = new Hono()

// Agent names are the upstream path segment — guard against traversal / SSRF.
const AGENT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

function bearer(req: Request): string {
  return req.headers.get('Authorization') ?? ''
}

// ─── List agents ────────────────────────────────────────────────────────────
agentsRouter.get('/', async (c) => {
  const upstream = await fetch(`${env.upstreamUrl}/agents`, {
    headers: { Authorization: bearer(c.req.raw) },
  })
  const body = await upstream.text()
  return new Response(body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ─── Run an agent (real completion, metered upstream) ───────────────────────
agentsRouter.post('/:name/run', async (c) => {
  const name = c.req.param('name')
  if (!AGENT_NAME.test(name)) {
    return c.json({ error: 'Invalid agent name' }, 400)
  }

  const parsed = (await c.req.json().catch(() => ({}))) as { input?: unknown }

  const upstream = await fetch(`${env.upstreamUrl}/agents/${name}/run`, {
    method: 'POST',
    headers: {
      Authorization: bearer(c.req.raw),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: parsed.input ?? '' }),
  })
  const body = await upstream.text()
  return new Response(body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
})
