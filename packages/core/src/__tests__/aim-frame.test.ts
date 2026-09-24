import { describe, expect, it } from 'vitest'
import { aimFrame, type AimFrame, type AimFrameInput } from '../aim-frame'
import { bearingDegrees, haversineYards, toRadians } from '../units'
import { destinationYards, type GeoPoint } from '../shot-dispersion-geo'

// Forward projection with the same pinhole model: where does `point` land,
// in dp from the map top, under `frame`? It shares aim-frame's camera
// constants (eye distance, fov), so this checks the algebra only — those
// constants were validated against Mapbox on-device (#899), not here.
function screenY(frame: AimFrame, point: GeoPoint, i: AimFrameInput): number {
  const metresPerPx =
    (40075016.686 * Math.cos(toRadians(frame.center.lat))) / (512 * 2 ** frame.zoom)
  const pxPerYard = 0.9144 / metresPerPx
  const toPoint = bearingDegrees(frame.center.lat, frame.center.lng, point.lat, point.lng)
  const ahead = Math.abs(((toPoint - frame.heading + 540) % 360) - 180) < 90 ? 1 : -1
  const s = ahead * haversineYards(frame.center.lat, frame.center.lng, point.lat, point.lng) * pxPerYard
  const p = toRadians(i.pitch)
  const D = 1.5 * i.mapHeight
  const up = (D * s * Math.cos(p)) / (D + s * Math.sin(p))
  return i.mapHeight / 2 + (i.centerOffsetY ?? 0) - up
}

const BALL: GeoPoint = { lat: 40.1206, lng: -75.3126 }
const input = (holeYards: number, pitch: number, extra: Partial<AimFrameInput> = {}): AimFrameInput => ({
  ball: BALL,
  pin: destinationYards(BALL, 70, holeYards),
  mapHeight: 760,
  pitch,
  topInset: 10,
  flagHeight: 37, // FLAG_TOP_DP in useHoleCamera
  ballInset: 200,
  greenDepthYards: 15,
  ...extra,
})

describe('aimFrame', () => {
  const tops = (f: AimFrame, i: AimFrameInput) => ({
    flag: screenY(f, i.pin, i) - i.flagHeight,
    greenBack: screenY(f, destinationYards(i.pin, 70, 15), i),
  })

  for (const pitch of [0, 60]) {
    for (const holeYards of [160, 430, 560]) {
      it(`${holeYards} yd at ${pitch}°: higher anchor 10 dp below the top, ball at its inset`, () => {
        const i = input(holeYards, pitch)
        const f = aimFrame(i)
        const { flag, greenBack } = tops(f, i)
        expect(Math.min(flag, greenBack)).toBeCloseTo(10, 1)
        expect(screenY(f, i.ball, i)).toBeCloseTo(760 - 200, 1)
      })
    }
  }

  it('long hole, flat: the flag is the binding anchor', () => {
    const i = input(430, 0)
    const { flag, greenBack } = tops(aimFrame(i), i)
    expect(flag).toBeCloseTo(10, 1)
    expect(greenBack).toBeGreaterThan(10)
  })

  it("short hole, flat: the green's back edge binds instead", () => {
    const i = input(160, 0)
    const { flag, greenBack } = tops(aimFrame(i), i)
    expect(greenBack).toBeCloseTo(10, 1)
    expect(flag).toBeGreaterThan(10)
  })

  it('heads up the hole (ball → pin)', () => {
    expect(aimFrame(input(430, 0)).heading).toBeCloseTo(70, 1)
  })

  it('honours a measured camera-centre offset', () => {
    const i = input(430, 60, { centerOffsetY: 24 })
    const f = aimFrame(i)
    expect(Math.min(tops(f, i).flag, tops(f, i).greenBack)).toBeCloseTo(10, 1)
    expect(screenY(f, i.ball, i)).toBeCloseTo(760 - 200, 1)
  })
})
