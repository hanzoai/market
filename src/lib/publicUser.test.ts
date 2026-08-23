import { describe, expect, it } from 'vitest'

import { personaToPublic, skillToPublic } from './publicUser'
import type { Persona, Skill } from './api'

const skill: Skill = {
  id: 'sk1',
  slug: 'weather',
  displayName: 'Weather',
  summary: 'Get current weather.',
  ownerUserId: 'u1',
  badges: { official: { byUserId: 'u9', at: 1 } },
  batch: null,
  statsDownloads: 7,
  statsStars: 3,
  statsVersions: 2,
  statsComments: 1,
  createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-02T10:00:00Z',
  ownerHandle: 'ada',
  ownerImage: null,
} as Skill

const persona: Persona = {
  id: 'pe1',
  slug: 'archivist',
  displayName: 'Archivist',
  summary: null,
  ownerUserId: 'u2',
  statsDownloads: 5,
  statsStars: 4,
  statsVersions: 3,
  statsComments: 2,
  createdAt: '2026-08-03T10:00:00Z',
  updatedAt: '2026-08-04T10:00:00Z',
  latestVersionId: 'v9',
}

describe('skillToPublic', () => {
  it('addresses the row by the id the endpoint sends', () => {
    // The wire field is `id`; every consumer reads `_id`. Getting this wrong is
    // silent — cards render, keys collide, lookups miss.
    expect(skillToPublic(skill)._id).toBe('sk1')
  })

  it('keeps both timestamps as the strings the type declares', () => {
    const p = skillToPublic(skill)
    expect(p.createdAt).toBe('2026-08-01T10:00:00Z')
    expect(p.updatedAt).toBe('2026-08-02T10:00:00Z')
  })

  it('parses the creation time, which is the one number', () => {
    expect(skillToPublic(skill)._creationTime).toBe(Date.parse('2026-08-01T10:00:00Z'))
  })

  it('folds the flat stat columns into one stats object', () => {
    expect(skillToPublic(skill).stats).toEqual({ downloads: 7, stars: 3, versions: 2, comments: 1 })
  })

  it('says null for what the list does not carry', () => {
    const p = skillToPublic(skill)
    expect(p.forkOf).toBeNull()
    expect(p.canonicalSkillId).toBeNull()
    expect(p.latestVersionId).toBeNull()
  })

  it('passes badges through, since presence is all anything asks', () => {
    expect(skillToPublic(skill).badges).toEqual({ official: { byUserId: 'u9', at: 1 } })
  })
})

describe('personaToPublic', () => {
  it('mirrors skillToPublic on the id and the timestamps', () => {
    const p = personaToPublic(persona)
    expect(p._id).toBe('pe1')
    expect(p.createdAt).toBe('2026-08-03T10:00:00Z')
    expect(p._creationTime).toBe(Date.parse('2026-08-03T10:00:00Z'))
  })

  it('carries the version the list does send', () => {
    expect(personaToPublic(persona).latestVersionId).toBe('v9')
  })

  it('folds the flat stat columns the same way', () => {
    expect(personaToPublic(persona).stats).toEqual({ downloads: 5, stars: 4, versions: 3, comments: 2 })
  })
})
