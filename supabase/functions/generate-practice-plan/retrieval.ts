// Retrieval (§7 + §21): the candidate-drill pool the model selects from (by
// index) and the published-Learn citation set. No business rules here beyond the
// gate + a STABLE, TOTAL ordering — the order IS the contract: the model picks a
// drill by its 0-based index, so two runs over the same inputs MUST produce the
// same pool in the same order, or an index silently resolves to a different drill
// (and the future golden-set eval flakes). Hence the `id asc` final tiebreak.
//
// No unit tests (DB I/O) — correctness is by inspection here and exercised at the
// Task 9 manual-invoke. The `supabase` client is created + RLS-scoped by the
// orchestrator and passed in; this module never creates one.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { CandidateDrill, PlanCategory, BlockType } from '../_shared/practice-plan/types.ts'
import { getPublishedArticles, type PublishedArticle } from '../_shared/published-articles.ts'

const POOL_LIMIT = 25

/** Row shape selected from `public.drills`. Superset of `CandidateDrill`: also
 *  pulls `targets` (raw weakness tags) for overlap scoring — `targets` is NOT a
 *  `CandidateDrill` field, so it stays local to this module. */
interface DrillRow {
  id: string
  name: string
  category: PlanCategory
  drill_type: BlockType
  duration_min: number | null
  facility: string[] | null
  target_template: CandidateDrill['target_template']
  targets: string[] | null
}

const DRILL_SELECT =
  'id, name, category, drill_type, duration_min, facility, target_template, targets'

export interface CandidatePoolOpts {
  skillLevel: string
  goal: string
  /** The player's available facilities (e.g. ['range','practice_green']). */
  facilities: string[]
  /** Ranked weakness categories from the digest (worst-first). */
  focusCategories: PlanCategory[]
  /** Weakness target tags (e.g. ['start_line','dispersion','lag']) used ONLY to
   *  rank the pool by overlap. Optional: absent ⇒ overlap score is 0 for all and
   *  the pool collapses to the stable `id asc` order. Passed by the orchestrator
   *  (Task 8); see note in the task report. */
  weaknessTargets?: string[]
}

/** A PostgREST array/element literal: brace-wrapped, comma-joined. Values here are
 *  internal enum-like tokens (skill levels, goals, facility keys) with no commas,
 *  quotes, or braces, so no element-quoting is needed.
 *
 *  Trust posture for interpolated values:
 *  - `goal` is safe: DB CHECK constraint (migration 0001) limits it to the
 *    known enum set ('break_100', 'break_90', …, 'scratch').
 *  - `facilities` is safe in practice (app-controlled enum values) but has NO
 *    DB CHECK constraint — it's a text[] with no brace/comma characters in any
 *    valid value, so pgArray can't be weaponized. A malformed PostgREST filter
 *    from either will throw in getCandidatePool, which now degrades to a baseline
 *    in the orchestrator (no hard 500). */
function pgArray(values: string[]): string {
  return `{${values.join(',')}}`
}

function overlapCount(targets: string[] | null, weaknessTargets: string[]): number {
  if (!targets || targets.length === 0 || weaknessTargets.length === 0) return 0
  const wanted = new Set(weaknessTargets)
  let n = 0
  for (const t of targets) if (wanted.has(t)) n++
  return n
}

function toCandidate(r: DrillRow): CandidateDrill {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    drill_type: r.drill_type,
    duration_min: r.duration_min,
    facility: r.facility,
    target_template: r.target_template,
  }
}

/**
 * §7 candidate pool. Gate (all ANDed):
 *   - `skill_levels @> [skillLevel]`            — drill suits this skill band
 *   - `goals = '{}' OR goals @> [goal]`         — goal-agnostic OR matches the goal
 *   - `facility = '{}' OR facility && facilities` — anywhere-doable OR ≥1 facility match
 *   - `category = any(focusCategories)`         — attacks a ranked weakness
 *   - `verified = true`                          — maintainer-vetted only
 *
 * Order: targets-overlap-with-weaknesses DESC, then `id` ASC (total tiebreak).
 * PostgREST can't ORDER BY an array-overlap count, so we fetch the full gated set
 * ordered by `id asc` (stable + total), score overlap in JS, and stable-sort.
 *
 * Completeness guarantee: the pool is normally capped at POOL_LIMIT (25) and
 * always includes ≥1 `warmup` AND ≥1 drill whose `drill_type` is `putting` or
 * `pressure_game` (when the gated set contains any), so the model can always
 * build a full session. In the degenerate case where the top-25 can't satisfy
 * both guarantees via the swap path (every slot is shielding the other
 * guarantee), `ensurePresent` appends rather than swaps, so the pool may grow
 * to 26–27. This is safe: `validatePlanDraft` range-checks every `drill_ref`
 * against `candidates.length`, so a slightly-over-cap pool never causes a
 * silent out-of-bounds resolve.
 */
export async function getCandidatePool(
  supabase: SupabaseClient,
  opts: CandidatePoolOpts,
): Promise<CandidateDrill[]> {
  const { skillLevel, goal, facilities, focusCategories, weaknessTargets = [] } = opts

  if (focusCategories.length === 0) return []

  let query = supabase
    .from('drills')
    .select(DRILL_SELECT)
    .eq('verified', true)
    .contains('skill_levels', [skillLevel])
    .in('category', focusCategories)
    // goal-agnostic ('{}') OR explicitly tagged for this goal. Two separate
    // .or() groups are AND-combined by PostgREST — the intended (A) AND (B).
    .or(`goals.eq.${pgArray([])},goals.cs.${pgArray([goal])}`)

  // facility: anywhere-doable ('{}') OR overlaps the player's facilities. With no
  // facilities known, the overlap arm can't match, so gate to anywhere-doable only.
  query =
    facilities.length > 0
      ? query.or(`facility.eq.${pgArray([])},facility.ov.${pgArray(facilities)}`)
      : query.eq('facility', pgArray([]))

  // Stable, total base order; JS re-ranks by overlap below.
  query = query.order('id', { ascending: true })

  const { data, error } = await query.returns<DrillRow[]>()
  if (error) {
    console.error('[generate-practice-plan] candidate query failed', error)
    throw error
  }

  const rows = data ?? []

  // Stable sort: overlap DESC, then id ASC. `rows` is already id-asc, so a stable
  // sort on the overlap key alone preserves id-asc within equal-overlap groups.
  const scored = rows
    .map((r) => ({ r, overlap: overlapCount(r.targets, weaknessTargets) }))
    .sort((a, b) => b.overlap - a.overlap)

  const ranked = scored.map((s) => s.r)

  // Top slice, then guarantee a warmup and a putting/pressure_game drill are present.
  const isWarmup = (r: DrillRow) => r.drill_type === 'warmup'
  const isPuttingOrPressure = (r: DrillRow) =>
    r.drill_type === 'putting' || r.drill_type === 'pressure_game'

  const selected = ranked.slice(0, POOL_LIMIT)

  // Ensure `predicate` is represented in `selected`. If absent but available in
  // `ranked`, swap the highest-ranked qualifying drill in for the lowest-ranked
  // current occupant that isn't itself protecting the *other* guarantee.
  function ensurePresent(predicate: (r: DrillRow) => boolean, protect: (r: DrillRow) => boolean) {
    if (selected.length === 0) return
    if (selected.some(predicate)) return
    const candidate = ranked.find(predicate)
    if (!candidate) return // gated set has none — nothing we can do
    if (selected.includes(candidate)) return
    // Replace the worst-ranked occupant that isn't shielding the other guarantee
    // (and isn't already what we're inserting). Walk from the tail (lowest rank).
    for (let i = selected.length - 1; i >= 0; i--) {
      const occupant = selected[i]
      if (protect(occupant) && selected.filter(protect).length === 1) continue
      selected[i] = candidate
      return
    }
    // Every slot is shielding the other guarantee (degenerate tiny pool); append.
    selected.push(candidate)
  }

  ensurePresent(isWarmup, isPuttingOrPressure)
  ensurePresent(isPuttingOrPressure, isWarmup)

  return selected.map(toCandidate)
}

export { getPublishedArticles }
export type { PublishedArticle }
