import { describe, expect, it } from 'vitest'
import {
  buildInitialRows,
  inferHoleCount,
  isPuttShot,
  legacySlopeToAxes,
  playedRowsForDifferential,
  type PlacedPoint,
} from '../round'
import { decombinedPuttResult } from '../types'

// OKC tee at 35.4676 / -97.5164. Build markers along a meridian so
// distance math is just yards-of-latitude.
const M_PER_DEG_LAT = 111_320
const YDS_PER_METER = 1.09361
const TEE = { lat: 35.4676, lng: -97.5164 }

function offsetLatYards(yards: number): number {
  return TEE.lat + yards / YDS_PER_METER / M_PER_DEG_LAT
}

const PIN = offsetLatYards(380)

describe('buildInitialRows', () => {
  it('produces one row per placed point', () => {
    const points: PlacedPoint[] = [
      { lat: TEE.lat, lng: TEE.lng },
      { lat: offsetLatYards(220), lng: TEE.lng },
      { lat: offsetLatYards(370), lng: TEE.lng },
      { lat: offsetLatYards(379), lng: TEE.lng },
    ]
    const rows = buildInitialRows(points, 4, PIN, TEE.lng)
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.shotNumber)).toEqual([1, 2, 3, 4])
  })

  it('row N\'s end coords match point N+1\'s coords', () => {
    const points: PlacedPoint[] = [
      { lat: TEE.lat, lng: TEE.lng },
      { lat: offsetLatYards(220), lng: TEE.lng },
      { lat: offsetLatYards(370), lng: TEE.lng },
    ]
    const rows = buildInitialRows(points, 4, PIN, TEE.lng)
    expect(rows[0]!.endLat).toBe(points[1]!.lat)
    expect(rows[1]!.endLat).toBe(points[2]!.lat)
  })

  it('last row ends at the pin (player holed out)', () => {
    const points: PlacedPoint[] = [
      { lat: TEE.lat, lng: TEE.lng },
      { lat: offsetLatYards(220), lng: TEE.lng },
      { lat: offsetLatYards(370), lng: TEE.lng },
    ]
    const rows = buildInitialRows(points, 4, PIN, TEE.lng)
    const last = rows.at(-1)!
    expect(last.isLastShot).toBe(true)
    expect(last.endLat).toBe(PIN)
    expect(last.endLng).toBe(TEE.lng)
  })

  it('inferred lie + club come through unchanged from inferShot', () => {
    // Tee shot of ~220 yd → driver, lie=tee.
    const points: PlacedPoint[] = [
      { lat: TEE.lat, lng: TEE.lng },
      { lat: offsetLatYards(220), lng: TEE.lng },
    ]
    const rows = buildInitialRows(points, 4, PIN, TEE.lng)
    expect(rows[0]!.lieType).toBe('tee')
    expect(rows[0]!.club).toBe('driver')
  })

  it('last shot starting on the green defaults puttMade=true', () => {
    // 4 markers, last placed ~1 yd from the pin → on-green threshold
    // (15 yd) → final inferred lie is 'green', and the helper marks
    // puttMade so the player just confirms.
    const points: PlacedPoint[] = [
      { lat: TEE.lat, lng: TEE.lng },
      { lat: offsetLatYards(220), lng: TEE.lng },
      { lat: offsetLatYards(370), lng: TEE.lng },
      { lat: offsetLatYards(379), lng: TEE.lng },
    ]
    const rows = buildInitialRows(points, 4, PIN, TEE.lng)
    const last = rows.at(-1)!
    expect(last.lieType).toBe('green')
    expect(last.puttMade).toBe(true)
  })

  it('non-green last shot leaves puttMade undefined and lie=rough', () => {
    // Two-shot hole that "finishes" from the fairway — buildInitialRows
    // assumes a hole-out at the pin, so the final row's lieType comes
    // from inferShot. The penultimate marker is 180 yd from pin →
    // off-green → inferShot returns 'rough'.
    const points: PlacedPoint[] = [
      { lat: TEE.lat, lng: TEE.lng },
      { lat: offsetLatYards(200), lng: TEE.lng },
    ]
    const rows = buildInitialRows(points, 4, PIN, TEE.lng)
    const last = rows.at(-1)!
    expect(last.lieType).toBe('rough')
    expect(last.puttMade).toBeUndefined()
  })

  it('empty input → empty output, does not throw', () => {
    expect(buildInitialRows([], 4, PIN, TEE.lng)).toEqual([])
  })

  it('single-shot hole-out (eagle) — one row, isLast=true, ends at pin', () => {
    const points: PlacedPoint[] = [{ lat: TEE.lat, lng: TEE.lng }]
    const rows = buildInitialRows(points, 4, PIN, TEE.lng)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.isLastShot).toBe(true)
    expect(rows[0]!.endLat).toBe(PIN)
  })
})

describe('isPuttShot', () => {
  it('green lie is a putt', () => {
    expect(isPuttShot('green', 'driver')).toBe(true)
  })
  it('putter club is a putt', () => {
    expect(isPuttShot('fairway', 'putter')).toBe(true)
  })
  it('near-green chip (rough/wedge) is NOT a putt', () => {
    expect(isPuttShot('rough', 'gap-wedge')).toBe(false)
  })
  it('sand shot is NOT a putt', () => {
    expect(isPuttShot('sand', '56')).toBe(false)
  })
  it('null/undefined fields are NOT a putt', () => {
    expect(isPuttShot(null, null)).toBe(false)
    expect(isPuttShot(undefined, undefined)).toBe(false)
  })
})

describe('decombinedPuttResult', () => {
  // Inverse of combinedPuttResult — produces a human label from the
  // two miss axes. All four combos pinned because the shape has been
  // re-touched twice and we don't want it to regress.
  it('distance only — short', () => {
    expect(decombinedPuttResult('short', null)).toBe('Short')
  })

  it('distance only — long', () => {
    expect(decombinedPuttResult('long', null)).toBe('Long')
  })

  it('direction only — left', () => {
    expect(decombinedPuttResult(null, 'left')).toBe('Missed left')
  })

  it('direction only — right', () => {
    expect(decombinedPuttResult(null, 'right')).toBe('Missed right')
  })

  it('both axes — comma-joined', () => {
    expect(decombinedPuttResult('short', 'left')).toBe('Short, Missed left')
    expect(decombinedPuttResult('long', 'right')).toBe('Long, Missed right')
  })

  it('both null — empty string', () => {
    expect(decombinedPuttResult(null, null)).toBe('')
  })
})

describe('legacySlopeToAxes', () => {
  // Single-axis lie_slope was split into forward + side. This helper
  // routes legacy values to whichever axis they came from so post-split
  // editors can still display pre-split rows.
  it('uphill / level / downhill go to the forward axis', () => {
    expect(legacySlopeToAxes('uphill')).toEqual({ forward: 'uphill' })
    expect(legacySlopeToAxes('level')).toEqual({ forward: 'level' })
    expect(legacySlopeToAxes('downhill')).toEqual({ forward: 'downhill' })
  })

  it('ball_above / ball_below go to the side axis', () => {
    expect(legacySlopeToAxes('ball_above')).toEqual({ side: 'ball_above' })
    expect(legacySlopeToAxes('ball_below')).toEqual({ side: 'ball_below' })
  })

  it('null input returns empty object (no axes set)', () => {
    expect(legacySlopeToAxes(null)).toEqual({})
  })

  it('never returns both forward and side — single legacy axis only', () => {
    for (const legacy of ['uphill', 'level', 'downhill', 'ball_above', 'ball_below'] as const) {
      const out = legacySlopeToAxes(legacy)
      const hasBoth = out.forward !== undefined && out.side !== undefined
      expect(hasBoth).toBe(false)
    }
  })
})

describe('inferHoleCount', () => {
  it('empty (unmapped course) defaults to 18', () => {
    expect(inferHoleCount([])).toBe(18)
  })

  it('contiguous 1–9 → 9', () => {
    expect(inferHoleCount([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(9)
  })

  it('contiguous 1–18 → 18', () => {
    expect(inferHoleCount(Array.from({ length: 18 }, (_, i) => i + 1))).toBe(18)
  })

  it('partial 18 missing trailing holes (1–14) → 18 by max', () => {
    expect(inferHoleCount(Array.from({ length: 14 }, (_, i) => i + 1))).toBe(18)
  })

  it('interior gaps keyed on max, not count (1–4, 7–18) → 18', () => {
    expect(inferHoleCount([1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18])).toBe(18)
  })

  it('back-nine-only mapping (10–18) → 18', () => {
    expect(inferHoleCount([10, 11, 12, 13, 14, 15, 16, 17, 18])).toBe(18)
  })

  it('sparse sub-9 mapping (1–5) → 9', () => {
    expect(inferHoleCount([1, 2, 3, 4, 5])).toBe(9)
  })

  it('a single mapped hole 10 already implies 18', () => {
    expect(inferHoleCount([10])).toBe(18)
  })
})

describe('playedRowsForDifferential', () => {
  const rows = (scores: number[]) => scores.map((score) => ({ score }))

  it('returns the played rows when they cover every hole', () => {
    expect(playedRowsForDifferential(rows([4, 5, 3]), 3)).toEqual(
      rows([4, 5, 3]),
    )
  })

  it('null when any hole is unplayed — score-0 sentinel rows (mobile pre-creation)', () => {
    expect(playedRowsForDifferential(rows([4, 0, 3]), 3)).toBeNull()
  })

  it('null on a partial round — fewer scored rows than holes (web lazy creation)', () => {
    expect(playedRowsForDifferential(rows([4, 5]), 3)).toBeNull()
  })

  it('null on an early-ended 18 — 9 played of 18 pre-created rows', () => {
    expect(
      playedRowsForDifferential(rows([...Array(9).fill(4), ...Array(9).fill(0)]), 18),
    ).toBeNull()
  })

  it('sentinel rows are excluded from the returned set, not just tolerated', () => {
    expect(playedRowsForDifferential(rows([4, 5, 3, 0]), 3)).toEqual(
      rows([4, 5, 3]),
    )
  })
})
