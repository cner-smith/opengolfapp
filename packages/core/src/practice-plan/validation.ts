import type { PlanDraft, CandidateDrill, PlanCategory } from './types'

export interface ValidationCtx {
  pool: CandidateDrill[]
  weaknesses: readonly PlanCategory[] // ranked; top-2 must be covered
  sessionCount: number
  priorDrillIds: string[]
  coachNoteMax: number
}

const MINUTE_TOLERANCE = 0.2
const MAX_OVERLAP = 0.6

export function validatePlanDraft(
  draft: PlanDraft,
  ctx: ValidationCtx,
): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const refOf = (i: number): CandidateDrill | undefined => ctx.pool[i]

  // D1: session count must match what the planner requested
  if (draft.sessions.length !== ctx.sessionCount) {
    errors.push(`session count ${draft.sessions.length} != ${ctx.sessionCount}`)
  }

  const usedIds = new Set<string>()
  for (const s of draft.sessions) {
    let sum = 0
    for (const b of s.blocks) {
      const drill = refOf(b.drill_ref)
      if (!drill) {
        // D2: drill_ref must be a valid index into the candidate pool
        errors.push(`drill_ref ${b.drill_ref} out of range`)
        continue
      }
      // D3: block type must match the drill's declared drill_type
      if (drill.drill_type !== b.type) {
        errors.push(`block ${b.id} type ${b.type} != drill ${drill.drill_type}`)
      }
      usedIds.add(drill.id)
      if (!Number.isFinite(b.minutes) || b.minutes < 0) {
        errors.push(`block ${b.id} minutes ${b.minutes} invalid (must be a finite number >= 0)`)
      }
      sum += b.minutes
    }
    // D4: total_minutes must be positive and finite; sum of block minutes must be within 20%
    if (!Number.isFinite(s.total_minutes) || s.total_minutes <= 0) {
      errors.push(`session "${s.title}" total_minutes ${s.total_minutes} invalid (must be > 0)`)
    } else if (Math.abs(sum - s.total_minutes) / s.total_minutes > MINUTE_TOLERANCE) {
      errors.push(`session "${s.title}" minutes ${sum} vs total ${s.total_minutes} >20%`)
    }
  }

  // D5: each of the top-2 weaknesses must have at least one non-warmup block covering it
  const covered = new Set<PlanCategory>()
  for (const s of draft.sessions) {
    for (const b of s.blocks) {
      const d = refOf(b.drill_ref)
      if (d && b.type !== 'warmup') covered.add(d.category)
    }
  }
  for (const w of ctx.weaknesses.slice(0, 2)) {
    if (!covered.has(w)) {
      errors.push(`top weakness ${w} not covered by a non-warmup block`)
    }
  }

  // D6: anti-repetition — only enforced when the pool is large enough to offer variety.
  // Guard: pool.length >= usedIds.size + 2 means there are at least 2 unused drills
  // the model could have picked instead. Skipping when the pool is too small avoids
  // false positives on tiny drill libraries.
  if (ctx.priorDrillIds.length > 0 && ctx.pool.length >= usedIds.size + 2) {
    const prior = new Set(ctx.priorDrillIds)
    const shared = [...usedIds].filter((id) => prior.has(id)).length
    if (usedIds.size > 0 && shared / usedIds.size >= MAX_OVERLAP) {
      errors.push(`drill overlap ${shared}/${usedIds.size} >= 60% (repetition)`)
    }
  }

  // D7: coach_note length cap
  if (draft.coach_note.length > ctx.coachNoteMax) {
    errors.push(`coach_note ${draft.coach_note.length} > ${ctx.coachNoteMax}`)
  }

  return { ok: errors.length === 0, errors }
}
