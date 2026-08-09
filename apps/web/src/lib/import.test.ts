import { describe, expect, it } from 'vitest'
import { summarizeImportDataQuality, validateImportPayload } from './import'

function validPayload() {
  return {
    import_id: 'garmin:98765432',
    course_name: 'Lakeside National',
    played_at: '2026-08-01',
    tee_color: 'white',
    total_score: 92,
    total_putts: 31,
    holes: [
      {
        number: 1,
        score: 5,
        putts: 2,
        penalties: 0,
        shots: [
          {
            shot_number: 1,
            club: 'driver',
            lie_type: 'tee',
            start_lat: 40.0,
            start_lng: -105.0,
            end_lat: 40.001,
            end_lng: -105.001,
            distance_to_target: 365,
          },
          {
            shot_number: 2,
            club: 'putter',
            lie_type: 'green',
            putt_distance_ft: 5.5,
          },
        ],
      },
    ],
  }
}

describe('validateImportPayload', () => {
  it('accepts a well-formed payload', () => {
    const result = validateImportPayload(validPayload())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.holes).toHaveLength(1)
      expect(result.data.holes[0]!.shots).toHaveLength(2)
    }
  })

  it('rounds a fractional distance_to_target to the nearest yard', () => {
    // shots.distance_to_target is an integer column — a GPS-derived
    // fractional yardage (Garmin et al.) would otherwise fail the insert
    // with a Postgres "invalid input syntax for type integer" error.
    const payload = validPayload()
    payload.holes[0]!.shots[0]!.distance_to_target = 235.7
    const result = validateImportPayload(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.holes[0]!.shots[0]!.distance_to_target).toBe(236)
    }
  })

  it('accepts a payload with no shots (score-only import)', () => {
    const payload = validPayload()
    payload.holes[0]!.shots = []
    const result = validateImportPayload(payload)
    expect(result.success).toBe(true)
  })

  it('accepts a JSON string, not just a parsed object', () => {
    const result = validateImportPayload(JSON.stringify(validPayload()))
    expect(result.success).toBe(true)
  })

  it('reports invalid JSON without throwing', () => {
    const result = validateImportPayload('{ not valid json')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]!.message).toMatch(/invalid JSON/)
    }
  })

  it('rejects a missing required field with a field-level error', () => {
    const payload = validPayload() as Record<string, unknown>
    delete payload.played_at
    const result = validateImportPayload(payload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.path === 'played_at')).toBe(true)
    }
  })

  it('rejects an out-of-vocabulary enum value with a path pointing at the exact shot', () => {
    const payload = validPayload()
    payload.holes[0]!.shots[0]!.lie_type = 'bunker'
    const result = validateImportPayload(payload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.path === 'holes[0].shots[0].lie_type')).toBe(true)
    }
  })

  it('rejects an out-of-range latitude', () => {
    const payload = validPayload()
    payload.holes[0]!.shots[0]!.start_lat = 200
    const result = validateImportPayload(payload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.path === 'holes[0].shots[0].start_lat')).toBe(true)
    }
  })

  it('requires at least one hole', () => {
    const payload = validPayload()
    payload.holes = []
    const result = validateImportPayload(payload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.path === 'holes')).toBe(true)
    }
  })

  it('rejects a malformed played_at date string', () => {
    const payload = validPayload()
    payload.played_at = '08/01/2026'
    const result = validateImportPayload(payload)
    expect(result.success).toBe(false)
  })

  it('rejects Infinity for distance_to_target', () => {
    const payload = validPayload()
    payload.holes[0]!.shots[0]!.distance_to_target = Infinity
    const result = validateImportPayload(payload)
    expect(result.success).toBe(false)
  })

  it('rejects Infinity for putt_distance_ft', () => {
    const payload = validPayload()
    payload.holes[0]!.shots[1]!.putt_distance_ft = Infinity
    const result = validateImportPayload(payload)
    expect(result.success).toBe(false)
  })

  it('rejects Infinity for aim_offset_yards', () => {
    const payload = validPayload() as Record<string, unknown>
    ;(
      (payload.holes as Record<string, unknown>[])[0]!.shots as Record<string, unknown>[]
    )[0]!.aim_offset_yards = -Infinity
    const result = validateImportPayload(payload)
    expect(result.success).toBe(false)
  })

  it('rejects more than 20 shots on a single hole', () => {
    const payload = validPayload() as Record<string, unknown>
    ;(payload.holes as Record<string, unknown>[])[0]!.shots = Array.from(
      { length: 21 },
      (_, i) => ({ shot_number: i + 1 }),
    )
    const result = validateImportPayload(payload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.path === 'holes[0].shots')).toBe(true)
    }
  })

  it('rejects more than 18 holes', () => {
    // Capped at 18 (not the schema's per-hole number range extended for a
    // double round) because the write path upserts hole_scores on
    // (round_id, hole_id) — a second nine would silently overwrite the
    // first instead of creating a second round.
    const payload = validPayload() as Record<string, unknown>
    payload.holes = Array.from({ length: 19 }, (_, i) => ({
      number: i + 1,
      score: 4,
      shots: [],
    }))
    const result = validateImportPayload(payload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.path === 'holes')).toBe(true)
    }
  })

  it('rejects a duplicate shot_number on the same hole', () => {
    // shots has a DB unique constraint on (hole_score_id, shot_number) —
    // this should fail validation up front instead of passing review and
    // tripping the constraint mid-insert.
    const payload = validPayload()
    payload.holes[0]!.shots[1]!.shot_number = 1
    const result = validateImportPayload(payload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.path === 'holes[0].shots[1].shot_number')).toBe(true)
    }
  })
})

function summarize(payload: unknown) {
  const result = validateImportPayload(payload)
  if (!result.success) throw new Error('expected payload to validate')
  return summarizeImportDataQuality(result.data)
}

describe('summarizeImportDataQuality', () => {
  it('reports no warnings for a fully-complete payload', () => {
    // validPayload()'s shot 1 has club/lie_type/distance_to_target; shot 2
    // is a putt (lie_type: 'green') with putt_distance_ft set correctly.
    expect(summarize(validPayload())).toEqual({
      missingClub: [],
      missingLieType: [],
      missingDistanceToTarget: [],
      misplacedPuttDistance: [],
    })
  })

  it('locates a shot missing club by hole and shot number', () => {
    const payload = validPayload()
    delete (payload.holes[0]!.shots[0] as Record<string, unknown>).club
    expect(summarize(payload).missingClub).toEqual([{ holeNumber: 1, shotNumber: 1 }])
  })

  it('locates a shot missing lie_type by hole and shot number', () => {
    const payload = validPayload()
    delete (payload.holes[0]!.shots[0] as Record<string, unknown>).lie_type
    expect(summarize(payload).missingLieType).toEqual([{ holeNumber: 1, shotNumber: 1 }])
  })

  it('does not flag a putt (lie_type "green") missing distance_to_target', () => {
    const payload = validPayload()
    const putt = payload.holes[0]!.shots[1] as Record<string, unknown>
    delete putt.club
    // lie_type stays 'green', no distance_to_target.
    expect(summarize(payload).missingDistanceToTarget).toEqual([])
  })

  it('does not flag a putt identified via club "putter" alone missing distance_to_target', () => {
    const payload = validPayload()
    const putt = payload.holes[0]!.shots[1] as Record<string, unknown>
    delete putt.lie_type
    // club stays 'putter', no distance_to_target.
    expect(summarize(payload).missingDistanceToTarget).toEqual([])
  })

  it('locates a non-putt shot missing distance_to_target', () => {
    const payload = validPayload()
    delete (payload.holes[0]!.shots[0] as Record<string, unknown>).distance_to_target
    expect(summarize(payload).missingDistanceToTarget).toEqual([{ holeNumber: 1, shotNumber: 1 }])
  })

  it('returns empty lists for a payload with no shots', () => {
    const payload = validPayload()
    payload.holes[0]!.shots = []
    expect(summarize(payload)).toEqual({
      missingClub: [],
      missingLieType: [],
      missingDistanceToTarget: [],
      misplacedPuttDistance: [],
    })
  })

  it('locates a putt whose distance landed in distance_to_target instead of putt_distance_ft', () => {
    const payload = validPayload()
    const putt = payload.holes[0]!.shots[1] as Record<string, unknown>
    delete putt.putt_distance_ft
    putt.distance_to_target = 5.5
    expect(summarize(payload).misplacedPuttDistance).toEqual([{ holeNumber: 1, shotNumber: 2 }])
  })

  it('does not flag a putt with putt_distance_ft correctly set, even if distance_to_target is also present', () => {
    const payload = validPayload()
    const putt = payload.holes[0]!.shots[1] as Record<string, unknown>
    putt.distance_to_target = 5.5 // stray extra value alongside a correct putt_distance_ft
    expect(summarize(payload).misplacedPuttDistance).toEqual([])
  })

  it('does not flag a putt with neither distance field set (no data at all, not a misplacement)', () => {
    const payload = validPayload()
    const putt = payload.holes[0]!.shots[1] as Record<string, unknown>
    delete putt.putt_distance_ft
    // distance_to_target already absent on this shot.
    expect(summarize(payload).misplacedPuttDistance).toEqual([])
  })

  it('aggregates issues across multiple holes', () => {
    const payload = validPayload()
    delete (payload.holes[0]!.shots[0] as Record<string, unknown>).club
    ;(payload.holes as Record<string, unknown>[]).push({
      number: 2,
      score: 4,
      shots: [{ shot_number: 1, club: 'driver' }], // missing lie_type
    })
    const result = summarize(payload)
    expect(result.missingClub).toEqual([{ holeNumber: 1, shotNumber: 1 }])
    expect(result.missingLieType).toEqual([{ holeNumber: 2, shotNumber: 1 }])
  })
})
