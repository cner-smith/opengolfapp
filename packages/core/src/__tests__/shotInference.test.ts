import { describe, expect, it } from 'vitest'
import { inferShot, type PlacedShot } from '../shotInference'
import { getShotCategory } from '../sg-calculator'

// Synthetic OKC-area coords with clean 1° latitude → 121,830 yd math.
// offsetLat shifts a base latitude north by N yards using the
// canonical 111,320 m / 1.09361 yd / m factor.
const M_PER_DEG_LAT = 111_320
const YDS_PER_METER = 1.09361
const TEE = { lat: 35.4676, lng: -97.5164 }

function offsetLatYards(lat: number, yards: number): number {
  return lat + yards / YDS_PER_METER / M_PER_DEG_LAT
}

function placedShot(opts: Partial<PlacedShot>): PlacedShot {
  return {
    shotNumber: opts.shotNumber ?? 1,
    startLat: opts.startLat ?? TEE.lat,
    startLng: opts.startLng ?? TEE.lng,
    endLat: opts.endLat ?? TEE.lat,
    endLng: opts.endLng ?? TEE.lng,
    pinLat: opts.pinLat ?? offsetLatYards(TEE.lat, 380),
    pinLng: opts.pinLng ?? TEE.lng,
    totalShotsOnHole: opts.totalShotsOnHole ?? 4,
    par: opts.par ?? 4,
  }
}

describe('inferShot — club selection', () => {
  it('280 yd tee shot on a par 4 picks driver', () => {
    const result = inferShot(
      placedShot({
        shotNumber: 1,
        endLat: offsetLatYards(TEE.lat, 280),
        par: 4,
      }),
    )
    expect(result.suggestedClub).toBe('driver')
  })

  it('150 yd approach picks a mid-iron (6i per the table)', () => {
    const start = offsetLatYards(TEE.lat, 220)
    const end = offsetLatYards(TEE.lat, 370) // 150 yd farther
    const result = inferShot(
      placedShot({
        shotNumber: 2,
        startLat: start,
        endLat: end,
        totalShotsOnHole: 4,
        par: 4,
        pinLat: offsetLatYards(TEE.lat, 380),
      }),
    )
    expect(result.suggestedClub).toBe('6i')
  })

  it('~8 yd chip picks the lob wedge', () => {
    const start = offsetLatYards(TEE.lat, 360)
    const end = offsetLatYards(TEE.lat, 368)
    const result = inferShot(
      placedShot({
        shotNumber: 3,
        startLat: start,
        endLat: end,
        totalShotsOnHole: 4,
        par: 4,
        pinLat: offsetLatYards(TEE.lat, 380),
      }),
    )
    expect(result.suggestedClub).toBe('lw')
  })

  it('5 ft putt (start on green) picks putter', () => {
    const pin = offsetLatYards(TEE.lat, 380)
    // 5 ft = ~1.67 yd from pin → on-green threshold is 15 yd.
    const start = offsetLatYards(TEE.lat, 380 - 1.67)
    const result = inferShot(
      placedShot({
        shotNumber: 4,
        startLat: start,
        endLat: pin,
        pinLat: pin,
        totalShotsOnHole: 4,
        par: 4,
      }),
    )
    expect(result.suggestedLieType).toBe('green')
    expect(result.suggestedClub).toBe('putter')
  })

  it('190 yd tee shot on a par 4 picks 3-wood (180-200 yd bucket)', () => {
    // clubForTeeShot: ≥200 driver, ≥180 3w. 190 falls into 3w.
    const result = inferShot(
      placedShot({
        shotNumber: 1,
        endLat: offsetLatYards(TEE.lat, 190),
        par: 4,
      }),
    )
    expect(result.suggestedClub).toBe('3w')
  })

  it('220 yd shot on a par 4 picks driver (boundary >= 200)', () => {
    const result = inferShot(
      placedShot({
        shotNumber: 1,
        endLat: offsetLatYards(TEE.lat, 220),
        par: 4,
      }),
    )
    expect(result.suggestedClub).toBe('driver')
  })

  it('par-3 tee shot uses iron table not tee-shot table', () => {
    // 175 yd par-3 tee → general iron table (≥165 → 4i). Picked 175
    // — well inside the bucket — so the test isn't sensitive to the
    // ~0.1 % drift between flat-earth and haversine at this latitude.
    const result = inferShot(
      placedShot({
        shotNumber: 1,
        endLat: offsetLatYards(TEE.lat, 175),
        par: 3,
        pinLat: offsetLatYards(TEE.lat, 175),
      }),
    )
    expect(result.suggestedClub).toBe('4i')
  })
})

describe('inferShot — confidence rating', () => {
  it('tee shots are always high confidence', () => {
    const result = inferShot(
      placedShot({
        shotNumber: 1,
        endLat: offsetLatYards(TEE.lat, 250),
      }),
    )
    expect(result.confidence).toBe('high')
  })

  it('shots starting on the green are high confidence (a putt)', () => {
    const pin = offsetLatYards(TEE.lat, 380)
    const start = offsetLatYards(TEE.lat, 379)
    const result = inferShot(
      placedShot({
        shotNumber: 4,
        startLat: start,
        endLat: pin,
        pinLat: pin,
        totalShotsOnHole: 4,
      }),
    )
    expect(result.confidence).toBe('high')
  })

  it('mid-iron approaches (100–200 yd) are medium confidence', () => {
    const start = offsetLatYards(TEE.lat, 220)
    const end = offsetLatYards(TEE.lat, 370)
    const result = inferShot(
      placedShot({
        shotNumber: 2,
        startLat: start,
        endLat: end,
        totalShotsOnHole: 4,
        pinLat: offsetLatYards(TEE.lat, 380),
      }),
    )
    expect(result.confidence).toBe('medium')
  })

  it('partial wedges and very long shots flag as low confidence', () => {
    // 60 yd shot, not on green start, par 4.
    const start = offsetLatYards(TEE.lat, 290)
    const end = offsetLatYards(TEE.lat, 350)
    const result = inferShot(
      placedShot({
        shotNumber: 3,
        startLat: start,
        endLat: end,
        totalShotsOnHole: 4,
        pinLat: offsetLatYards(TEE.lat, 380),
      }),
    )
    expect(result.confidence).toBe('low')
  })
})

describe('getShotCategory', () => {
  // Categorizes for the SG engine — return values are the snake_case
  // canonical set: 'off_tee' | 'approach' | 'around_green' | 'putting'.

  it('shots with lieType=green are putts regardless of distance', () => {
    expect(
      getShotCategory({ lieType: 'green', distanceToTarget: undefined }, 4, 3),
    ).toBe('putting')
  })

  it('par 4 shot 1 with lieType=tee → off_tee', () => {
    expect(
      getShotCategory({ lieType: 'tee', distanceToTarget: 380 }, 4, 1),
    ).toBe('off_tee')
  })

  it('par 5 shot 1 → off_tee', () => {
    expect(
      getShotCategory({ lieType: 'tee', distanceToTarget: 540 }, 5, 1),
    ).toBe('off_tee')
  })

  it('par 3 shot 1 is approach not off_tee (per definition)', () => {
    // Off-tee category is reserved for par 4/5 — par 3 tee shots count
    // as approach in SG analysis.
    expect(
      getShotCategory({ lieType: 'tee', distanceToTarget: 150 }, 3, 1),
    ).toBe('approach')
  })

  it('shots inside 30 yd of pin → around_green', () => {
    expect(
      getShotCategory({ lieType: 'rough', distanceToTarget: 25 }, 4, 3),
    ).toBe('around_green')
  })

  it('30 yd is the boundary — exactly 30 is around_green', () => {
    expect(
      getShotCategory({ lieType: 'fringe', distanceToTarget: 30 }, 4, 3),
    ).toBe('around_green')
  })

  it('31 yd flips to approach', () => {
    expect(
      getShotCategory({ lieType: 'rough', distanceToTarget: 31 }, 4, 3),
    ).toBe('approach')
  })

  it('par 4 shot 2 from fairway → approach', () => {
    expect(
      getShotCategory({ lieType: 'fairway', distanceToTarget: 150 }, 4, 2),
    ).toBe('approach')
  })

  it('shots without distance and not on green default to approach', () => {
    expect(
      getShotCategory({ lieType: 'fairway', distanceToTarget: undefined }, 4, 2),
    ).toBe('approach')
  })

  it('priority: 30 yd check beats off_tee — driveable par 4 from tee at 30 yd → around_green', () => {
    // Documents the impl's branch ordering: green-check, then 30yd
    // around-green, then off_tee. A tee shot 30 yd from the pin on a
    // par 4 is therefore around_green, not off_tee. Probably not what
    // a player would expect — pinned so a refactor that flips the
    // priority surfaces here.
    expect(
      getShotCategory({ lieType: 'tee', distanceToTarget: 30 }, 4, 1),
    ).toBe('around_green')
  })

  it('priority: green check beats 30 yd — putt from 25 yd → putting', () => {
    // Same priority story for the green check.
    expect(
      getShotCategory({ lieType: 'green', distanceToTarget: 25 }, 4, 3),
    ).toBe('putting')
  })
})
