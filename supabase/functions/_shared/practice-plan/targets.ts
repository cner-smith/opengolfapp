import type { SkillLevel } from '../constants.ts'
import type { TargetTemplate, PlayerDigest } from './types.ts'

const SKILL_FALLBACK: SkillLevel = 'developing'

/** Resolve a drill's target to a concrete number: skill baseline -> clamp.
 *  v1 does NOT scale by dispersion — the digest exposes only per-club
 *  dispersion, with no per-category aggregate yet, so `target_template.scales_with`
 *  is carried on drills as data and consumed in Phase B once that aggregate
 *  exists. Targets stay deterministic + auditable; the model never emits one. */
export function resolveTarget(tmpl: TargetTemplate, digest: PlayerDigest): number {
  const skill = digest.profile.skill_level ?? SKILL_FALLBACK
  const value = tmpl.baseline[skill] ?? tmpl.baseline[SKILL_FALLBACK] ?? tmpl.min
  return Math.max(tmpl.min, Math.min(tmpl.max, value))
}
