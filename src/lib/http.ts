// One way to reach api.hanzo.ai. Every read and write in this storefront goes
// through `request`, which attaches the IAM bearer and the chosen org when there
// is a session, and turns a refusal into a `Refusal` carrying the platform's own
// sentence (RFC 9457 problem+json `detail`), and no answer at all into `Silence`.

import { api } from '~/lib/api'
import { acting, bearer } from '~/lib/token'

export class Refusal extends Error {
  readonly status: number
  readonly code: string | undefined
  /** The whole problem document, for a refusal that carries more than words (a 402's terms). */
  readonly problem: Record<string, unknown> | undefined

  constructor(status: number, message: string, code?: string, problem?: Record<string, unknown>) {
    super(message)
    this.name = 'Refusal'
    this.status = status
    this.code = code
    this.problem = problem
  }
}

/** No answer came back: the request failed on the way, so what the platform did with it is unknown. */
export class Silence extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Silence'
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
  const chosen = acting()
  if (token && chosen) h.set('X-Org-Id', chosen)
  return h
}

async function refusal(res: Response): Promise<Refusal> {
  const raw = await res.text().catch(() => '')
  try {
    const body = JSON.parse(raw) as Record<string, unknown>
    const said = [body.detail, body.error, body.title].find((v) => typeof v === 'string' && v.trim())
    return new Refusal(res.status, (said as string | undefined) ?? res.statusText, typeof body.code === 'string' ? body.code : undefined, body)
  } catch {
    return new Refusal(res.status, raw.trim().slice(0, 200) || res.statusText || `HTTP ${res.status}`)
  }
}

/**
 * Said on `window` when the gateway refuses the session this page holds (401): the
 * token is expired or revoked, so the reader is signed out, whatever storage says.
 */
export const LAPSED = 'market:lapsed'

async function send(call: Call): Promise<Response> {
  const h = headers(call)
  let res: Response
  try {
    res = await fetch(url(call.path, call.query), {
      method: call.method ?? 'GET',
      headers: h,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
    })
  } catch (e) {
    throw new Silence(`api.hanzo.ai did not answer: ${why(e)}`)
  }
  if (res.status === 401 && h.has('Authorization') && typeof window !== 'undefined') window.dispatchEvent(new Event(LAPSED))
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

/**
 * The failure left unknown what the platform did: no answer came back, or the
 * platform or its gateway failed (5xx), timed the request out (408) or throttled
 * it (429). A write that failed this way may have taken effect, so it is sent
 * again exactly as it was; any other refusal is the platform's answer.
 */
export const lost = (e: unknown): boolean =>
  e instanceof Silence || (e instanceof Refusal && (e.status >= 500 || e.status === 408 || e.status === 429))
