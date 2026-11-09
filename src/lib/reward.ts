// The rewards program, as the market uses it: a member chooses whether their level
// and badges are public (`GET`/`PUT /v1/reward/me/profile`), and what the program
// shows of a public one rides on the expert's row (`expert.reward`, see
// `~/lib/market` `Standing`). Private is the default and the platform keeps it:
// this file never reads another member's standing.

import { notServed, Refusal, request, Silence } from '~/lib/http'

export interface Own {
  handle: string
  public: boolean
  links: { github?: string; x?: string; website?: string }
}

/** The program's five pillars, in its order, with the word each is shown as. */
export const PILLARS = [
  { id: 'use', label: 'Use' },
  { id: 'share', label: 'Share' },
  { id: 'community', label: 'Community' },
  { id: 'contribute', label: 'Contribute' },
  { id: 'expert', label: 'Expert' },
] as const

/** The member's own profile; null where the program is not served here yet. */
export async function mine(): Promise<Own | null> {
  try {
    return await request<Own>({ path: '/v1/reward/me/profile' })
  } catch (e) {
    if (e instanceof Silence || (e instanceof Refusal && notServed(e.status))) return null
    throw e
  }
}

/** A handle the program accepts: 3 to 32 of a-z, 0-9, `_` and `-`, starting with a letter or number. */
export function handle(...names: (string | undefined)[]): string {
  for (const raw of names) {
    const h = (raw ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^[^a-z0-9]+|-+$/g, '')
      .slice(0, 32)
    if (h.length >= 3) return h
  }
  return ''
}

/**
 * Make the member's level and badges public, or private again. A member with no
 * program to speak of (it is not served here yet) is left alone: publishing a
 * listing never waits on it. Returns whether the choice was recorded.
 */
export async function show(on: boolean, current: Own | null, names: { github?: string; name?: string; email?: string }): Promise<boolean> {
  if (!current) return false
  if (!on) {
    if (!current.public) return true
    await request<Own>({ method: 'PUT', path: '/v1/reward/me/profile', body: { ...current, public: false } })
    return true
  }
  const h = current.handle || handle(names.github, names.name, names.email?.split('@')[0])
  if (!h) throw new Refusal(400, 'Choose a handle for your Hanzo profile.')
  const links = names.github ? { ...current.links, github: `https://github.com/${names.github}` } : current.links
  await request<Own>({ method: 'PUT', path: '/v1/reward/me/profile', body: { handle: h, public: true, links } })
  return true
}
