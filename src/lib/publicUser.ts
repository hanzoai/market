import type { Persona, Skill } from './api'
import type { Doc } from '../lib/types'

export type PublicUser = Pick<
  Doc<'users'>,
  '_id' | '_creationTime' | 'handle' | 'name' | 'displayName' | 'image' | 'bio'
>

export type PublicSkill = Pick<
  Doc<'skills'>,
  | '_id'
  | '_creationTime'
  | 'slug'
  | 'displayName'
  | 'summary'
  | 'ownerUserId'
  | 'canonicalSkillId'
  | 'forkOf'
  | 'latestVersionId'
  | 'tags'
  | 'badges'
  | 'stats'
  | 'createdAt'
  | 'updatedAt'
>

export type PublicPersona = Pick<
  Doc<'personas'>,
  | '_id'
  | '_creationTime'
  | 'slug'
  | 'displayName'
  | 'summary'
  | 'ownerUserId'
  | 'latestVersionId'
  | 'tags'
  | 'stats'
  | 'createdAt'
  | 'updatedAt'
>

/** A list-endpoint row as the cards and detail views consume it. */
export function skillToPublic(s: Skill): PublicSkill {
  return {
    _id: s.id,
    _creationTime: new Date(s.createdAt).getTime(),
    slug: s.slug,
    displayName: s.displayName,
    summary: s.summary,
    ownerUserId: s.ownerUserId,
    stats: {
      downloads: s.statsDownloads,
      stars: s.statsStars,
      versions: s.statsVersions,
      comments: s.statsComments,
    },
    badges: s.badges,
    tags: {},
    // The list endpoint does not carry these; null says so rather than leaving
    // the reader to find out by reading undefined off a card.
    forkOf: null,
    canonicalSkillId: null,
    latestVersionId: null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}

/** A listed persona as the cards consume it. Mirrors `skillToPublic`, including
 *  what the list omits. */
export function personaToPublic(p: Persona): PublicPersona {
  return {
    _id: p.id,
    _creationTime: new Date(p.createdAt).getTime(),
    slug: p.slug,
    displayName: p.displayName,
    summary: p.summary,
    ownerUserId: p.ownerUserId,
    latestVersionId: p.latestVersionId,
    tags: {},
    stats: {
      downloads: p.statsDownloads,
      stars: p.statsStars,
      versions: p.statsVersions,
      comments: p.statsComments,
    },
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}
