import { z } from 'zod'
import { LIE_SLOPES_FORWARD, LIE_SLOPES_SIDE, LIE_TYPES, SHOT_RESULTS } from '@oga/core'

// Schema for the "Import from data" feature (apps/web ImportDataPage). Field
// names are the actual snake_case DB column names on shots/hole_scores/rounds
// (not the app's camelCase TS conventions) — the payload is meant to be
// produced by an external script (e.g. a Garmin-to-OGA converter someone
// writes themselves) that maps a third-party data source straight onto this
// app's schema, so it doubles as a preview of what will actually be
// inserted. Fields the review/commit step resolves interactively — user_id,
// course_id, hole_id, round_id, hole_score_id — are deliberately absent;
// `course_name` is a hint for pre-seeding the course search, not a stored
// value, and `holes[].number` is what gets matched against the chosen
// course's real holes.
//
// break_direction_vertical/horizontal and green_speed/putt distance-result
// unions are hand-written (not sourced from constants.ts) because they're
// plain string-literal types in ./types, not exported const arrays — keep
// these in sync with BreakDirectionVertical/BreakDirectionHorizontal/
// GreenSpeed/PuttDistanceResult/PuttDirectionResult there.

const latitude = z.number().min(-90).max(90)
const longitude = z.number().min(-180).max(180)

export const importShotSchema = z.object({
  shot_number: z.number().int().min(1),
  club: z.string().min(1).nullish(),
  lie_type: z.enum(LIE_TYPES).nullish(),
  lie_slope_forward: z.enum(LIE_SLOPES_FORWARD).nullish(),
  lie_slope_side: z.enum(LIE_SLOPES_SIDE).nullish(),
  shot_result: z.enum(SHOT_RESULTS).nullish(),
  start_lat: latitude.nullish(),
  start_lng: longitude.nullish(),
  end_lat: latitude.nullish(),
  end_lng: longitude.nullish(),
  aim_lat: latitude.nullish(),
  aim_lng: longitude.nullish(),
  // shots.distance_to_target is an integer column, and the rest of the app
  // already rounds to whole yards before writing it (see
  // useRoundActions.ts's live-capture path) — round here too so a
  // GPS-derived fractional yardage (Garmin et al.) doesn't fail the insert
  // with a Postgres "invalid input syntax for type integer" error.
  // .finite() rejects Infinity/-Infinity, which plain z.number() lets
  // through (only NaN is rejected by default) and Postgres would otherwise
  // reject at insert time with the same class of numeric-syntax error.
  distance_to_target: z
    .number()
    .min(0)
    .finite()
    .nullish()
    .transform((v) => (v == null ? v : Math.round(v))),
  penalty: z.boolean().nullish(),
  ob: z.boolean().nullish(),
  aim_offset_yards: z.number().finite().nullish(),
  break_direction_vertical: z.enum(['uphill', 'downhill', 'flat']).nullish(),
  break_direction_horizontal: z.enum(['left_to_right', 'right_to_left', 'straight']).nullish(),
  putt_distance_ft: z.number().min(0).finite().nullish(),
  putt_distance_result: z.enum(['short', 'long']).nullish(),
  putt_direction_result: z.enum(['left', 'right']).nullish(),
  putt_slope_pct: z.number().int().min(0).max(4).nullish(),
  green_speed: z.enum(['slow', 'medium', 'fast']).nullish(),
  notes: z.string().nullish(),
})

export const importHoleSchema = z
  .object({
    number: z.number().int().min(1).max(18),
    score: z.number().int().min(1),
    putts: z.number().int().min(0).nullish(),
    penalties: z.number().int().min(0).nullish(),
    fairway_hit: z.boolean().nullish(),
    gir: z.boolean().nullish(),
    pin_lat: latitude.nullish(),
    pin_lng: longitude.nullish(),
    // No real hole has anywhere near this many recorded shots — caps a
    // malformed/malicious payload from queuing an unbounded number of
    // sequential shot inserts on Import.
    shots: z.array(importShotSchema).max(20, 'a single hole cannot have more than 20 shots').default([]),
  })
  // shots has a DB unique constraint on (hole_score_id, shot_number) — catch
  // a duplicate shot_number here so the payload fails validation up front
  // instead of passing review and then tripping the constraint mid-insert
  // (which leaves a partially-imported round for the rollback path to undo).
  .superRefine((hole, ctx) => {
    const seen = new Set<number>()
    hole.shots.forEach((shot, i) => {
      if (seen.has(shot.shot_number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['shots', i, 'shot_number'],
          message: `duplicate shot_number ${shot.shot_number} on hole ${hole.number}`,
        })
      }
      seen.add(shot.shot_number)
    })
  })

export const importRoundSchema = z.object({
  // Provider-agnostic external reference for dedup, e.g. "garmin:98765432"
  // — stored as rounds.import_id (see migration 0052). Optional: a payload
  // with no external source (hand-built, or a provider without stable ids)
  // can still be imported, just without duplicate-import protection.
  import_id: z.string().min(1).nullish(),
  // Hint only, not persisted — pre-seeds CourseSearch in the review step.
  course_name: z.string().min(1).nullish(),
  played_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
  tee_color: z.string().min(1).nullish(),
  total_score: z.number().int().nullish(),
  total_putts: z.number().int().min(0).nullish(),
  // Capped at 18 (real courses top out there) — the write path upserts
  // hole_scores on (round_id, hole_id), so a payload with a second nine
  // (holes 19-36 for a double round) would silently overwrite the first
  // instead of creating a second round. Double-round import needs its own
  // design, not a bigger cap here.
  holes: z
    .array(importHoleSchema)
    .min(1, 'at least one hole is required')
    .max(18, 'a single payload cannot have more than 18 holes'),
})

export type ImportShotPayload = z.infer<typeof importShotSchema>
export type ImportHolePayload = z.infer<typeof importHoleSchema>
export type ImportRoundPayload = z.infer<typeof importRoundSchema>

export interface ImportValidationError {
  /** Dot/bracket path into the payload, e.g. "holes[2].shots[0].lie_type". */
  path: string
  message: string
}

export type ImportValidationResult =
  | { success: true; data: ImportRoundPayload }
  | { success: false; errors: ImportValidationError[] }

function formatPath(path: (string | number)[]): string {
  let out = ''
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${segment}]`
    } else {
      out += out ? `.${segment}` : segment
    }
  }
  return out || '(root)'
}

/**
 * Parses + validates a raw import payload (already-parsed JSON, or a string
 * to JSON.parse first). Never throws — malformed JSON and schema violations
 * both come back as a flat, UI-friendly error list so the import screen can
 * show every problem at once instead of stopping at the first one.
 */
export function validateImportPayload(raw: unknown): ImportValidationResult {
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch (err) {
      return {
        success: false,
        errors: [{ path: '(root)', message: `invalid JSON: ${(err as Error).message}` }],
      }
    }
  }

  const result = importRoundSchema.safeParse(value)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: formatPath(issue.path),
      message: issue.message,
    })),
  }
}

/** Pinpoints a single flagged shot so the UI can say exactly where to look. */
export interface ImportDataQualityIssue {
  holeNumber: number
  shotNumber: number
}

export interface ImportDataQualitySummary {
  missingClub: ImportDataQualityIssue[]
  missingLieType: ImportDataQualityIssue[]
  missingDistanceToTarget: ImportDataQualityIssue[]
  misplacedPuttDistance: ImportDataQualityIssue[]
}

function isPutt(shot: ImportShotPayload): boolean {
  return shot.lie_type === 'green' || shot.club === 'putter'
}

/**
 * Non-blocking, advisory scan of an already-valid payload for optional
 * fields worth backfilling (club, lie_type, distance_to_target on full
 * swings) and one specific footgun (putt distance landing in
 * distance_to_target instead of putt_distance_ft). Every field checked
 * here is optional in the schema, so this never affects
 * validateImportPayload's success/failure — purely a list of where to
 * look for the caller to surface however it likes.
 */
export function summarizeImportDataQuality(payload: ImportRoundPayload): ImportDataQualitySummary {
  const missingClub: ImportDataQualityIssue[] = []
  const missingLieType: ImportDataQualityIssue[] = []
  const missingDistanceToTarget: ImportDataQualityIssue[] = []
  const misplacedPuttDistance: ImportDataQualityIssue[] = []

  for (const hole of payload.holes) {
    for (const shot of hole.shots) {
      const at = { holeNumber: hole.number, shotNumber: shot.shot_number }
      if (shot.club == null) missingClub.push(at)
      if (shot.lie_type == null) missingLieType.push(at)
      // Putts legitimately have no distance_to_target (they use
      // putt_distance_ft instead) — flagging them here would light up
      // every single round.
      if (shot.distance_to_target == null && !isPutt(shot)) missingDistanceToTarget.push(at)
      // The putting SG calc reads only putt_distance_ft, with no fallback
      // to distance_to_target (sg-calculator.ts's startDistanceFt) — a
      // putt carrying its distance in distance_to_target instead silently
      // contributes zero to putting SG for the whole round, which looks
      // like broken data rather than a mapping mistake.
      if (isPutt(shot) && shot.putt_distance_ft == null && shot.distance_to_target != null) {
        misplacedPuttDistance.push(at)
      }
    }
  }

  return { missingClub, missingLieType, missingDistanceToTarget, misplacedPuttDistance }
}
