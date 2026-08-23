import type { Doc } from '../lib/types'

type BadgeKind = Doc<'skillBadges'>['kind']

// Presence is the whole question these predicates ask — none of them reads
// `byUserId` or `at`. Requiring that shape made every caller holding a wire
// row cast, so it asks only for keys now.
type SkillLike = { badges?: Partial<Record<BadgeKind, unknown>> | null }

type BadgeLabel = 'Deprecated' | 'Official' | 'Highlighted'

export function isSkillHighlighted(skill: SkillLike) {
  return Boolean(skill.badges?.highlighted)
}

export function isSkillOfficial(skill: SkillLike) {
  return Boolean(skill.badges?.official)
}

export function isSkillDeprecated(skill: SkillLike) {
  return Boolean(skill.badges?.deprecated)
}

export function getSkillBadges(skill: SkillLike): BadgeLabel[] {
  const badges: BadgeLabel[] = []
  if (isSkillDeprecated(skill)) badges.push('Deprecated')
  if (isSkillOfficial(skill)) badges.push('Official')
  if (isSkillHighlighted(skill)) badges.push('Highlighted')
  return badges
}
