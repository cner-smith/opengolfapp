import type { CandidateDrill, PlayerDigest, PlanDraft, PlanCategory } from './types.ts'
import { resolveTarget } from './targets.ts'

/** A published Learn article eligible for citation. `article_ref` indexes this set. */
export interface PlanArticle {
  article_id: string
  title: string
  slug: string
}

export interface StorageCtx {
  pool: CandidateDrill[]
  articles: PlanArticle[]
  digest: PlayerDigest
}

/** One stored practice block — index `drill_ref` resolved to a real `drill_id`
 *  and a server-filled deterministic `target`. The UI + `completed_drill_ids`
 *  key off `id`, so it is preserved verbatim. */
export interface StoredBlock {
  id: string
  order: number
  type: PlanDraft['sessions'][number]['blocks'][number]['type']
  minutes: number
  rationale: string
  drill_id: string | undefined
  target: number | null
}

export interface StoredSession {
  title: string
  total_minutes: number
  blocks: StoredBlock[]
}

export interface StoredFocusArea {
  category: PlanCategory
  reason: string
  article?: { title: string; slug: string }
}

/** The `practice_plans` INSERT payload (§8 column map). Keys are the snake_case
 *  column names: `ai_insight`←week_focus, `coach_note`, `focus_areas` jsonb,
 *  `drills` jsonb, `based_on_rounds`. */
export interface PlanStoragePayload {
  ai_insight: string
  coach_note: string
  focus_areas: StoredFocusArea[]
  drills: { sessions: StoredSession[] }
  based_on_rounds: number
}

/** Map a validated PlanDraft (index refs) to the practice_plans INSERT payload:
 *  resolve each `drill_ref` → `pool[ref].id`, fill each non-warmup block's
 *  `target` via `resolveTarget`, and resolve each `article_ref` → catalog
 *  `{title, slug}` (never model-supplied text).
 *
 *  `based_on_rounds` is derived from `ctx.digest.sg_summary.based_on_rounds`
 *  — the single source of truth; there is no redundant ctx field.
 *
 *  After `validatePlanDraft` all `drill_ref` values are in range. If one
 *  doesn't resolve it means validator/pool/storage disagree — an unreachable
 *  invariant violation. We **throw** so the orchestrator's catch block can
 *  fall back to the baseline plan instead of INSERTing a dangling block.
 *  An unresolved optional `article_ref` is dropped and logged (harmless —
 *  citations are optional). */
export function resolvePlanForStorage(draft: PlanDraft, ctx: StorageCtx): PlanStoragePayload {
  const sessions: StoredSession[] = draft.sessions.map((s) => {
    const blocks: StoredBlock[] = s.blocks.map((b) => {
      const drill = ctx.pool[b.drill_ref]
      const drillId = drill?.id
      if (drillId === undefined) {
        // Unreachable after validatePlanDraft — throw so the orchestrator's
        // catch block falls back to the baseline plan (never INSERT a dangling block).
        throw new Error(
          `resolvePlanForStorage: unresolved drill_ref ${b.drill_ref} (validator/pool/storage disagree)`,
        )
      }
      const tmpl = drill?.target_template
      const target = b.type === 'warmup' ? null : tmpl ? resolveTarget(tmpl, ctx.digest) : null
      return {
        id: b.id,
        order: b.order,
        type: b.type,
        minutes: b.minutes,
        rationale: b.rationale,
        drill_id: drillId,
        target,
      }
    })
    return {
      title: s.title,
      total_minutes: blocks.reduce((acc, b) => acc + b.minutes, 0),
      blocks,
    }
  })

  const focus_areas: StoredFocusArea[] = draft.focus_areas.map((f) => {
    const area: StoredFocusArea = { category: f.category, reason: f.reason }
    if (f.article_ref !== undefined) {
      const a = ctx.articles[f.article_ref]
      if (a) {
        area.article = { title: a.title, slug: a.slug }
      } else {
        // Optional citation — drop it, but log: post-validation this is unexpected.
        console.error(`resolvePlanForStorage: article_ref ${f.article_ref} did not resolve`)
      }
    }
    return area
  })

  return {
    ai_insight: draft.week_focus,
    coach_note: draft.coach_note,
    focus_areas,
    drills: { sessions },
    based_on_rounds: ctx.digest.sg_summary.based_on_rounds,
  }
}
