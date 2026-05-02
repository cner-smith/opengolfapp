import { describe, expect, it } from 'vitest'
import {
  FEET_TO_CM,
  FEET_TO_METERS,
  FEET_TO_YARDS,
  METERS_TO_YARDS,
  YARDS_TO_METERS,
  formatDistance,
  formatPuttDistance,
  formatSG,
  formatToPar,
  haversineYards,
  todayLocalDate,
  toRadians,
} from '../units'

// Realistic golf coordinates pinned to OKC area. Picking integer-ish
// values so the precomputed expectations stay legible.
const OKC = { lat: 35.4676, lng: -97.5164 }
const TULSA = { lat: 36.154, lng: -95.9928 }

describe('haversineYards', () => {
  it('OKC ↔ Tulsa locks to a precomputed 171,874.85 yd value', () => {
    // Tight pin against a hand-computed great-circle (R=6371km, the
    // value our impl uses). A radius-constant regression of 0.1%
    // shifts this by ~170 yd, so the 5-yd window catches it; a
    // sin/cos swap shifts it by tens of thousands.
    const d = haversineYards(OKC.lat, OKC.lng, TULSA.lat, TULSA.lng)
    expect(d).toBeCloseTo(171874.85, 0)
  })

  it('symmetric — A→B equals B→A', () => {
    const ab = haversineYards(OKC.lat, OKC.lng, TULSA.lat, TULSA.lng)
    const ba = haversineYards(TULSA.lat, TULSA.lng, OKC.lat, OKC.lng)
    expect(ab).toBeCloseTo(ba, 6)
  })

  it('returns 0 for identical points', () => {
    expect(haversineYards(OKC.lat, OKC.lng, OKC.lat, OKC.lng)).toBe(0)
  })

  it('roughly 100 yards apart returns ~100 within 1 yard', () => {
    // ~100 yards north along a meridian = 100 yd / 121,830 yd/° ≈ 0.000821°
    const d = haversineYards(OKC.lat, OKC.lng, OKC.lat + 0.000821, OKC.lng)
    expect(d).toBeGreaterThan(99)
    expect(d).toBeLessThan(101)
  })

  it('southern hemisphere returns the right magnitude (~27,180 yd)', () => {
    // Sydney area — both lats negative. Pin to actual computed value
    // so a sign-flip bug surfaces instead of just "still positive".
    const d = haversineYards(-33.86, 151.21, -34.0, 151.0)
    expect(d).toBeCloseTo(27180.57, 0)
  })

  it('handles antimeridian-adjacent coords without going negative', () => {
    // Just east and just west of the date line.
    const d = haversineYards(0, 179.9, 0, -179.9)
    expect(d).toBeGreaterThan(0)
    // ~0.2° at the equator = ~24,360 yd. Wraparound bug would give
    // ~43,750,000 yd (the long way around).
    expect(d).toBeLessThan(30000)
  })

  it('NaN inputs propagate to NaN — not a silent zero', () => {
    expect(haversineYards(NaN, 0, 0, 0)).toBeNaN()
    expect(haversineYards(0, NaN, 0, 0)).toBeNaN()
  })
})

describe('toRadians', () => {
  it('180° → π', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 12)
  })

  it('0° → 0', () => {
    expect(toRadians(0)).toBe(0)
  })

  it('90° → π/2', () => {
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 12)
  })

  it('360° → 2π', () => {
    expect(toRadians(360)).toBeCloseTo(2 * Math.PI, 12)
  })

  it('negative degrees stay negative', () => {
    expect(toRadians(-90)).toBeCloseTo(-Math.PI / 2, 12)
  })
})

describe('formatSG', () => {
  it('positive values get a + prefix', () => {
    expect(formatSG(1.23)).toBe('+1.23')
  })

  it('negative values keep their - sign', () => {
    expect(formatSG(-1.23)).toBe('-1.23')
  })

  // Documents the choice: zero is signless. Avoids "+0.00" which reads
  // as a positive miss when the player was actually neutral.
  it('zero renders without a sign', () => {
    expect(formatSG(0)).toBe('0.00')
  })

  it('rounds to two decimals', () => {
    expect(formatSG(1.23456)).toBe('+1.23')
    expect(formatSG(-1.23999)).toBe('-1.24')
  })

  it('values that round to 0 keep their pre-rounding sign', () => {
    // 0.001 is positive → renders as +0.00 even though it rounds to
    // zero. The plus survives because it's set before toFixed.
    expect(formatSG(0.001)).toBe('+0.00')
    expect(formatSG(-0.001)).toBe('-0.00')
  })

  it('handles large magnitudes', () => {
    expect(formatSG(123.4567)).toBe('+123.46')
    expect(formatSG(-99.99)).toBe('-99.99')
  })

  it('NaN renders as "NaN" (does not throw)', () => {
    // Documents current behavior — keeps a downstream surprise audit
    // honest. Caller should gate on Number.isFinite before formatting.
    expect(formatSG(Number.NaN)).toBe('NaN')
  })
})

describe('formatToPar', () => {
  it('positive diff gets a + prefix', () => {
    expect(formatToPar(2)).toBe('+2')
  })

  it('negative diff keeps the - sign', () => {
    expect(formatToPar(-2)).toBe('-2')
  })

  it('zero renders as E', () => {
    expect(formatToPar(0)).toBe('E')
  })

  it('multi-digit values format correctly', () => {
    expect(formatToPar(10)).toBe('+10')
    expect(formatToPar(-15)).toBe('-15')
  })
})

describe('unit constants', () => {
  it('YARDS_TO_METERS round-trips with METERS_TO_YARDS within 5e-4', () => {
    // The constants are 4-5 sig-fig rationals (0.9144 and 1.09361),
    // not exact reciprocals — round-tripping 100 yd drifts by ~3e-4
    // yards. Pin precision 3 (tolerance ±5e-4) so the test catches a
    // typo (e.g. 1.0936 dropped a digit → drift ~5e-3) but doesn't
    // demand exactness the constants don't promise.
    const yd = 100
    const back = yd * YARDS_TO_METERS * METERS_TO_YARDS
    expect(back).toBeCloseTo(yd, 3)
  })

  it('FEET_TO_YARDS converts 3 ft to 1 yd within 1e-4', () => {
    expect(3 * FEET_TO_YARDS).toBeCloseTo(1, 4)
  })

  it('YARDS_TO_METERS is the canonical 0.9144', () => {
    // Literal-pin: catches an accidental rewrite to 0.91 or 0.9144000.
    expect(YARDS_TO_METERS).toBe(0.9144)
  })

  it('FEET_TO_METERS is the canonical 0.3048', () => {
    expect(FEET_TO_METERS).toBe(0.3048)
  })

  it('FEET_TO_CM is 30.48 — the magic number previously inlined in useUnits', () => {
    expect(FEET_TO_CM).toBe(30.48)
  })
})

describe('formatDistance', () => {
  it('yards mode renders whole yards by default', () => {
    expect(formatDistance(150, 'yards')).toBe('150 yd')
  })

  it('yards mode honours decimals param', () => {
    expect(formatDistance(150.5, 'yards', 1)).toBe('150.5 yd')
  })

  it('meters mode converts and labels with m', () => {
    // 150 yd × 0.9144 = 137.16 m → "137 m" at 0 dp
    expect(formatDistance(150, 'meters')).toBe('137 m')
  })

  it('non-finite input renders em dash so callers do not need a guard', () => {
    expect(formatDistance(Number.NaN, 'yards')).toBe('—')
    expect(formatDistance(Number.POSITIVE_INFINITY, 'meters')).toBe('—')
  })
})

describe('formatPuttDistance', () => {
  it('yards mode renders rounded feet', () => {
    expect(formatPuttDistance(8.4, 'yards')).toBe('8 ft')
    expect(formatPuttDistance(8.5, 'yards')).toBe('9 ft')
  })

  it('meters mode renders rounded centimetres (golfers call putts in cm)', () => {
    // 8 ft × 30.48 = 243.84 cm → 244 cm
    expect(formatPuttDistance(8, 'meters')).toBe('244 cm')
  })

  it('non-finite input renders em dash', () => {
    expect(formatPuttDistance(Number.NaN, 'yards')).toBe('—')
    expect(formatPuttDistance(Number.NaN, 'meters')).toBe('—')
  })
})

describe('todayLocalDate', () => {
  it('returns YYYY-MM-DD shape (10 chars, two dashes)', () => {
    const out = todayLocalDate()
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches the host machine local date — not UTC', () => {
    // Recreate the expected local date the same way the helper does so
    // the test is timezone-stable in CI (whatever TZ the runner uses).
    const d = new Date()
    const expected = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-')
    expect(todayLocalDate()).toBe(expected)
  })
})
