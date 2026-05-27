import type { SkillLevel } from '../constants'
import type { TargetTemplate, PlayerDigest } from './types'

const SKILL_FALLBACK: SkillLevel = 'developing'

/** Resolve a drill's target to a concrete number: skill baseline -> scaling
 *  adjustment from the digest -> clamp. The model never emits target numbers. */
export function resolveTarget(tmpl: TargetTemplate, digest: PlayerDigest): number {
  const skill = digest.profile.skill_level ?? SKILL_FALLBACK
  let value = tmpl.baseline[skill] ?? tmpl.baseline[SKILL_FALLBACK] ?? tmpl.min

  if (tmpl.scales_with) {
    // Only dispersion scaling is defined for v1. Tighter cone -> +1, wide -> -1.
    const disp = digest.dispersion[0]?.cone68.lateral
    if (disp != null) value += disp < 8 ? 1 : disp > 16 ? -1 : 0
  }
  return Math.max(tmpl.min, Math.min(tmpl.max, value))
}
