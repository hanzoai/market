/**
 * Where the session is kept, named once.
 *
 * @hanzo/iam owns these `hanzo_iam_`-prefixed keys and publishes no reader a
 * plain module can call, so the names are restated here and everything that
 * needs the bearer asks this file. Storage throws rather than answering null in
 * a browser that refuses it, so every access is guarded.
 */

const PREFIX = 'hanzo_iam_'
const ACCESS = `${PREFIX}access_token`

/** The org this browser works in: the SDK's own key, shared by every Hanzo surface. */
const CURRENT = `${PREFIX}current_org`

/** Who this browser's local state belongs to. */
const WHO = 'hanzo:who'

/** Per-person selections under the SDK prefix; the rest is the session itself. */
const CHOSEN = new Set([CURRENT, `${PREFIX}current_project`])

const kept = (key: string): boolean => key === WHO || (key.startsWith(PREFIX) && !CHOSEN.has(key))

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** The access token, or null. */
export function bearer(): string | null {
  try {
    return store()?.getItem(ACCESS) ?? null
  } catch {
    return null
  }
}

/** The claims the stored token carries, or null. The signature is the gateway's to check. */
export function claims(): Record<string, unknown> | null {
  const token = bearer()
  const part = token?.split('.')[1]
  if (!part) return null
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))) as Record<string, unknown>
  } catch {
    return null
  }
}

/** The subject the stored token names. */
export function subject(): string | undefined {
  const sub = claims()?.sub
  return typeof sub === 'string' && sub ? sub : undefined
}

/**
 * Bind this browser's selections to one person: when a different subject
 * arrives (or nobody — a sign-out), the last person's org choice goes before
 * anything reads it, so nobody buys or sells as a tenant that is not theirs.
 */
export function own(sub: string | undefined): void {
  const s = store()
  if (!s) return
  try {
    if (s.getItem(WHO) === (sub ?? null)) return
    // Through the Storage API, not Object.keys: that is what every Storage implements.
    const keys = Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => k !== null)
    for (const key of keys) if (key.startsWith('hanzo') && !kept(key)) s.removeItem(key)
    if (sub) s.setItem(WHO, sub)
    else s.removeItem(WHO)
  } catch {
    /* a browser that refuses storage kept nothing to remove */
  }
}

/**
 * The organizations the signed token lists, home first. The gateway acts in the
 * first unless `X-Org-Id` names another one from this same list.
 */
export function orgs(): string[] {
  const set = claims()?.orgs
  const out: string[] = []
  for (const ref of Array.isArray(set) ? set : []) {
    const o = typeof ref === 'string' ? ref : (ref as { org?: unknown } | null)?.org
    if (typeof o === 'string' && o && !out.includes(o)) out.push(o)
  }
  return out
}

/** The org this browser works in: the stored choice when the token lists it, else the home org. */
export function org(): string | null {
  const mine = orgs()
  try {
    const chosen = store()?.getItem(CURRENT)
    if (chosen && mine.includes(chosen)) return chosen
  } catch {
    /* fall through to the home org */
  }
  return mine[0] ?? null
}

/** Whether a storage change is to the org this browser works in (null: storage was cleared). */
export const choice = (key: string | null): boolean => key === null || key === CURRENT

/** The org this tab shows, once its session names it. */
let shown: string | null | undefined

/**
 * Fix the org this tab's requests act as to the one its screen shows. Storage is
 * shared by every tab, so another tab's switch would otherwise make this one act
 * as an org it is not showing.
 */
export function show(o: string | null): void {
  shown = o
}

/** The org a request acts as: the one this tab shows, or the stored choice before a session has named one. */
export function acting(): string | null {
  return shown === undefined ? org() : shown
}

/** Record the org this browser works in. Refuses one the token does not list. */
export function work(pick: string): boolean {
  if (!orgs().includes(pick)) return false
  try {
    store()?.setItem(CURRENT, pick)
    return true
  } catch {
    return false
  }
}
