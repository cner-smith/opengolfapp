import { describe, expect, it } from 'vitest'
import { inferShot, haversineYards, type PlacedShot } from './shotInference'

// Hole geometry helpers for the tests. We construct synthetic coords
// using ~111,000 m / degree of latitude so distances come out in
// predictable yard counts.
const M_PER_DEG_LAT = 111_320
const YDS_PER_METER = 1.09361

function offsetLat(lat: number, yards: number): number {
  const meters = yards / YDS_PER_METER
  return lat + meters / M_PER_DEG_LAT
}

const TEE = { lat: 35.5, lng: -97.5 }

function pinAtYards(yards: number) {
  return { lat: offsetLat(TEE.lat, yards), lng: TEE.lng }
}

function endAtYards(yards: number) {
  return { lat: offsetLat(TEE.lat, yards), lng: TEE.lng }
}

function basePlacedShot(overrides: Partial<PlacedShot>): PlacedShot {
  const pin = pinAtYards(380)
  return {
    shotNumber: 1,
    startLat: TEE.lat,
    startLng: TEE.lng,
    endLat: TEE.lat,
    endLng: TEE.lng,
    pinLat: pin.lat,
    pinLng: pin.lng,
    totalShotsOnHole: 4,
    par: 4,
    ...overrides,
  }
}

describe('haversineYards', () => {
  it('converts a 1-degree latitude difference to ~121,798 yards', () => {
    const d = haversineYards(0, 0, 1, 0)
    expect(d).toBeGreaterThan(121_000)
    expect(d).toBeLessThan(122_000)
  })

  it('returns zero for the same point', () => {
    expect(haversineYards(35, -97, 35, -97)).toBeCloseTo(0, 5)
  })
})

describe('inferShot — tee shots', () => {
  it('par 4 long tee shot picks driver and lie=tee', () => {
    const end = endAtYards(260)
    const result = inferShot(
      basePlacedShot({
        shotNumber: 1,
        endLat: end.lat,
        endLng: end.lng,
        totalShotsOnHole: 4,
        par: 4,
      }),
    )
    expect(result.suggestedLieType).toBe('tee')
    expect(result.suggestedClub).toBe('driver')
    expect(result.confidence).toBe('high')
    expect(result.distanceYards).toBeGreaterThan(255)
    expect(result.distanceYards).toBeLessThan(265)
  })

  it('par 5 mid-distance tee shot keeps driver in range', () => {
    const end = endAtYards(225)
    const result = inferShot(
      basePlacedShot({
        shotNumber: 1,
        endLat: end.lat,
        endLng: end.lng,
        totalShotsOnHole: 4,
        par: 5,
        pinLat: pinAtYards(540).lat,
        pinLng: TEE.lng,
      }),
    )
    expect(result.suggestedClub).toBe('driver')
  })

  it('par 5 layup-distance tee shot picks 3-wood', () => {
    const end = endAtYards(190)
    const result = inferShot(
      basePlacedShot({
        shotNumber: 1,
        endLat: end.lat,
        endLng: end.lng,
        totalShotsOnHole: 4,
        par: 5,
        pinLat: pinAtYards(540).lat,
        pinLng: TEE.lng,
      }),
    )
    expect(result.suggestedClub).toBe('3w')
  })

  it('par 4 conservative tee shot picks a hybrid in 150–180 window', () => {
    const end = endAtYards(165)
    const result = inferShot(
      basePlacedShot({
        shotNumber: 1,
        endLat: end.lat,
        endLng: end.lng,
        totalShotsOnHole: 3,
        par: 4,
      }),
    )
    expect(result.suggestedClub).toBe('3h')
  })

  it('par 3 tee shot uses iron table', () => {
    const end = endAtYards(158)
    const result = inferShot(
      basePlacedShot({
        shotNumber: 1,
        endLat: end.lat,
        endLng: end.lng,
        totalShotsOnHole: 3,
        par: 3,
        pinLat: pinAtYards(160).lat,
        pinLng: TEE.lng,
      }),
    )
    expect(result.suggestedLieType).toBe('tee')
    // 158 yd full shot lands in the 5i bucket per the general table.
    expect(result.suggestedClub).toBe('5i')
  })
})

describe('inferShot — approach + lie', () => {
  it('mid-iron approach lands in the right club bucket and medium confidence', () => {
    const start = endAtYards(220) // shot 2 hit from 220 yd downrange
    const end = endAtYards(360) // 140 yd shot to about 20 yd short of pin
    const result = inferShot({
      shotNumber: 2,
      startLat: start.lat,
      startLng: start.lng,
      endLat: end.lat,
      endLng: end.lng,
      pinLat: pinAtYards(380).lat,
      pinLng: TEE.lng,
      totalShotsOnHole: 4,
      par: 4,
    })
    expect(result.suggestedClub).toBe('7i')
    expect(result.suggestedLieType).toBe('rough')
    expect(result.confidence).toBe('medium')
    expect(result.distanceYards).toBeGreaterThan(135)
    expect(result.distanceYards).toBeLessThan(145)
  })

  it('starts within 30 yd of the pin → fringe + wedge by distance', () => {
    const start = endAtYards(360) // 20 yd from pin
    const end = endAtYards(378) // pitched up to 2 yd short
    const result = inferShot({
      shotNumber: 3,
      startLat: start.lat,
      startLng: start.lng,
      endLat: end.lat,
      endLng: end.lng,
      pinLat: pinAtYards(380).lat,
      pinLng: TEE.lng,
      totalShotsOnHole: 4,
      par: 4,
    })
    expect(result.suggestedLieType).toBe('fringe')
    // ~18 yd shot lands in the LW bucket.
    expect(result.suggestedClub).toBe('lw')
  })
})

describe('inferShot — putts and last shots', () => {
  it('last shot starting on the green is a putt that ends at the pin', () => {
    const pin = pinAtYards(380)
    const start = endAtYards(378) // 2 yd from pin
    const result = inferShot({
      shotNumber: 4,
      startLat: start.lat,
      startLng: start.lng,
      // Last shot was holed → end coords are the pin itself.
      endLat: pin.lat,
      endLng: pin.lng,
      pinLat: pin.lat,
      pinLng: TEE.lng,
      totalShotsOnHole: 4,
      par: 4,
    })
    expect(result.suggestedLieType).toBe('green')
    expect(result.suggestedClub).toBe('putter')
    expect(result.isLastShot).toBe(true)
    expect(result.confidence).toBe('high')
  })

  it('lag putt that does not hole counts as putt because start was on green', () => {
    // Shot 3 starting on green, ending short of the cup but not the last.
    const start = endAtYards(378)
    const end = endAtYards(379)
    const result = inferShot({
      shotNumber: 3,
      startLat: start.lat,
      startLng: start.lng,
      endLat: end.lat,
      endLng: end.lng,
      pinLat: pinAtYards(380).lat,
      pinLng: TEE.lng,
      totalShotsOnHole: 4,
      par: 4,
    })
    expect(result.suggestedLieType).toBe('green')
    expect(result.suggestedClub).toBe('putter')
  })
})
