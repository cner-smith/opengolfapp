// generate-practice-plan — the §3 8-step orchestrator. Thin Deno I/O shell:
// auth → guards → digest → retrieve → Claude → validate/repair → store. ALL
// real logic lives in the vendored `_shared/practice-plan/*` helpers + the
// sibling `retrieval.ts` / `claude.ts`; this file only wires them.
//
// ⚠️ AUTH (§4): this function runs AS THE CALLER — anon key + the user's JWT —
// so every read is RLS-scoped to that user. It must NEVER read
// SUPABASE_SERVICE_ROLE_KEY (a reference to that var in this file is a
// review-reject). The only elevated read is the global-count RPC
// (plan_generations_this_month, a SECURITY DEFINER fn returning a bare int).
//
// No vitest — Edge I/O; correct-by-inspection, exercised at the Task 9 manual-invoke.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import { getCandidatePool, getPublishedArticles } from './retrieval.ts'
import {
  generatePlanDraft,
  PlanTruncatedError,
  PlanToolUseMissingError,
  type CallAttempt,
} from './claude.ts'
import {
  buildPlayerDigest,
  selectBaselinePlan,
  validatePlanDraft,
  playFrequencyPlan,
  resolvePlanForStorage,
  buildPlanPrompt,
  sanitizeFeedback,
  PLAN_TOOL,
  COACH_NOTE_MAX,
  type PlanDraft,
  type PlayerDigest,
  type PlanCategory,
  type PlayFrequency,
  type CandidateDrill,
  type PlanArticle,
} from '../_shared/practice-plan/index.ts'
import type { SkillLevel, Goal } from '../_shared/constants.ts'

// --- env knobs (all optional; safe defaults) -------------------------------
const MAX_GENERATIONS_PER_USER_PER_MONTH =
  Number(Deno.env.get('MAX_GENERATIONS_PER_USER_PER_MONTH')) || 8
const GLOBAL_MONTHLY_CAP = Number(Deno.env.get('GLOBAL_MONTHLY_CAP')) || 5000
const PLAN_MODEL = Deno.env.get('PLAN_MODEL') ?? 'claude-sonnet-4-6'
// Min rounds-with-SG before we'll pay for a generated plan (§3.3).
const MIN_SG_ROUNDS = 5
// Digest window — last N rounds with SG (§6).
const DIGEST_ROUND_CAP = 10
// Leave this much wall-clock head-room before firing the (second) repair call,
// so a slow first call + repair can't blow past the Edge limit mid-flight. The
// claude.ts per-call timeout is 30s and the SDK does one retry, so a repair can
// take ~30s; require that much budget remaining.
const REPAIR_MIN_BUDGET_MS = 35_000
const WALL_CLOCK_BUDGET_MS = 120_000

// --- I/O helpers (mirror round-summary-email/index.ts) ---------------------
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Decode the (gateway-verified) JWT claims. `verify_jwt` is on, so the
 *  signature is already checked; we only read the decoded payload. */
function decodeJwt(req: Request): Record<string, unknown> | null {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

// --- discriminated raw_model_output envelope (§16) -------------------------
// Assembled here (claude.ts returns per-call `attempt`s; we own the envelope).
type RawModelOutput =
  | { status: 'ok' | 'repaired'; model: string; attempts: CallAttempt[]; request_id: string | null }
  | {
      status: 'error'
      model: string
      error_type: string
      request_id: string | null
      message: string
    }
  | { status: 'baseline'; reason: string }

// --- DB row shapes ---------------------------------------------------------
const PLAN_SELECT =
  'id, user_id, ai_insight, coach_note, focus_areas, drills, based_on_rounds, generated_at, valid_until, completed_drill_ids, feedback'

interface PlanRow {
  id: string
  user_id: string
  ai_insight: string | null
  coach_note: string | null
  focus_areas: unknown
  drills: { sessions?: { blocks?: { drill_id?: string | null }[] }[] } | null
  based_on_rounds: number | null
  generated_at: string
  valid_until: string | null
  completed_drill_ids: string[]
  feedback: string | null
}

interface RoundRow {
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
  played_at: string | null
}

interface ProfileRow {
  skill_level: SkillLevel | null
  handicap_index: number | null
  goal: Goal | null
  facilities: string[] | null
  play_frequency: PlayFrequency | null
}

const todayUtc = () => new Date().toISOString().slice(0, 10)

/** The UI projection of a plan row — never includes raw_model_output (§16:
 *  it stays in the DB for spot-check/regression, never ships to the client). */
function toClientPlan(row: PlanRow) {
  return {
    id: row.id,
    ai_insight: row.ai_insight,
    coach_note: row.coach_note,
    focus_areas: row.focus_areas,
    drills: row.drills,
    based_on_rounds: row.based_on_rounds,
    generated_at: row.generated_at,
    valid_until: row.valid_until,
    completed_drill_ids: row.completed_drill_ids,
  }
}

/** Latest plan for the user, or null. The explicit user_id filter is a no-op
 *  under a normal user JWT (RLS) but required when called on the service-role
 *  dryRun path (RLS is bypassed). */
async function latestPlan(supabase: SupabaseClient, userId: string): Promise<PlanRow | null> {
  const { data } = await supabase
    .from('practice_plans')
    .select(PLAN_SELECT)
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle<PlanRow>()
  return data ?? null
}

/** Resolved drill UUIDs from the prior plan — anti-repetition input. Built from
 *  resolved `drills[].sessions[].blocks[].drill_id` (UUIDs, always unique), NOT
 *  block-id strings, so the deferred block-id-uniqueness gap (Phase C) stays safe. */
function priorDrillIdsFrom(prior: PlanRow | null): string[] {
  const ids = new Set<string>()
  for (const s of prior?.drills?.sessions ?? []) {
    for (const b of s.blocks ?? []) {
      if (b.drill_id) ids.add(b.drill_id)
    }
  }
  return [...ids]
}

Deno.serve(async (req) => {
  const startedAt = Date.now()

  // ----- Step 1: auth ------------------------------------------------------
  const claims = decodeJwt(req)
  const role = (claims?.role as string | undefined) ?? null
  const userId = (claims?.sub as string | undefined) ?? null
  if (!claims || (!userId && role !== 'service_role')) {
    return json({ error: 'unauthorized' }, 401)
  }

  // RLS-scoped client: anon key + the caller's JWT. NEVER the service-role key.
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  // Parse body once (dryRun + targetUserId). Tolerate an empty body.
  let body: { dryRun?: boolean; targetUserId?: string } = {}
  try {
    body = (await req.json()) ?? {}
  } catch {
    // no JSON body — normal flow
  }

  // dryRun is a service-role-only dev affordance: it runs the full PAID Claude
  // call but skips the INSERT the per-user cap counts, so an end-user-reachable
  // dryRun is an uncapped cost-abuse hole. A normal user sending dryRun:true is
  // IGNORED (runs the normal, cost-capped flow). When service-role + dryRun, the
  // JWT has no user `sub`, so the caller must name the targetUserId to digest.
  const isServiceRole = role === 'service_role'
  const dryRun = isServiceRole && body.dryRun === true
  if (dryRun && !body.targetUserId) {
    return json({ error: 'dryRun requires targetUserId' }, 400)
  }
  // A service-role JWT has no user `sub`, so the only thing it can do here is a
  // dryRun against a named target — there is no "self" to generate a real plan
  // for. Reject a service-role call that isn't a dryRun.
  if (isServiceRole && !dryRun) {
    return json({ error: 'service-role caller must use dryRun with a targetUserId' }, 400)
  }
  // Effective user whose data we operate on. For a normal call that's the JWT
  // subject; for a service-role dryRun it's the named target.
  const targetUserId = dryRun ? body.targetUserId! : userId!

  // ----- Step 2a: manual kill-switch --------------------------------------
  if (Deno.env.get('PLAN_ENGINE_ENABLED') === 'false') {
    return await serveLatestOrBaseline(supabase, targetUserId, 'engine_disabled', dryRun)
  }

  // ----- Step 2b: global spend ceiling (D15) ------------------------------
  // RLS hides other users' rows from this client, so a global count needs the
  // SECURITY DEFINER RPC (0032). On RPC failure, fail OPEN (don't block all
  // users on a transient DB hiccup) but log it.
  {
    const { data: globalCount, error: rpcErr } = await supabase.rpc('plan_generations_this_month')
    if (rpcErr) {
      console.error('[generate-practice-plan] global-count rpc failed', rpcErr.message)
    } else if (typeof globalCount === 'number') {
      if (globalCount >= GLOBAL_MONTHLY_CAP) {
        console.warn(
          `[generate-practice-plan] global cap hit (${globalCount}/${GLOBAL_MONTHLY_CAP}) → baseline`,
        )
        return await serveLatestOrBaseline(supabase, targetUserId, 'global_cap', dryRun)
      }
      if (globalCount >= GLOBAL_MONTHLY_CAP * 0.8) {
        console.warn(
          `[generate-practice-plan] global generations at ${globalCount}/${GLOBAL_MONTHLY_CAP} (>=80%)`,
        )
      }
    }
  }

  // ----- Step 3: cadence guard (§3.2) -------------------------------------
  // A live plan (valid_until >= today) means no-regen-within-window → return it.
  // Skipped under dryRun (dev wants to always exercise the full flow).
  if (!dryRun) {
    const { data: live } = await supabase
      .from('practice_plans')
      .select(PLAN_SELECT)
      .gte('valid_until', todayUtc())
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle<PlanRow>()
    if (live) return json(toClientPlan(live))
  }

  // ----- Step 4: per-user monthly cap (§11/D15) ---------------------------
  // RLS-scoped client sees only this user's rows — a plain count is correct.
  if (!dryRun) {
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const { count: userCount } = await supabase
      .from('practice_plans')
      .select('id', { count: 'exact', head: true })
      .gte('generated_at', monthStart.toISOString())
    if ((userCount ?? 0) >= MAX_GENERATIONS_PER_USER_PER_MONTH) {
      console.warn(`[generate-practice-plan] per-user cap hit (${userCount}) → baseline`)
      return await serveLatestOrBaseline(supabase, targetUserId, 'user_cap', dryRun)
    }
  }

  // ----- Step 5: sufficiency (§3.3) ---------------------------------------
  // Rounds with ANY SG column populated. <5 → baseline, no Claude.
  // NB: the explicit .eq('user_id', targetUserId) is a no-op under a normal user
  // JWT (RLS already constrains rows to auth.uid()), but it's REQUIRED for the
  // service-role dryRun path — a service_role JWT bypasses RLS, so without it the
  // rounds queries would aggregate every user's rounds. (profiles below is
  // already keyed by id.)
  const sgFilter =
    'sg_off_tee.not.is.null,sg_approach.not.is.null,sg_around_green.not.is.null,sg_putting.not.is.null'
  const { count: sgRoundCount } = await supabase
    .from('rounds')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetUserId)
    .or(sgFilter)
  if ((sgRoundCount ?? 0) < MIN_SG_ROUNDS) {
    return await serveBaseline(supabase, targetUserId, 'insufficient_rounds', dryRun)
  }

  // ----- Step 6: digest ----------------------------------------------------
  const { data: roundRows } = await supabase
    .from('rounds')
    .select('sg_off_tee, sg_approach, sg_around_green, sg_putting, played_at')
    .eq('user_id', targetUserId)
    .or(sgFilter)
    .order('played_at', { ascending: false })
    .limit(DIGEST_ROUND_CAP)
    .returns<RoundRow[]>()

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('skill_level, handicap_index, goal, facilities, play_frequency')
    .eq('id', targetUserId)
    .maybeSingle<ProfileRow>()

  const prior = await latestPlan(supabase, targetUserId)
  const lastFeedback = sanitizeFeedback(prior?.feedback ?? null)

  const profile: PlayerDigest['profile'] = {
    skill_level: profileRow?.skill_level ?? null,
    handicap_index: profileRow?.handicap_index ?? null,
    goal: profileRow?.goal ?? null,
    facilities: profileRow?.facilities ?? [],
    play_frequency: profileRow?.play_frequency ?? null,
  }

  const digest = buildPlayerDigest({
    profile,
    rounds: roundRows ?? [],
    // v1 carries NO dispersion: the shot-patterns engine is not vendored into
    // _shared (deferred per CLAUDE.md §23.1). buildPlayerDigest tolerates [] —
    // ranked_weaknesses derives from SG alone and the consistency-warning check
    // only fires when dispersion rows exist. Wire the dispersion slice in a
    // follow-up when it's vendored.
    dispersion: [],
    lastFeedback,
  })

  const weaknesses = digest.sg_summary.ranked_weaknesses
  const { sessionCount, validityDays } = playFrequencyPlan(profile.play_frequency)

  // ----- Step 7: retrieve → prompt → Claude → validate (+ repair) ---------
  let candidates: CandidateDrill[]
  let articles: PlanArticle[]
  try {
    candidates = await getCandidatePool(supabase, {
      skillLevel: profile.skill_level ?? 'developing',
      goal: profile.goal ?? 'break_90',
      facilities: profile.facilities,
      // Top weaknesses drive the gate; always carry a warmup/putting via
      // retrieval's completeness guarantee. weaknessTargets is intentionally
      // OMITTED — no category→target-tag map exists in @oga/core yet, and the opt
      // is optional (absent ⇒ stable id-asc order). Wire it when that map lands.
      // Pass the FULL ranked list (worst-first) — a too-narrow gate could starve
      // the pool; the prompt rules still force top-2 coverage on the model side.
      focusCategories: weaknesses,
    })
    articles = getPublishedArticles()
  } catch (err) {
    console.error('[generate-practice-plan] retrieval failed', (err as Error).message)
    return await serveBaseline(supabase, targetUserId, 'retrieval_failed', dryRun)
  }

  // Try the generated path; any failure (Claude error, invalid-after-repair,
  // truncation, unresolved drill_ref at storage) diverts to baseline below.
  let storedDraft: PlanDraft | null = null
  let raw: RawModelOutput | null = null

  // No candidates means the corpus can't cover this player's weaknesses under
  // their facility constraints (§17 floor gap) — skip Claude, serve baseline.
  if (candidates.length === 0) {
    console.warn('[generate-practice-plan] empty candidate pool → baseline')
  } else {
    try {
      const delimiterId = crypto.randomUUID()
      const { system, user } = buildPlanPrompt(
        digest,
        candidates,
        articles,
        lastFeedback,
        sessionCount,
        delimiterId,
      )

      const priorDrillIds = priorDrillIdsFrom(prior)
      const ctxBase = {
        pool: candidates,
        weaknesses,
        sessionCount,
        priorDrillIds,
        coachNoteMax: COACH_NOTE_MAX,
        articlesLen: articles.length,
      }

      const first = await generatePlanDraft({
        system,
        user,
        tool: PLAN_TOOL,
        model: PLAN_MODEL,
        sessionCount,
      })
      const attempts: CallAttempt[] = [first.attempt]
      let result = first
      let status: 'ok' | 'repaired' = 'ok'

      let check = validatePlanDraft(first.draft, ctxBase)
      if (!check.ok) {
        // ONE repair retry — but only if there's wall-clock head-room for it.
        const elapsed = Date.now() - startedAt
        const remaining = WALL_CLOCK_BUDGET_MS - elapsed
        if (remaining < REPAIR_MIN_BUDGET_MS) {
          console.warn(
            `[generate-practice-plan] skipping repair: ${remaining}ms budget < ${REPAIR_MIN_BUDGET_MS}ms`,
          )
          throw new Error(`validation failed, no budget for repair: ${check.errors.join('; ')}`)
        }
        const repaired = await generatePlanDraft({
          system,
          user,
          tool: PLAN_TOOL,
          model: PLAN_MODEL,
          sessionCount,
          repair: {
            priorAssistantContent: first.assistantContent,
            toolUseId: first.toolUseId,
            errors: check.errors,
          },
        })
        attempts.push(repaired.attempt)
        check = validatePlanDraft(repaired.draft, ctxBase)
        if (!check.ok) {
          throw new Error(`validation failed after repair: ${check.errors.join('; ')}`)
        }
        result = repaired
        status = 'repaired'
      }

      storedDraft = result.draft
      raw = {
        status,
        model: result.model,
        attempts,
        request_id: result.attempt.request_id,
      }
    } catch (err) {
      raw = classifyClaudeError(err, PLAN_MODEL)
      storedDraft = null // → baseline below
    }
  }

  // ----- Step 8: store + return -------------------------------------------
  // Baseline fallback path (insufficient already returned above; this is the
  // generated-path-failed path). Persist a baseline-tagged raw_model_output —
  // EXCEPT for transient Claude errors (rate-limit / overload / 5xx), which are
  // served ephemerally (no INSERT) so the per-user cap isn't burned and the
  // cadence guard doesn't lock the user out of an immediate retry.
  if (storedDraft === null) {
    const transient = raw?.status === 'error' && raw.error_type.startsWith('transient:')
    return await serveBaseline(
      supabase,
      targetUserId,
      'generation_failed',
      dryRun,
      raw,
      digest,
      validityDays,
      /* persist */ !transient,
    )
  }

  let payload
  try {
    payload = resolvePlanForStorage(storedDraft, { pool: candidates, articles, digest })
  } catch (err) {
    // Unresolved drill_ref (validator/pool/storage disagree) — never INSERT a
    // dangling block; divert to baseline.
    console.error('[generate-practice-plan] resolvePlanForStorage threw', (err as Error).message)
    return await serveBaseline(
      supabase,
      targetUserId,
      'storage_resolve_failed',
      dryRun,
      raw,
      digest,
      validityDays,
    )
  }

  const validUntil = new Date()
  validUntil.setUTCDate(validUntil.getUTCDate() + validityDays)
  const insertRow = {
    user_id: targetUserId,
    ai_insight: payload.ai_insight,
    coach_note: payload.coach_note,
    focus_areas: payload.focus_areas,
    drills: payload.drills,
    based_on_rounds: payload.based_on_rounds,
    valid_until: validUntil.toISOString().slice(0, 10),
    raw_model_output: raw,
  }

  if (dryRun) {
    // Dev affordance: show what WOULD be stored, plus the diagnostics — no INSERT.
    return json({
      dryRun: true,
      candidatePoolSize: candidates.length,
      validation: { ok: true },
      wouldStore: insertRow,
    })
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('practice_plans')
    .insert(insertRow)
    .select(PLAN_SELECT)
    .single<PlanRow>()

  if (insertErr) {
    // 23505 on practice_plans_user_day_uniq (0031): a concurrent request won the
    // race and already inserted today's plan. Don't double-charge/double-insert —
    // re-SELECT the user's current plan and return THAT.
    if (insertErr.code === '23505') {
      const existing = await latestPlan(supabase, targetUserId)
      if (existing) return json(toClientPlan(existing))
    }
    console.error('[generate-practice-plan] insert failed', insertErr.message)
    return json({ error: 'failed to store plan' }, 500)
  }

  // Strip raw_model_output from the response (it's never in PLAN_SELECT anyway).
  return json(toClientPlan(inserted))
})

// --- helpers ----------------------------------------------------------------

/** Map an SDK/protocol error to a discriminated raw_model_output envelope, with
 *  the right LOUDness. Most-specific-first; never logs the full error object
 *  (can carry prompt excerpts) — only `err.message` + `err.requestID`.
 *
 *  ⚠️ OverloadedError is NOT instanceof-able in the non-beta SDK — a 529 surfaces
 *  as InternalServerError. Branch on APIError.type === 'overloaded_error', and
 *  fold 429/5xx/529 into one transient bucket. */
function classifyClaudeError(err: unknown, model: string): RawModelOutput {
  // Protocol failures from claude.ts (already typed).
  if (err instanceof PlanTruncatedError || err instanceof PlanToolUseMissingError) {
    console.error(`[generate-practice-plan] ${err.name} (request ${err.request_id}) → baseline`)
    return {
      status: 'error',
      model,
      error_type: err.name,
      request_id: err.request_id,
      message: err.message,
    }
  }

  if (err instanceof Anthropic.APIError) {
    const requestID = (err as { requestID?: string | null }).requestID ?? null
    const type = (err as { type?: string }).type
    const errType = err.constructor?.name ?? 'APIError'

    // Config outage: bad/missing ANTHROPIC_API_KEY → every user silently
    // baselines forever. LOUD, distinct alert.
    if (
      err instanceof Anthropic.AuthenticationError ||
      err instanceof Anthropic.PermissionDeniedError
    ) {
      console.error(
        `[generate-practice-plan] 🔴 CLAUDE AUTH/PERMISSION FAILURE — ANTHROPIC_API_KEY likely bad/missing; ` +
          `ALL users are silently getting baselines. ${err.message} (request ${requestID})`,
      )
      return {
        status: 'error',
        model,
        error_type: errType,
        request_id: requestID,
        message: err.message,
      }
    }

    // Transient: rate-limit / overload (529→InternalServerError) / 5xx. Baseline
    // but do NOT burn the user's monthly cap — by NOT inserting a row here, the
    // count query naturally excludes this attempt (we serve a baseline that is
    // also stored, but the cap counts plans; transient retries shouldn't penalize
    // the user). We tag the reason so the caller can choose not to persist.
    const transient =
      err instanceof Anthropic.RateLimitError ||
      err instanceof Anthropic.InternalServerError ||
      type === 'overloaded_error' ||
      err.status === 429 ||
      (typeof err.status === 'number' && err.status >= 500)
    if (transient) {
      console.warn(
        `[generate-practice-plan] transient Claude error (${errType}/${type ?? err.status}) → baseline, cap not burned. ` +
          `${err.message} (request ${requestID})`,
      )
      return {
        status: 'error',
        model,
        error_type: `transient:${errType}`,
        request_id: requestID,
        message: err.message,
      }
    }

    // BadRequest / everything else.
    console.error(
      `[generate-practice-plan] Claude error ${errType}: ${err.message} (request ${requestID}) → baseline`,
    )
    return {
      status: 'error',
      model,
      error_type: errType,
      request_id: requestID,
      message: err.message,
    }
  }

  // Non-SDK error (e.g. our own "validation failed after repair" / no-budget).
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[generate-practice-plan] generation failed: ${message} → baseline`)
  return { status: 'error', model, error_type: 'GenerationError', request_id: null, message }
}

/**
 * Build + (unless dryRun) store a baseline plan, then return it. Used at every
 * no-Claude exit (kill-switch, caps, insufficiency, generation failure). When a
 * `raw` envelope is supplied (the generation-failed path) it's persisted so the
 * forensic trail explains why this row is a baseline; otherwise a
 * `{status:'baseline', reason}` envelope is stored. Catches the 0031 23505 race.
 */
async function serveBaseline(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
  dryRun: boolean,
  raw?: RawModelOutput | null,
  digest?: PlayerDigest,
  validityDays?: number,
  // false ⇒ serve the baseline ephemerally (no INSERT) so the per-user cap isn't
  // burned. Used only for transient Claude errors. Defaults to persisting.
  persist = true,
): Promise<Response> {
  // Pull the bare profile bits the baseline keys off (skill/goal) if we don't
  // already have a digest. RLS-scoped read.
  let skill: SkillLevel | null = digest?.profile.skill_level ?? null
  let goal: Goal | null = digest?.profile.goal ?? null
  let worstCategory: PlanCategory | undefined = digest?.sg_summary.ranked_weaknesses[0]
  if (!digest) {
    const { data: p } = await supabase
      .from('profiles')
      .select('skill_level, goal')
      .eq('id', userId)
      .maybeSingle<{ skill_level: SkillLevel | null; goal: Goal | null }>()
    skill = p?.skill_level ?? null
    goal = p?.goal ?? null
  }

  // weekIndex rotates baseline variants by ISO week so a returning user doesn't
  // see byte-identical content every time.
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  const draft = selectBaselinePlan({ skill, goal, weekIndex, worstCategory })

  // Baselines carry placeholder drill_refs (no resolved drill ids) — store the
  // draft sessions as-is (UI renders the same PlanDraft shape). No pool to
  // resolve against, so we map the draft directly.
  const days = validityDays ?? 7
  const validUntil = new Date()
  validUntil.setUTCDate(validUntil.getUTCDate() + days)

  const insertRow = {
    user_id: userId,
    ai_insight: draft.week_focus,
    coach_note: draft.coach_note,
    focus_areas: draft.focus_areas,
    drills: { sessions: draft.sessions },
    based_on_rounds: digest?.sg_summary.based_on_rounds ?? 0,
    valid_until: validUntil.toISOString().slice(0, 10),
    raw_model_output: raw ?? ({ status: 'baseline', reason } satisfies RawModelOutput),
  }

  if (dryRun) {
    return json({ dryRun: true, baseline: true, reason, wouldStore: insertRow })
  }

  // Transient-error path: serve the baseline ephemerally — no INSERT (so the
  // per-user cap isn't burned and the cadence guard doesn't lock the user out of
  // an immediate retry). 503 so the client can surface "try again shortly".
  if (!persist) {
    return json(
      {
        ai_insight: insertRow.ai_insight,
        coach_note: insertRow.coach_note,
        focus_areas: insertRow.focus_areas,
        drills: insertRow.drills,
        based_on_rounds: insertRow.based_on_rounds,
        valid_until: insertRow.valid_until,
        transient: true,
      },
      503,
    )
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('practice_plans')
    .insert(insertRow)
    .select(PLAN_SELECT)
    .single<PlanRow>()

  if (insertErr) {
    if (insertErr.code === '23505') {
      const existing = await latestPlan(supabase, userId)
      if (existing) return json(toClientPlan(existing))
    }
    console.error('[generate-practice-plan] baseline insert failed', insertErr.message)
    return json({ error: 'failed to store plan' }, 500)
  }
  return json(toClientPlan(inserted))
}

/** No-Claude exits that should prefer the user's most recent stored plan (a
 *  disabled engine / a tripped cap shouldn't re-mint a baseline if a real plan
 *  already exists): return the latest plan if there is one, else fall through to
 *  a fresh baseline. Never under dryRun reaches an INSERT (serveBaseline gates). */
async function serveLatestOrBaseline(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
  dryRun: boolean,
): Promise<Response> {
  if (!dryRun) {
    const existing = await latestPlan(supabase, userId)
    if (existing) return json(toClientPlan(existing))
  }
  return await serveBaseline(supabase, userId, reason, dryRun)
}
