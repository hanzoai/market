// One way to reach api.hanzo.ai. Every read and write in this storefront goes
// through `request`, which attaches the IAM bearer and the chosen org when there
// is a session, and turns a refusal into a `Refusal` carrying the platform's own
// sentence (RFC 9457 problem+json `detail`).

import { api } from '~/lib/api'
import { bearer, org } from '~/lib/token'

export class Refusal extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'Refusal'
    this.status = status
    this.code = code
  }
}

export type Query = Record<string, string | number | boolean | undefined | null>

export interface Call {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  query?: Query
  body?: unknown
  /** Send no credential even when signed in (public reads). */
  anonymous?: boolean
}

export function url(path: string, query?: Query): string {
  const u = new URL(path, `${api()}/`)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === '') continue
    u.searchParams.set(k, String(v))
  }
  return u.toString()
}

function headers(call: Call): Headers {
  const h = new Headers({ Accept: 'application/json' })
  if (call.body !== undefined) h.set('Content-Type', 'application/json')
  if (call.anonymous) return h
  const token = bearer()
  if (token) h.set('Authorization', `Bearer ${token}`)
  const chosen = org()
  if (token && chosen) h.set('X-Org-Id', chosen)
  return h
}

async function refusal(res: Response): Promise<Refusal> {
  const raw = await res.text().catch(() => '')
  try {
    const body = JSON.parse(raw) as { detail?: unknown; title?: unknown; error?: unknown; code?: unknown }
    const said = [body.detail, body.error, body.title].find((v) => typeof v === 'string' && v.trim())
    return new Refusal(res.status, (said as string | undefined) ?? res.statusText, typeof body.code === 'string' ? body.code : undefined)
  } catch {
    return new Refusal(res.status, raw.trim().slice(0, 200) || res.statusText || `HTTP ${res.status}`)
  }
}

async function send(call: Call): Promise<Response> {
  const res = await fetch(url(call.path, call.query), {
    method: call.method ?? 'GET',
    headers: headers(call),
    body: call.body === undefined ? undefined : JSON.stringify(call.body),
  })
  if (!res.ok) throw await refusal(res)
  return res
}

/** A JSON answer. 204 answers `undefined`. */
export async function request<T>(call: Call): Promise<T> {
  const res = await send(call)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** A text answer (SKILL.md). */
export async function text(call: Call): Promise<string> {
  return (await send(call)).text()
}

/** A binary answer (a 1099 PDF). */
export async function blob(call: Call): Promise<Blob> {
  return (await send(call)).blob()
}

/** The sentence to show for a failure. */
export function why(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

/**
 * The platform does not answer this operation yet (it is specified and being
 * built in cloud). The storefront says so instead of pretending.
 */
export const notServed = (status: number | null): boolean => status === 404 || status === 405 || status === 501

/** The operation needs a signed-in principal. */
export const needsSession = (status: number | null): boolean => status === 401 || status === 403

export const unbuilt = (e: unknown): boolean => e instanceof Refusal && notServed(e.status)

export const unsigned = (e: unknown): boolean => e instanceof Refusal && needsSession(e.status)
